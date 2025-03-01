from typing import Dict, List, Optional, Any, Type
from .base_tool import BaseTool, ToolMetadata
import inspect
import json
import logging
import os
# Temporarily comment out crewai_tools to avoid OpenAI dependency
# from crewai_tools import (
#     DirectorySearchTool,
#     FileReadTool,
#     # WebsiteSearchTool,  # Will handle in next pass
# )
from pydantic import BaseModel, Field
import asyncio
import threading
import requests

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get API endpoint from environment
API_ENDPOINT = os.environ.get('AI_API_ENDPOINT', 'https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/')

class ToolExecutionContext(BaseModel):
    """Context for tool execution"""
    agent_id: str
    task_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    execution_id: str = Field(default_factory=lambda: str(threading.get_ident()))

class DynamicToolManager:
    """Enhanced tool manager with CrewAI integration and dynamic tool creation"""
    
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._dynamic_tools: Dict[str, BaseTool] = {}
        self._execution_history: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = threading.Lock()
        self.load_default_tools()

    def load_default_tools(self):
        """Load all default CrewAI tools without OpenAI dependencies"""
        # Temporarily disable all tool loading to avoid OpenAI dependency issues
        logger.info("Tool loading temporarily disabled - using empty tool set")
        self._tools = {}

    def _wrap_crewai_tool(self, name: str, crewai_tool: object) -> List[BaseTool]:
        """Enhanced wrapper for CrewAI tools with better error handling"""
        try:
            tool_methods = inspect.getmembers(crewai_tool, predicate=inspect.ismethod)
            wrapped_tools = []

            for method_name, method in tool_methods:
                if method_name.startswith('_'):
                    continue

                # Create wrapped tool class
                class WrappedTool(BaseTool):
                    def __init__(self, tool_obj, method_name, method):
                        self.tool_obj = tool_obj
                        self.method = method
                        self.method_name = method_name
                        super().__init__()

                    def _get_metadata(self) -> ToolMetadata:
                        doc = self.method.__doc__ or ""
                        return ToolMetadata(
                            name=f"{name}.{self.method_name}",
                            description=doc.strip(),
                            parameters=self._extract_parameters(),
                            return_type="Any",
                            category=name,
                            is_dynamic=False
                        )

                    def _extract_parameters(self) -> Dict:
                        sig = inspect.signature(self.method)
                        return {
                            name: {
                                "type": str(param.annotation),
                                "default": None if param.default is inspect.Parameter.empty else param.default,
                                "description": self._get_param_description(name)
                            }
                            for name, param in sig.parameters.items()
                            if name != 'self'
                        }

                    def _get_param_description(self, param_name: str) -> str:
                        """Extract parameter description from docstring"""
                        doc = self.method.__doc__ or ""
                        param_section = doc.split(":param")
                        for section in param_section[1:]:
                            if section.strip().startswith(f"{param_name}:"):
                                return section.split(":")[1].strip()
                        return f"Parameter {param_name}"

                    async def execute(self, context: ToolExecutionContext, **kwargs):
                        try:
                            # Record execution start
                            self._record_execution_start(context)
                            
                            # Execute the tool
                            result = await self._execute_with_retry(context, **kwargs)
                            
                            # Record successful execution
                            self._record_execution_success(context, result)
                            
                            return result
                        except Exception as e:
                            # Record failed execution
                            self._record_execution_error(context, e)
                            raise

                    async def _execute_with_retry(self, context: ToolExecutionContext, **kwargs):
                        """Execute with retry logic using Lambda endpoint for AI operations"""
                        max_retries = 3
                        retry_delay = 1  # seconds
                        
                        for attempt in range(max_retries):
                            try:
                                # If the tool requires AI capabilities, route through Lambda
                                if getattr(self.method, 'requires_ai', False):
                                    response = requests.post(
                                        API_ENDPOINT,
                                        json={
                                            'type': 'tool_execution',
                                            'tool_name': self.metadata.name,
                                            'parameters': kwargs,
                                            'context': context.dict()
                                        }
                                    )
                                    response.raise_for_status()
                                    return response.json()
                                
                                # Otherwise execute normally
                                if asyncio.iscoroutinefunction(self.method):
                                    return await self.method(**kwargs)
                                return self.method(**kwargs)
                            except Exception as e:
                                if attempt == max_retries - 1:
                                    raise
                                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                                await asyncio.sleep(retry_delay)

                    def _record_execution_start(self, context: ToolExecutionContext):
                        """Record tool execution start"""
                        execution_record = {
                            "execution_id": context.execution_id,
                            "agent_id": context.agent_id,
                            "task_id": context.task_id,
                            "tool_name": self.metadata.name,
                            "parameters": context.parameters,
                            "start_time": asyncio.get_event_loop().time(),
                            "status": "started"
                        }
                        self._add_to_history(execution_record)

                    def _record_execution_success(self, context: ToolExecutionContext, result: Any):
                        """Record successful tool execution"""
                        execution_record = {
                            "execution_id": context.execution_id,
                            "end_time": asyncio.get_event_loop().time(),
                            "status": "completed",
                            "result": str(result)
                        }
                        self._update_history(context.execution_id, execution_record)

                    def _record_execution_error(self, context: ToolExecutionContext, error: Exception):
                        """Record failed tool execution"""
                        execution_record = {
                            "execution_id": context.execution_id,
                            "end_time": asyncio.get_event_loop().time(),
                            "status": "failed",
                            "error": str(error)
                        }
                        self._update_history(context.execution_id, execution_record)

                    def _add_to_history(self, record: Dict[str, Any]):
                        """Add execution record to history"""
                        with self._lock:
                            if self.metadata.name not in self._execution_history:
                                self._execution_history[self.metadata.name] = []
                            self._execution_history[self.metadata.name].append(record)

                    def _update_history(self, execution_id: str, update: Dict[str, Any]):
                        """Update existing execution record"""
                        with self._lock:
                            if self.metadata.name in self._execution_history:
                                for record in self._execution_history[self.metadata.name]:
                                    if record["execution_id"] == execution_id:
                                        record.update(update)
                                        break

                # Create and add wrapped tool
                wrapped_tool = WrappedTool(crewai_tool, method_name, method)
                wrapped_tools.append(wrapped_tool)

            return wrapped_tools
        except Exception as e:
            logger.error(f"Error wrapping CrewAI tool: {str(e)}")
            return []

    async def create_dynamic_tool(self, metadata: ToolMetadata, code: str) -> Optional[BaseTool]:
        """Create a new dynamic tool at runtime with enhanced validation"""
        try:
            # Validate metadata
            if not self._validate_tool_metadata(metadata):
                raise ValueError("Invalid tool metadata")

            # Create tool code with proper structure
            tool_code = self._generate_tool_code(metadata, code)

            # Create namespace and execute code
            namespace = {}
            exec(tool_code, globals(), namespace)

            # Instantiate and validate tool
            tool = namespace["DynamicTool"]()
            if not self._validate_tool(tool):
                raise ValueError("Tool validation failed")

            # Register tool
            with self._lock:
                self._dynamic_tools[metadata.name] = tool
                logger.info(f"Created dynamic tool: {metadata.name}")

            return tool
        except Exception as e:
            logger.error(f"Error creating dynamic tool: {str(e)}")
            return None

    def _validate_tool_metadata(self, metadata: ToolMetadata) -> bool:
        """Validate tool metadata"""
        try:
            # Check required fields
            if not metadata.name or not metadata.description:
                return False

            # Validate parameters
            if metadata.parameters:
                for param, spec in metadata.parameters.items():
                    if not isinstance(spec, dict):
                        return False
                    if "type" not in spec:
                        return False

            return True
        except Exception:
            return False

    def _validate_tool(self, tool: BaseTool) -> bool:
        """Validate tool implementation"""
        try:
            # Check required methods
            if not hasattr(tool, "execute") or not callable(tool.execute):
                return False

            # Validate metadata
            if not tool.metadata or not isinstance(tool.metadata, ToolMetadata):
                return False

            return True
        except Exception:
            return False

    def _generate_tool_code(self, metadata: ToolMetadata, code: str) -> str:
        """Generate tool code with proper structure and error handling"""
        return f"""
class DynamicTool(BaseTool):
    def _get_metadata(self) -> ToolMetadata:
        return ToolMetadata(
            name="{metadata.name}",
            description="{metadata.description}",
            parameters={metadata.parameters},
            return_type="{metadata.return_type}",
            category="{metadata.category}",
            created_by="{metadata.created_by or 'dynamic'}",
            version="{metadata.version}",
            is_dynamic=True
        )

    async def execute(self, context: ToolExecutionContext, **kwargs):
        try:
            # Record execution start
            self._record_execution_start(context)
            
            # Execute the tool
            result = await self._execute_with_retry(context, **kwargs)
            
            # Record successful execution
            self._record_execution_success(context, result)
            
            return result
        except Exception as e:
            # Record failed execution
            self._record_execution_error(context, e)
            raise

    async def _execute_with_retry(self, context: ToolExecutionContext, **kwargs):
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
{code}
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(retry_delay)
        """

    def register_tool(self, tool: BaseTool):
        """Register a new tool with validation"""
        try:
            if not self._validate_tool(tool):
                raise ValueError("Invalid tool")

            with self._lock:
                if tool.metadata.is_dynamic:
                    self._dynamic_tools[tool.metadata.name] = tool
                else:
                    self._tools[tool.metadata.name] = tool
                logger.info(f"Registered tool: {tool.metadata.name}")
        except Exception as e:
            logger.error(f"Error registering tool: {str(e)}")

    def unregister_tool(self, tool_name: str):
        """Unregister a tool"""
        try:
            with self._lock:
                if tool_name in self._dynamic_tools:
                    del self._dynamic_tools[tool_name]
                    logger.info(f"Unregistered dynamic tool: {tool_name}")
                elif tool_name in self._tools:
                    del self._tools[tool_name]
                    logger.info(f"Unregistered tool: {tool_name}")
        except Exception as e:
            logger.error(f"Error unregistering tool: {str(e)}")

    def get_tool(self, tool_name: str) -> Optional[BaseTool]:
        """Get a tool by name"""
        return self._tools.get(tool_name) or self._dynamic_tools.get(tool_name)

    def list_tools(self, include_dynamic: bool = True) -> List[Dict[str, Any]]:
        """List all available tools"""
        try:
            tools_list = [tool.to_dict() for tool in self._tools.values()]
            if include_dynamic:
                tools_list.extend([tool.to_dict() for tool in self._dynamic_tools.values()])
            return tools_list
        except Exception as e:
            logger.error(f"Error listing tools: {str(e)}")
            return []

    def get_tools_description(self) -> str:
        """Get a formatted description of all tools for LLM consumption"""
        try:
            descriptions = []
            for tool in self.list_tools():
                desc = f"Tool: {tool['name']}\n"
                desc += f"Description: {tool['description']}\n"
                desc += f"Parameters: {json.dumps(tool['parameters'], indent=2)}\n"
                desc += f"Returns: {tool['return_type']}\n"
                desc += f"Category: {tool['category']}\n"
                desc += "-" * 50
                descriptions.append(desc)
            return "\n".join(descriptions)
        except Exception as e:
            logger.error(f"Error getting tools description: {str(e)}")
            return "Error retrieving tools description"

    def get_execution_history(self, tool_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get execution history for a tool or all tools"""
        try:
            with self._lock:
                if tool_name:
                    return self._execution_history.get(tool_name, [])
                return [
                    record
                    for records in self._execution_history.values()
                    for record in records
                ]
        except Exception as e:
            logger.error(f"Error getting execution history: {str(e)}")
            return []

    def clear_execution_history(self, tool_name: Optional[str] = None):
        """Clear execution history for a tool or all tools"""
        try:
            with self._lock:
                if tool_name:
                    self._execution_history.pop(tool_name, None)
                else:
                    self._execution_history.clear()
        except Exception as e:
            logger.error(f"Error clearing execution history: {str(e)}")
