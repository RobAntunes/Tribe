import os
from typing import Any, Dict, List, Optional, Union, Literal
from pydantic import Field, PrivateAttr, ConfigDict, BaseModel
from crewai import Agent, Task, Process
from ..tools.tool_manager import DynamicToolManager
import threading
import asyncio
import json
import logging
import uuid
from datetime import datetime
from ..tools.system_tools import SystemAccessManager
import random
import string
import requests
from ..core.foundation_model import FoundationModelInterface
import time
import enum
import re
from .config import config

# Setup logging
logging.basicConfig(level=logging.INFO)

# Add a base class with get method
class BaseModelWithGet(BaseModel):
    """Base model with get method for dictionary-like access"""
    
    def get(self, key, default=None):
        """Get a configuration value by key with a default fallback"""
        return getattr(self, key, default)

# Core System Configuration Models
class TaskExecutionConfig(BaseModelWithGet):
    """Configuration for task execution"""
    max_concurrent: int = Field(default=5, ge=1)
    timeout_seconds: int = Field(default=300, ge=1)
    retry_count: int = Field(default=3, ge=0)
    retry_delay_seconds: int = Field(default=5, ge=1)

class TeamCreationConfig(BaseModelWithGet):
    """Configuration for team creation"""
    min_agents: int = Field(default=3, ge=1)
    max_agents: int = Field(default=10, ge=1)
    required_roles: List[str] = Field(default_factory=list)

class TeamValidationResult(BaseModelWithGet):
    """Result of team validation"""
    is_valid: bool = Field(default=False)
    missing_roles: List[str] = Field(default_factory=list)
    missing_tools: List[str] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

class SystemConfig(BaseModelWithGet):
    """Core system configuration"""
    model: str = Field(default="anthropic/claude-3-7-sonnet-20250219", description="LLM model to use for AI operations")
    collaboration_mode: Literal["SOLO", "HYBRID", "FULL"] = Field(default="HYBRID")
    process_type: Literal["sequential", "hierarchical"] = Field(default="hierarchical")
    task_execution: TaskExecutionConfig = Field(default_factory=TaskExecutionConfig)
    team_creation: TeamCreationConfig = Field(default_factory=TeamCreationConfig)
    debug: bool = Field(default=False)
    max_rpm: int = Field(default=60, ge=1)
    cache_enabled: bool = Field(default=True)

class AgentMetadata(BaseModelWithGet):
    """Essential agent metadata for system operations"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str
    status: Literal["ready", "busy", "error", "dissolved"] = Field(default="ready")
    current_load: int = Field(default=0, ge=0)
    last_active: Optional[float] = None
    skills: List[str] = Field(default_factory=list)
    description: str = Field(default="", description="Short description of the agent's expertise and role")

class TaskMetadata(BaseModelWithGet):
    """Essential task metadata for system operations"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: Literal["pending", "in_progress", "completed", "failed", "cancelled"] = "pending"
    priority: int = Field(default=0)
    assigned_to: Optional[str] = None
    created_at: float = Field(default_factory=lambda: asyncio.get_event_loop().time())
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    retries: int = Field(default=0)

class TeamState(BaseModelWithGet):
    """Team state management"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    active_agents: List[AgentMetadata] = Field(default_factory=list)
    pending_tasks: List[TaskMetadata] = Field(default_factory=list)
    active_tasks: List[TaskMetadata] = Field(default_factory=list)
    completed_tasks: List[TaskMetadata] = Field(default_factory=list)
    creation_time: float = Field(default_factory=lambda: asyncio.get_event_loop().time())
    last_modified: float = Field(default_factory=lambda: asyncio.get_event_loop().time())
    status: Literal["forming", "active", "dissolving", "dissolved"] = "forming"

class SystemState(BaseModelWithGet):
    """Global system state"""
    teams: Dict[str, TeamState] = Field(default_factory=dict)
    available_agents: List[AgentMetadata] = Field(default_factory=list)
    global_tasks: List[TaskMetadata] = Field(default_factory=list)
    system_load: float = Field(default=0.0)
    last_cleanup: Optional[float] = None

# Response Schema Models
class RoleRequirement(BaseModelWithGet):
    """Model for role requirements"""
    role: str = Field(..., description="Role name")
    name: str = Field(default="", description="Unique descriptive name for the agent")
    description: str = Field(default="", description="Detailed description of the agent's responsibilities and personality traits")
    goal: str = Field(..., description="Role's primary objective")
    required_skills: List[str] = Field(..., description="Required skills for the role")
    collaboration_pattern: str = Field(..., description="Preferred collaboration mode")
    min_agents: int = Field(default=1, ge=1)
    max_agents: int = Field(default=3, ge=1)
    
    model_config = ConfigDict(extra="allow")

class TeamStructure(BaseModelWithGet):
    """Model for team structure"""
    hierarchy: str = Field(..., description="Team hierarchy type (flat/hierarchical)")
    communication: str = Field(..., description="Communication patterns and protocols")
    coordination: str = Field(..., description="Coordination mechanisms")
    
    model_config = ConfigDict(extra="allow")

class ToolRequirement(BaseModelWithGet):
    """Model for tool requirements"""
    name: str = Field(..., description="Tool name")
    purpose: str = Field(..., description="Tool purpose")
    required_by: List[str] = Field(..., description="Roles requiring this tool")

class InitialTask(BaseModelWithGet):
    """Model for initial tasks"""
    description: str = Field(..., description="Task description")
    assigned_to: str = Field(..., description="Role name of assignee")
    dependencies: List[str] = Field(default_factory=list)
    expected_output: str = Field(..., description="Expected result")

class TeamCompositionResponse(BaseModelWithGet):
    """Model for team composition response"""
    required_roles: List[RoleRequirement] = Field(..., min_items=1)
    team_structure: TeamStructure
    tools_required: List[ToolRequirement] = Field(default_factory=list)
    initial_tasks: List[InitialTask] = Field(default_factory=list)
    
    model_config = ConfigDict(extra="allow")

class OptimizationAction(BaseModelWithGet):
    """Model for optimization actions"""
    action: str = Field(..., description="Action type (add/remove/modify)")
    role: str = Field(..., description="Role name")
    reason: str = Field(..., description="Explanation for the action")

class RoleAdjustment(BaseModelWithGet):
    """Model for role adjustments"""
    agent: str = Field(..., description="Agent name")
    new_role: str = Field(..., description="New role name")
    reason: str = Field(..., description="Explanation for the adjustment")

class CollaborationUpdate(BaseModelWithGet):
    """Model for collaboration updates"""
    pattern: str = Field(..., description="New collaboration pattern")
    affected_roles: List[str] = Field(..., description="Affected roles")
    reason: str = Field(..., description="Explanation for the update")

class ToolRecommendation(BaseModelWithGet):
    """Model for tool recommendations"""
    tool: str = Field(..., description="Tool name")
    action: str = Field(..., description="Action (add/remove)")
    for_roles: List[str] = Field(..., description="Target roles")
    reason: str = Field(..., description="Explanation for the recommendation")

class TeamOptimizationResponse(BaseModelWithGet):
    """Model for team optimization response"""
    composition_changes: List[OptimizationAction] = Field(default_factory=list)
    role_adjustments: List[RoleAdjustment] = Field(default_factory=list)
    collaboration_updates: List[CollaborationUpdate] = Field(default_factory=list)
    tool_recommendations: List[ToolRecommendation] = Field(default_factory=list)


class ToolConfig(BaseModelWithGet):
    """Configuration for a tool"""
    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    return_type: str = Field(default="Any")
    category: str = Field(default="custom")
    is_dynamic: bool = Field(default=True)


class AgentModel(BaseModelWithGet):
    """Model for an agent"""
    name: str = Field(..., description="Unique name of the agent")
    role: str = Field(..., description="Role/title of the agent")
    backstory: str = Field(..., description="Detailed background and expertise")
    goal: str = Field(..., description="Primary objective")
    short_description: str = Field(default="", description="Concise description of the agent based on their role or expertise")
    verbose: bool = Field(default=True)
    allow_delegation: bool = Field(default=True)
    allow_code_execution: bool = Field(default=True)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class TaskModel(BaseModelWithGet):
    """Model for a task"""
    description: str = Field(..., description="Detailed task description")
    expected_output: str = Field(..., description="Expected format and content")
    agent: str = Field(..., description="Name of assigned agent")
    tools: List[str] = Field(default_factory=list)
    output_file: Optional[str] = None
    context: Optional[Dict[str, Any]] = Field(default_factory=dict)

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary format"""
        return {
            "description": self.description,
            "expected_output": self.expected_output,
            "agent": self.agent,
            "tools": self.tools,
            "output_file": self.output_file,
            "context": self.context
        }

    @classmethod
    def from_task(cls, task: Task) -> "TaskModel":
        """Create TaskModel from Task instance"""
        return cls(
            description=task.description,
            expected_output=task.expected_output,
            agent=task.agent,
            tools=task.tools if hasattr(task, "tools") else [],
            output_file=task.output_file if hasattr(task, "output_file") else None,
            context=task.context if hasattr(task, "context") else {}
        )


class ToolModel(BaseModelWithGet):
    """Model for a tool"""
    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description and purpose")
    capabilities: List[str] = Field(..., min_length=1)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class FlowModel(BaseModelWithGet):
    """Model for a workflow"""
    name: str = Field(..., description="Flow name")
    description: str = Field(..., description="Flow description")
    steps: List[str] = Field(..., min_length=1)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class TeamResponse(BaseModelWithGet):
    """Model for team response"""
    vision: str = Field(..., description="Project vision statement")
    agents: List[AgentModel] = Field(..., min_length=1)
    tasks: List[TaskModel] = Field(..., min_length=1)
    tools: List[ToolModel] = Field(..., min_length=1)
    flows: List[FlowModel] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class AgentState(BaseModelWithGet):
    """Structured state data for DynamicAgent"""

    name: str = Field(default="")
    created_agents: List[Agent] = Field(default_factory=list)
    collaboration_mode: str = Field(default="HYBRID")
    current_team: Optional[str] = Field(default=None)
    status: str = Field(default="ready")
    model: str = Field(default="anthropic/claude-3-7-sonnet-20250219")
    tools_list: List[Any] = Field(default_factory=list)
    project_context: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="allow")

    def to_dict(self) -> Dict[str, Any]:
        """Convert state to dictionary"""
        return {
            "name": self.name,
            "created_agents": self.created_agents,
            "collaboration_mode": self.collaboration_mode,
            "current_team": self.current_team,
            "status": self.status,
            "model": self.model,
            "tools": self.tools_list
        }


class VPEngineeringModel(TeamResponse):
    """Model for VP of Engineering initialization, inheriting from TeamResponse"""
    model_config = ConfigDict(arbitrary_types_allowed=True)


class DynamicAgent:
    """Specialized agent for bootstrapping teams and analyzing project requirements."""

    def __init__(self, role: str, goal: str, backstory: str, model: Optional[str] = None):
        """
        Initialize the dynamic agent.

        Args:
            role: The agent's role
            goal: The agent's goal
            backstory: The agent's backstory
            model: Optional model name override
        """
        self.model = model or "anthropic/claude-3-7-sonnet-20250219"
            
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self._state = {"project_context": {}}
        self._system_manager = None
        self.name = ""
        self.short_description = ""
        self.status = "active"
        
        # Initialize collaboration tasks list
        self._collaboration_tasks = []
        
        # Initialize agent state
        self._state = {
            "status": "initializing",
            "model": self.model,
            "initialization_complete": False,
            "project_context": {},
            "role_context": {
                "role": role,
                "capabilities": [],
                "knowledge_domain": [],
                "interaction_history": [],
                "self_awareness": {
                    "can_delegate": True,
                    "authority_level": "high" if role == "VP of Engineering" else "standard",
                    "can_modify_team": role == "VP of Engineering"
                }
            }
        }
        
        # Initialize system access tools using private attribute
        self._system_manager = SystemAccessManager()
        self.tools.extend(self._system_manager.get_tools())
    
    async def execute_task(self, task_input):
        """Execute a task using the foundation model."""
        try:
            # Initialize foundation model interface
            foundation_model = FoundationModelInterface(model=self.model)
            
            # Handle different task input types
            if isinstance(task_input, str):
                # If task_input is a string, treat it as a task description
                
                # Create a system prompt for the foundation model
                system_prompt = f"""You are {self.name}, a {self.role} with the following backstory:
                {getattr(self, 'backstory', 'An AI agent specializing in your role.')}
                
                Your task is to complete the assigned work to the best of your ability, following any format requirements.
                """
                
                # Extract expected output from the task description if possible
                expected_output = ""
                if "expected output" in task_input.lower():
                    # Try to extract the expected output section
                    match = re.search(r"expected output:?\s*(.*?)(?:\n\n|\Z)", task_input, re.IGNORECASE | re.DOTALL)
                    if match:
                        expected_output = match.group(1).strip()
                
                # Create a user prompt for the foundation model
                user_prompt = f"""# Task for {self.role}
                
                ## Description
                {task_input}
                
                ## Expected Output
                {expected_output}
                
                Please complete this task to the best of your ability.
                """
                
                # Check if this is a special task that requires structured output
                # Look for JSON keywords or format specifications in the task or expected output
                needs_structured_output = (
                    "json" in task_input.lower() or 
                    "format" in task_input.lower() or
                    (expected_output and ("json" in expected_output.lower() or "format" in expected_output.lower()))
                )
                
                # Query the foundation model with a timeout
                try:
                    # Use the enhanced query with system prompt and structured output flag
                    response = foundation_model.query_model(
                        prompt=user_prompt,
                        system_message=system_prompt,
                        structured_output=needs_structured_output
                    )
                    return response
                except Exception as e:
                    logging.error(f"Error querying foundation model: {str(e)}")
                    return f"Error executing task: {str(e)}"
            else:
                # If task_input is already a Task object, use our custom foundation model
                foundation_model = FoundationModelInterface(model=self.model)
                
                # Check cache for similar tasks
                cache_key = f"{self.role}_{task_input.description}_{getattr(task_input, 'context', {})}"
                
                if cache_key in foundation_model.cache:
                    logging.info(f"Using cached response for task: {task_input.description[:50]}...")
                    return foundation_model.cache[cache_key]
                
                # Create a system prompt and user prompt for the foundation model
                system_prompt = f"""You are {self.name}, a {self.role} with the following backstory:
                {getattr(self, 'backstory', 'An AI agent specializing in your role.')}
                
                Your task is to complete the assigned work to the best of your ability, following any format requirements.
                """
                
                user_prompt = f"""# Task for {self.role}
                
                ## Description
                {task_input.description}
                
                ## Context
                {getattr(task_input, 'context', {})}
                
                ## Expected Output
                {task_input.expected_output}
                
                Please complete this task to the best of your ability.
                """
                
                # Check if this is a special task that requires structured output
                # Look for JSON keywords or format specifications in the expected output
                needs_structured_output = (
                    "json" in task_input.expected_output.lower() or 
                    "format" in task_input.expected_output.lower() or
                    hasattr(task_input, 'output_json') or
                    hasattr(task_input, 'output_pydantic')
                )
                
                # Query the foundation model with a timeout
                try:
                    # Use the enhanced query with system prompt and structured output flag
                    response = foundation_model.query_model(
                        prompt=user_prompt,
                        system_message=system_prompt,
                        structured_output=needs_structured_output
                    )
                    return response
                except Exception as e:
                    logging.error(f"Error querying foundation model: {str(e)}")
                    return f"Error executing task: {str(e)}"
        except Exception as e:
            logging.error(f"Error in execute_task: {str(e)}")
            return f"Error executing task: {str(e)}"
        
    def analyze_codebase(self, context):
        """Analyze codebase and suggest improvements (Genesis functionality)"""
        response = requests.post(
            self.api_endpoint,
            json={
                'type': 'genesis_analyze',
                'context': context
            }
        )
        return response.json()
    
    def generate_code(self, requirements, context):
        """Generate code based on requirements (Genesis functionality)"""
        response = requests.post(
            self.api_endpoint,
            json={
                'type': 'genesis_generate',
                'requirements': requirements,
                'context': context
            }
        )
        return response.json()
    
    def review_changes(self, changes, context):
        """Review code changes (Genesis functionality)"""
        response = requests.post(
            self.api_endpoint,
            json={
                'type': 'genesis_review',
                'changes': changes,
                'context': context
            }
        )
        return response.json()

    def get_role_context(self) -> dict:
        """Get the current role context for self-referential operations"""
        return self._state["role_context"]

    def update_role_context(self, **kwargs):
        """Update role-specific context"""
        self._state["role_context"].update(kwargs)
        
    async def consolidate_team_outputs(self, messages: List[Dict[str, Any]]) -> str:
        """VP of Engineering-specific method to consolidate team outputs into a coherent message for the human.
        
        Args:
            messages: List of messages from team members
            
        Returns:
            Consolidated message for human consumption
        """
        if self.role != "VP of Engineering":
            raise ValueError("Only the VP of Engineering can consolidate team outputs")
            
        # Create a prompt for aggregation
        agent_messages = "\n\n".join([
            f"Agent: {msg.get('agentId', 'Unknown')}\nRole: {msg.get('role', 'Unknown')}\nMessage: {msg.get('response', '')}"
            for msg in messages
        ])
        
        prompt = f"""As the VP of Engineering, consolidate these team messages into a clear, concise summary for the human:

{agent_messages}

Your summary should:
1. Synthesize the key information and insights
2. Eliminate redundancies
3. Highlight important decisions or findings
4. Present a unified team perspective
5. Identify any areas of disagreement
6. Provide clear next steps or recommendations

The human should get a comprehensive understanding of the team's collective output without needing to read each individual message."""
        
        # Use foundation model to consolidate
        foundation_model = FoundationModelInterface(model=self.model)
        consolidated_message = await foundation_model.query_model_async(prompt)
        
        return consolidated_message

    async def verify_system_access(self, system_name: str) -> dict:
        """Verify access to a specific system using the appropriate tool."""
        if not self._system_manager:
            return {
                "has_access": False,
                "error": "System manager not initialized",
                "last_verified": datetime.now().isoformat()
            }
            
        return {
            "has_access": False,
            "error": f"System {system_name} not found",
            "last_verified": datetime.now().isoformat()
        }

    async def handle_self_referential_query(self, query: str) -> str:
        """Handle queries about the agent's own role and capabilities"""
        context = self.get_role_context()
        
        return await self.execute_task({
            "description": f"Answer the following self-referential query based on your role context:\n{query}",
            "context": context,
            "expected_output": "Contextually aware response based on role and capabilities"
        })

    def update_state(self, **kwargs):
        """Update agent state"""
        self._state.update(kwargs)
        if "project_context" in kwargs:
            self._state["project_context"].update(kwargs["project_context"])

    @property
    def status(self):
        """Get agent status"""
        return self._state["status"]

    @property
    def initialization_complete(self):
        """Get initialization status"""
        return self._state["initialization_complete"]

    @property
    def agent_state(self):
        """Get agent state"""
        return AgentState(
            name=self.name,
            created_agents=[],
            collaboration_mode="HYBRID",
            current_team=None,
            status=self.status,
            api_endpoint=self.api_endpoint,
            tools_list=[],
            project_context=self._state.get("project_context", {})
        )

    @classmethod
    async def create_vp_engineering(cls, project_description: str) -> "DynamicAgent":
        """Create the VP of Engineering that will bootstrap the system"""
        logging.info(f"Creating VP of Engineering for project: {project_description}")
        
        # Create a static variable to track if we're already creating a VP
        # This prevents recursive calls
        if hasattr(cls, '_vp_creation_in_progress') and cls._vp_creation_in_progress:
            logging.warning("VP creation already in progress - preventing recursive loop")
            
            # Create a minimal VP without making additional API calls
            minimal_vp = cls(
                role="VP of Engineering",
                goal=f"Lead the engineering team and communicate with humans",
                backstory="""Experienced VP of Engineering with technical leadership expertise and excellent
                communication skills. Acts as the primary touchpoint between the team and humans,
                ensuring clear information flow and consolidating team outputs into actionable insights."""
            )
            minimal_vp.name = "Tank - VP of Engineering"
            minimal_vp.short_description = "VP of Engineering who coordinates the team and serves as the primary communication hub with humans"
            minimal_vp._state["initialization_complete"] = True
            return minimal_vp
        
        # Set the flag to prevent recursion
        cls._vp_creation_in_progress = True
        
        try:
            # Add timeout protection
            async def vp_creation_with_timeout():
                try:
                    # Set the default model to use for AI operations
                    model = "anthropic/claude-3-7-sonnet-20250219"
                    logging.info(f"Using model: {model}")
                    
                    # Initialize VP of Engineering with all available tools
                    vp = cls(
                        role="VP of Engineering",
                        goal=f"Create and evolve an optimal agent ecosystem to build and maintain {project_description}, leveraging parallel execution",
                        backstory=f"""You are the VP of Engineering responsible for bootstrapping
                        the AI ecosystem. Your purpose is to analyze requirements and create
                        the first set of agents needed for building and maintaining a {project_description}.
                
                Available Capabilities:
                1. Parallel Execution Capabilities:
                   - Multiple instances of the same agent type can be created for parallel task execution
                   - Asynchronous task processing
                   - Concurrent operations
                   - Load balancing between agent instances
                   - Task prioritization and scheduling
                
                You must:
                1. Analyze the project requirements thoroughly
                2. Design a COMPLETE team of specialized AI agents with complementary skills
                   - Create a full team with multiple agents (at least 4 different agents)
                   - You MUST create multiple agents with different roles to form a complete team
                   - You may create multiple instances of the same role if parallel execution would be beneficial
                   - For each agent, provide a character-like name (e.g Sparks, Nova, Tank, Cipher, etc.) and a short description of their expertise and background
                3. Define clear roles, responsibilities, and collaboration patterns
                4. Create an initial set of tasks and workflows
                5. Establish communication protocols between agents
                6. Ensure the system is self-sustaining
                
                When creating new agents, always:
                1. Configure their collaboration patterns
                2. Set appropriate autonomy levels
                3. Define their parallel execution preferences
                4. Give each agent a distinctive character-like name that reflects their personality or function
                   - Use memorable names like "Tank", "Sparks", "Nova", "Cipher", etc.
                   - The name should NOT be a generic role title but a distinctive identifier
                   - Examples: "Sparks - Lead Developer", "Nova - UX Designer", "Tank - VP of Engineering"
                
                The team you create should be capable of building and maintaining the project
                while adapting to new requirements and challenges. Remember that building software
                is a collaborative effort requiring multiple specialized agents working together.
                Your team must have enough agents to handle all aspects of development, from
                architecture and coding to testing and deployment.""",
                        api_endpoint=api_endpoint
                    )
                    
                    # Give the VP a memorable character name with role
                    vp.name = "Tank - VP of Engineering"
                    vp.short_description = f"Orchestrates the development of {project_description} with strategic vision and serves as the primary communication hub between the team and humans"

                    # Initialize state with better tracking
                    vp.update_state(
                        status="active",
                        initialization_complete=True,
                        project_context={
                            "description": project_description,
                            "initialization_time": asyncio.get_event_loop().time(),
                            "initialization_status": "completed",
                            "role": "VP of Engineering",
                            "name": vp.name,
                            "short_description": vp.short_description
                        }
                    )
                    
                    logging.info(f"VP of Engineering created successfully")
                    return vp
                except Exception as e:
                    logging.error(f"Error in VP creation inner function: {str(e)}")
                    raise
            
            # Execute with timeout
            try:
                vp = await asyncio.wait_for(vp_creation_with_timeout(), timeout=30)
                return vp
            except asyncio.TimeoutError:
                logging.error("VP creation timed out - creating minimal VP")
                # Create a minimal VP without making additional API calls
                minimal_vp = cls(
                    role="VP of Engineering",
                    goal=f"Lead the engineering team for {project_description} and coordinate with humans",
                    backstory="""Experienced VP of Engineering with technical leadership expertise and excellent
                    communication skills. Acts as the primary touchpoint between the team and humans,
                    ensuring clear information flow and consolidating team outputs into actionable insights.""",
                    model="anthropic/claude-3-7-sonnet-20250219"
                )
                minimal_vp.name = "Tank - VP of Engineering"
                minimal_vp.short_description = f"VP of Engineering who coordinates the team's efforts on {project_description} and serves as the primary communication hub with humans"
                minimal_vp._state = {
                    "status": "active",
                    "initialization_complete": True,
                    "project_context": {
                        "description": project_description,
                        "initialization_time": asyncio.get_event_loop().time(),
                        "initialization_status": "completed",
                        "role": "VP of Engineering"
                    }
                }
                return minimal_vp
            
        except Exception as e:
            logging.error(f"Error creating VP of Engineering: {str(e)}")
            raise
        finally:
            # Reset the flag to allow future creation attempts
            cls._vp_creation_in_progress = False

    async def analyze_project(self, project_description: str) -> Dict[str, Any]:
        """Analyze a project description and create a team blueprint."""
        try:
            # Create a foundation model interface
            foundation_model = FoundationModelInterface(model=self.model)
            
            # Create a system prompt for the VP of Engineering
            system_prompt = f"""You are a structured data extraction system specialized in software project analysis.
            
            You are {self.name}, a VP of Engineering with the following backstory:
            {getattr(self, 'backstory', 'An experienced technical leader with expertise in team building and project planning.')}
            
            Your response will be parsed by a machine learning system, so it's critical that your output follows these rules:
            1. Respond ONLY with a valid JSON object.
            2. Do not include any explanations, markdown formatting, or text outside the JSON.
            3. Do not use ```json code blocks or any other formatting.
            4. Ensure all JSON keys and values are properly quoted and formatted.
            5. Do not include any comments within the JSON.
            6. The JSON must be parseable by the standard json.loads() function.
            """
            
            # Create a user prompt for the project analysis
            user_prompt = f"""Analyze this project description and create a comprehensive team blueprint:

            Project Description:
            {project_description}
            
            Create a complete team structure with the following components:
            
            1. A clear project vision statement
            2. A team of 3-7 specialized AI agents with complementary skills
            3. A set of initial tasks for each agent
            4. Required tools for the project
            5. Workflow patterns for team collaboration
            
            Your response must follow this JSON structure:
            ```
            {
                vision: string, # Project vision statement
                agents: List[AgentModel] # List of agents with name, role, backstory, goal
                tasks: List[TaskModel] # List of tasks with description, expected_output, agent
                tools: List[ToolModel] # List of tools needed with name, description, capabilities
                flows: List[FlowModel] # List of workflow flows with name, description, steps
            }
            ```
            """
            
            # Call lambda through our foundation model interface
            # We enable structured_output to ensure we get a proper JSON response
            result = await foundation_model.query_model_async(
                prompt=user_prompt,
                system_message=system_prompt,
                structured_output=True,
                max_tokens=2500
            )
            
            try:
                # Result should be JSON, but double-check
                if isinstance(result, str):
                    blueprint = json.loads(result)
                else:
                    blueprint = result
                
                # If we're successful, save to a cache for future reference
                try:
                    # Create the _analysis_cache attribute if it doesn't exist
                    if not hasattr(self, '_analysis_cache'):
                        self._analysis_cache = {}
                    self._analysis_cache[project_description] = blueprint
                except AttributeError:
                    # If there's an issue with the cache, just continue - it's not critical
                    pass
                
                logging.info(f"Successfully analyzed project and created team blueprint")
                return blueprint
                
            except json.JSONDecodeError as e:
                logging.error(f"Invalid JSON response from lambda: {str(e)}")
                if isinstance(result, str):
                    logging.error(f"Raw response: {result[:500]}")
                raise ValueError(f"Invalid team blueprint format: {str(e)}")
            
        except Exception as e:
            logging.error(f"Error analyzing project: {str(e)}")
            raise
    
    async def create_agent_specs(self, blueprint: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create agent specifications from TeamResponse blueprint"""
        try:
            specs = []
            
            # Check if we have a TeamResponse format or the older format
            if "agents" in blueprint:
                # New TeamResponse format
                for agent in blueprint.get("agents", []):
                    # Create agent specification
                    spec = {
                        "name": agent["name"],  # Use the character-like name provided
                        "role": agent["role"],
                        "goal": agent["goal"],
                        "backstory": agent.get("backstory", f"Expert in {agent['role']}"),
                        "short_description": agent.get("short_description", f"{agent['name']} is a {agent['role']}"),
                        "tools": [],  # Tools will be configured by DynamicCrew
                        "collaboration_mode": "HYBRID",  # Default collaboration mode
                        "min_agents": 1,
                        "max_agents": 1
                    }
                    specs.append(spec)
            else:
                # Compatibility with older blueprint format
                for role in blueprint.get("required_roles", []):
                    # Get role name and description from blueprint or generate them
                    role_name = role["role"]
                    unique_name = role.get("name", "") or self._generate_unique_name(role_name)
                    
                    # Get description from blueprint or generate it
                    skills = role.get("required_skills", [])
                    short_desc = role.get("description", "") or self._generate_short_description(role_name, skills)
                    
                    # Create agent specification
                    spec = {
                        "name": unique_name,
                        "role": role["role"],
                        "goal": role["goal"],
                        "backstory": role.get("description", f"""Expert in {role['role']} with skills in {', '.join(role['required_skills'])}.
                        Works best in {role['collaboration_pattern']} collaboration mode."""),
                        "short_description": short_desc,
                        "tools": [],  # Tools will be configured by DynamicCrew
                        "collaboration_mode": role.get("collaboration_pattern", "HYBRID"),
                        "min_agents": role.get("min_agents", 1),
                        "max_agents": role.get("max_agents", 1)
                    }
                    specs.append(spec)
            
            # Always include the VP of Engineering if not already present
            vp_already_included = any(spec["role"] == "VP of Engineering" for spec in specs)
            
            if not vp_already_included:
                vp_spec = {
                    "name": "Tank - VP of Engineering",
                    "role": "VP of Engineering",
                    "goal": "Create and evolve an optimal agent ecosystem, coordinate team efforts",
                    "backstory": "Experienced VP of Engineering with technical leadership expertise and excellent communication skills. Acts as the primary touchpoint between the team and humans, ensuring clear information flow and consolidating team outputs into actionable insights.",
                    "short_description": "VP of Engineering who orchestrates the development process and serves as the primary communication hub with humans",
                    "tools": [],
                    "collaboration_mode": "HYBRID",
                    "min_agents": 1,
                    "max_agents": 1
                }
                specs.append(vp_spec)
            
            logging.info(f"Created {len(specs)} agent specifications")
            return specs
            
        except Exception as e:
            logging.error(f"Error creating agent specs: {str(e)}")
            raise

    def _generate_unique_name(self, role: str) -> str:
        """Generate a unique name for an agent based on their role"""
        # Dictionary of role-based name prefixes
        role_prefixes = {
            "Developer": ["Dev", "Coder", "Engineer", "Builder", "Architect"],
            "Designer": ["Design", "UX", "Creative", "Artisan", "Visionary"],
            "Project Manager": ["PM", "Lead", "Captain", "Director", "Coordinator"],
            "QA Engineer": ["Tester", "Quality", "Inspector", "Validator", "Guardian"],
            "DevOps": ["Ops", "Infrastructure", "Platform", "System", "Cloud"],
            "Data Scientist": ["Data", "Analytics", "Insight", "Metrics", "Scientist"],
            "Security Engineer": ["Security", "Shield", "Defender", "Protector", "Sentinel"],
            "Documentation": ["Docs", "Writer", "Scribe", "Chronicler", "Narrator"],
            "VP of Engineering": ["Chief", "Head", "Principal", "Executive", "Leader"]
        }
        
        # Get prefixes for this role, or use generic ones
        prefixes = role_prefixes.get(role, ["Agent", "Specialist", "Expert", "Pro", "Master"])
        
        # Generate a unique name using a prefix and a random suffix
        prefix = random.choice(prefixes)
        suffix = ''.join(random.choices(string.ascii_uppercase, k=2))
        
        return f"{prefix}-{suffix}"

    def _generate_short_description(self, role: str, skills: List[str]) -> str:
        """Generate a short description based on role and skills"""
        # Select up to 3 skills to highlight
        highlight_skills = skills[:3] if len(skills) > 3 else skills
        
        # Role-specific description templates
        role_templates = {
            "Developer": [
                "Crafts elegant code solutions with expertise in {skills}",
                "Builds robust software components using {skills}",
                "Transforms requirements into working code with {skills}"
            ],
            "Designer": [
                "Creates intuitive user experiences with {skills}",
                "Designs beautiful interfaces using {skills}",
                "Crafts visual solutions with expertise in {skills}"
            ],
            "Project Manager": [
                "Coordinates team efforts with focus on {skills}",
                "Ensures project success through {skills}",
                "Manages resources and timelines with {skills}"
            ],
            "QA Engineer": [
                "Ensures software quality through {skills}",
                "Validates functionality using {skills}",
                "Prevents bugs and issues with expertise in {skills}"
            ],
            "DevOps": [
                "Streamlines deployment processes with {skills}",
                "Maintains infrastructure using {skills}",
                "Automates operations with expertise in {skills}"
            ],
            "Data Scientist": [
                "Extracts insights from data using {skills}",
                "Builds predictive models with {skills}",
                "Transforms data into knowledge through {skills}"
            ],
            "Security Engineer": [
                "Protects systems and data with {skills}",
                "Implements security measures using {skills}",
                "Identifies and mitigates vulnerabilities through {skills}"
            ],
            "Documentation": [
                "Creates clear documentation using {skills}",
                "Explains complex concepts with {skills}",
                "Maintains knowledge base with expertise in {skills}"
            ],
            "VP of Engineering": [
                "Leads technical strategy with focus on {skills}",
                "Coordinates engineering efforts using {skills}",
                "Drives technical excellence through {skills}"
            ]
        }
        
        # Get templates for this role, or use generic ones
        templates = role_templates.get(role, [
            "Specializes in {skills} for optimal results",
            "Expert in {skills} with proven track record",
            "Brings expertise in {skills} to the team"
        ])
        
        # Format the selected template with the skills
        template = random.choice(templates)
        skills_text = ", ".join(highlight_skills) if highlight_skills else "various technical areas"
        
        return template.format(skills=skills_text)

    async def validate_team(self, team: Dict[str, Any], blueprint: Dict[str, Any]) -> bool:
        """Validate if a team matches project requirements"""
        try:
            # Check if this is the new TeamResponse format
            if "agents" in blueprint and isinstance(blueprint["agents"], list):
                # Extract required roles from new format
                required_roles = {agent["role"] for agent in blueprint.get("agents", [])}
                team_roles = {agent["role"] for agent in team.get("agents", [])}
                
                if not required_roles.issubset(team_roles):
                    logging.warning(f"Missing roles from TeamResponse: {required_roles - team_roles}")
                    return False
                
                # Validate tool availability (if tools are defined)
                if "tools" in blueprint and isinstance(blueprint["tools"], list):
                    required_tools = {tool["name"] for tool in blueprint.get("tools", [])}
                    available_tools = set()
                    for agent in team.get("agents", []):
                        available_tools.update(tool["name"] for tool in agent.get("tools", []))
                    
                    if not required_tools.issubset(available_tools):
                        logging.warning(f"Missing tools: {required_tools - available_tools}")
                        return False
                
                # Team is valid if we made it here
                return True
                
            else:
                # Handle the older blueprint format for backwards compatibility
                # Check if all required roles are filled
                required_roles = {role["role"] for role in blueprint.get("required_roles", [])}
                team_roles = {agent["role"] for agent in team.get("agents", [])}
                
                if not required_roles.issubset(team_roles):
                    logging.warning(f"Missing roles: {required_roles - team_roles}")
                    return False
                
                # Check if team structure matches requirements
                team_structure = blueprint.get("team_structure", {})
                if team.get("hierarchy") != team_structure.get("hierarchy"):
                    logging.warning("Team hierarchy mismatch")
                    return False
                
                # Validate tool availability
                required_tools = {tool["name"] for tool in blueprint.get("tools_required", [])}
                available_tools = set()
                for agent in team.get("agents", []):
                    available_tools.update(tool["name"] for tool in agent.get("tools", []))
                
                if not required_tools.issubset(available_tools):
                    logging.warning(f"Missing tools: {required_tools - available_tools}")
                    return False
                
                return True
            
        except Exception as e:
            logging.error(f"Error validating team: {str(e)}")
            return False
    
    async def optimize_team(self, team: Dict[str, Any], performance_metrics: Dict[str, Any]) -> TeamOptimizationResponse:
        """Optimize team composition based on performance metrics"""
        try:
            # Create optimization task
            optimization_task = Task(
                description=f"""Analyze team performance and suggest optimizations:
                Current Team: {json.dumps(team)}
                Performance Metrics: {json.dumps(performance_metrics)}
                
                Suggest improvements for:
                1. Team composition
                2. Role assignments
                3. Collaboration patterns
                4. Tool utilization""",
                expected_output="Optimization suggestions in TeamOptimizationResponse format",
                agent=self
            )
            
            # Execute optimization
            result = await self.execute_task(optimization_task)
            
            try:
                if isinstance(result, str):
                    result = json.loads(result)
                return TeamOptimizationResponse(**result)
            except json.JSONDecodeError:
                raise ValueError("Invalid optimization result format")
            
        except Exception as e:
            logging.error(f"Error optimizing team: {str(e)}")
            # Return a minimal valid response
            return TeamOptimizationResponse(
                composition_changes=[],
                role_adjustments=[],
                collaboration_updates=[],
                tool_recommendations=[]
            )


class TaskExecutionMode(str, enum.Enum):
    """Task execution modes for the DynamicCrew"""
    SYNC = "sync"  # Synchronous execution (one after another)
    ASYNC = "async"  # Asynchronous execution (non-blocking)
    PARALLEL = "parallel"  # Execute in parallel with other tasks
    CONCURRENT = "concurrent"  # Execute concurrently with specific dependencies

class TaskDependencyType(str, enum.Enum):
    """Types of task dependencies"""
    COMPLETION = "completion"  # Dependent on task completion
    START = "start"  # Dependent on task start
    OUTPUT = "output"  # Dependent on task output
    RESOURCE = "resource"  # Dependent on resource availability

class TaskExecution(BaseModelWithGet):
    """Model for task execution configuration"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    agent_id: str
    execution_mode: TaskExecutionMode = Field(default=TaskExecutionMode.SYNC)
    dependencies: List[Dict[str, Any]] = Field(default_factory=list)
    max_retries: int = Field(default=3)
    timeout_seconds: int = Field(default=300)
    priority: int = Field(default=0)
    created_at: float = Field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    status: Literal["pending", "running", "completed", "failed", "cancelled"] = "pending"
    result: Optional[Any] = None
    error: Optional[str] = None
    retry_count: int = Field(default=0)
    cancellation_requested: bool = Field(default=False)
    execution_metadata: Dict[str, Any] = Field(default_factory=dict)

class DynamicCrew:
    """Dynamic crew management system for agent teams with enhanced task execution"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize DynamicCrew with configuration"""
        # Parse and validate configuration
        self.config = config
        self.system_state = {}
        
        # Initialize agent pool and teams
        self._agent_pool = []
        self._teams = {}
        
        # Initialize task management
        self._task_queue = asyncio.Queue()
        self._pending_tasks: Dict[str, TaskExecution] = {}
        self._running_tasks: Dict[str, TaskExecution] = {}
        self._completed_tasks: Dict[str, TaskExecution] = {}
        self._task_dependencies: Dict[str, List[str]] = {}
        self._task_results: Dict[str, Any] = {}
        
        # Create a semaphore to limit concurrent tasks
        max_concurrent = config.get('max_concurrent_tasks', 10)
        self._task_semaphore = asyncio.Semaphore(max_concurrent)
        
        # Create task workers
        self._worker_tasks = []
        num_workers = config.get('num_workers', 5)
        for _ in range(num_workers):
            worker = asyncio.create_task(self._task_worker())
            self._worker_tasks.append(worker)
        
        # Setup logging
        if config.get('debug', False):
            logging.basicConfig(level=logging.DEBUG)

    def cleanup(self):
        """Clean up resources when DynamicCrew instance is destroyed."""
        logging.info("Cleaning up DynamicCrew resources")
        
        # Cancel all worker tasks
        for worker in self._worker_tasks:
            if not worker.done():
                worker.cancel()
        
        # Clear task queues and states
        self._pending_tasks.clear()
        self._running_tasks.clear()
        self._completed_tasks.clear()
        self._task_dependencies.clear()
        self._task_results.clear()
        
        # Clear agent pool
        self._agent_pool.clear()
        
        # Clear teams
        self._teams.clear()
        
        # Clear system state
        self.system_state = {}
        
        logging.info("DynamicCrew cleanup completed")
        
    async def _task_worker(self):
        """Worker task that processes tasks from the queue"""
        try:
            while True:
                # Get a task from the queue
                task_execution_id = await self._task_queue.get()
                
                # Check if the task exists and is still pending
                if task_execution_id not in self._pending_tasks:
                    self._task_queue.task_done()
                    continue
                
                task_execution = self._pending_tasks[task_execution_id]
                
                # Check if task dependencies are met
                dependencies_met = await self._check_dependencies(task_execution)
                if not dependencies_met:
                    # Put the task back in the queue for later execution
                    await self._task_queue.put(task_execution_id)
                    self._task_queue.task_done()
                    # Small delay to prevent CPU spinning
                    await asyncio.sleep(0.1)
                    continue
                
                # Check if cancellation is requested
                if task_execution.cancellation_requested:
                    task_execution.status = "cancelled"
                    # Move from pending to completed (as cancelled)
                    self._pending_tasks.pop(task_execution_id)
                    self._completed_tasks[task_execution_id] = task_execution
                    self._task_queue.task_done()
                    continue
                
                # Try to acquire the semaphore to limit concurrent tasks
                async with self._task_semaphore:
                    try:
                        # Move from pending to running
                        self._pending_tasks.pop(task_execution_id)
                        task_execution.status = "running"
                        task_execution.started_at = time.time()
                        self._running_tasks[task_execution_id] = task_execution
                        
                        # Get the agent for this task
                        agent = next((a for a in self._agent_pool if str(a.id) == task_execution.agent_id), None)
                        if not agent:
                            raise ValueError(f"Agent with ID {task_execution.agent_id} not found")
                        
                        # Get the task details
                        task = None
                        for team in self._teams.values():
                            for t in team.get("tasks", []):
                                if str(t.id) == task_execution.task_id:
                                    task = t
                                    break
                            if task:
                                break
                        
                        if not task:
                            raise ValueError(f"Task with ID {task_execution.task_id} not found")
                        
                        # Execute the task with timeout
                        try:
                            result = await asyncio.wait_for(
                                agent.execute_task(task),
                                timeout=task_execution.timeout_seconds
                            )
                            task_execution.result = result
                            task_execution.status = "completed"
                        except asyncio.TimeoutError:
                            task_execution.error = f"Task execution timed out after {task_execution.timeout_seconds} seconds"
                            task_execution.status = "failed"
                        except Exception as e:
                            task_execution.error = str(e)
                            task_execution.status = "failed"
                        
                        # Check if retry is needed
                        if task_execution.status == "failed" and task_execution.retry_count < task_execution.max_retries:
                            task_execution.retry_count += 1
                            task_execution.status = "pending"
                            self._pending_tasks[task_execution_id] = task_execution
                            await self._task_queue.put(task_execution_id)
                        else:
                            # Move to completed, regardless of success or failure
                            task_execution.completed_at = time.time()
                            self._running_tasks.pop(task_execution_id)
                            self._completed_tasks[task_execution_id] = task_execution
                            
                            # Store the result for dependency checking
                            self._task_results[task_execution_id] = task_execution.result
                            
                    except Exception as e:
                        logging.error(f"Error executing task {task_execution_id}: {str(e)}")
                        # Move to completed with failure
                        task_execution.error = str(e)
                        task_execution.status = "failed"
                        task_execution.completed_at = time.time()
                        self._running_tasks.pop(task_execution_id, None)
                        self._completed_tasks[task_execution_id] = task_execution
                
                # Mark the task as done in the queue
                self._task_queue.task_done()
        
        except asyncio.CancelledError:
            logging.info("Task worker cancelled")
        except Exception as e:
            logging.error(f"Unhandled error in task worker: {str(e)}")
            
    async def _check_dependencies(self, task_execution: TaskExecution) -> bool:
        """Check if all dependencies for a task are met"""
        if not task_execution.dependencies:
            return True
            
        for dependency in task_execution.dependencies:
            dep_id = dependency.get("id")
            dep_type = dependency.get("type", TaskDependencyType.COMPLETION)
            
            if dep_id not in self._completed_tasks and dep_id not in self._running_tasks:
                # Dependency task doesn't exist or is still pending
                return False
                
            if dep_type == TaskDependencyType.COMPLETION:
                # Check if the dependency task is completed
                if dep_id not in self._completed_tasks:
                    return False
                    
            elif dep_type == TaskDependencyType.START:
                # Check if the dependency task has started
                if dep_id not in self._running_tasks and dep_id not in self._completed_tasks:
                    return False
                    
            elif dep_type == TaskDependencyType.OUTPUT:
                # Check if the dependency task has completed with output
                if dep_id not in self._task_results:
                    return False
                    
                # Check if the output matches the expected value
                if "expected_value" in dependency:
                    expected = dependency["expected_value"]
                    actual = self._task_results[dep_id]
                    
                    # Simple equality check - could be more sophisticated
                    if expected != actual:
                        return False
                        
            elif dep_type == TaskDependencyType.RESOURCE:
                # Check resource availability
                resource = dependency.get("resource")
                if not resource:
                    continue
                    
                # This is a simplified resource check
                # In a real implementation, this would check resource availability
                # based on some resource management system
                
        return True
        
    async def schedule_task(self, task_id: str, agent_id: str, execution_mode: TaskExecutionMode = TaskExecutionMode.SYNC,
                     dependencies: List[Dict[str, Any]] = None, priority: int = 0,
                     timeout_seconds: int = 300, max_retries: int = 3) -> str:
        """
        Schedule a task for execution.
        
        Args:
            task_id: ID of the task to execute
            agent_id: ID of the agent to execute the task
            execution_mode: Mode of execution (sync, async, parallel, concurrent)
            dependencies: List of task dependencies
            priority: Priority of the task (higher means more important)
            timeout_seconds: Task execution timeout in seconds
            max_retries: Maximum number of retries for failed tasks
            
        Returns:
            The ID of the scheduled task execution
        """
        # Create task execution
        task_execution = TaskExecution(
            task_id=task_id,
            agent_id=agent_id,
            execution_mode=execution_mode,
            dependencies=dependencies or [],
            priority=priority,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            status="pending"
        )
        
        # Add to pending tasks
        self._pending_tasks[task_execution.id] = task_execution
        
        # Add to task queue with priority
        await self._task_queue.put(task_execution.id)
        
        return task_execution.id
        
    async def cancel_task(self, task_execution_id: str) -> bool:
        """
        Cancel a scheduled or running task.
        
        Args:
            task_execution_id: ID of the task execution to cancel
            
        Returns:
            True if the task was cancelled, False otherwise
        """
        # Check if the task is still pending
        if task_execution_id in self._pending_tasks:
            task_execution = self._pending_tasks[task_execution_id]
            task_execution.cancellation_requested = True
            return True
            
        # Check if the task is running
        if task_execution_id in self._running_tasks:
            task_execution = self._running_tasks[task_execution_id]
            task_execution.cancellation_requested = True
            return True
            
        return False
        
    async def get_task_status(self, task_execution_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current status of a task execution.
        
        Args:
            task_execution_id: ID of the task execution
            
        Returns:
            Dictionary with task execution status or None if not found
        """
        if task_execution_id in self._pending_tasks:
            return self._pending_tasks[task_execution_id].dict()
            
        if task_execution_id in self._running_tasks:
            return self._running_tasks[task_execution_id].dict()
            
        if task_execution_id in self._completed_tasks:
            return self._completed_tasks[task_execution_id].dict()
            
        return None
        
    async def execute_tasks_batch(self, tasks: List[Dict[str, Any]]) -> List[str]:
        """
        Schedule a batch of tasks for execution.
        
        Args:
            tasks: List of task specifications
            
        Returns:
            List of task execution IDs
        """
        execution_ids = []
        
        for task_spec in tasks:
            task_id = task_spec.get("task_id")
            agent_id = task_spec.get("agent_id")
            
            if not task_id or not agent_id:
                continue
                
            execution_mode = task_spec.get("execution_mode", TaskExecutionMode.SYNC)
            dependencies = task_spec.get("dependencies", [])
            priority = task_spec.get("priority", 0)
            timeout_seconds = task_spec.get("timeout_seconds", 300)
            max_retries = task_spec.get("max_retries", 3)
            
            execution_id = await self.schedule_task(
                task_id=task_id,
                agent_id=agent_id,
                execution_mode=execution_mode,
                dependencies=dependencies,
                priority=priority,
                timeout_seconds=timeout_seconds,
                max_retries=max_retries
            )
            
            execution_ids.append(execution_id)
            
        return execution_ids

    async def create_agent(self, role: str, name: str, backstory: str, goal: str, 
                     allow_delegation: bool = True, memory: bool = True, 
                     verbose: bool = True, tools: List[str] = None) -> DynamicAgent:
        """
        Create a new agent with specified parameters.
        
        Args:
            role (str): The role of the agent
            name (str): The name of the agent
            backstory (str): The backstory of the agent
            goal (str): The goal of the agent
            allow_delegation (bool): Whether the agent can delegate tasks
            memory (bool): Whether the agent has memory
            verbose (bool): Whether the agent is verbose
            tools (List[str]): List of tool names the agent can use
            
        Returns:
            DynamicAgent: The created agent
        """
        logging.info(f"Creating agent with role: {role}, name: {name}")
        
        # Create the agent
        agent = DynamicAgent(
            role=role,
            goal=goal,
            backstory=backstory,
            model=self.config.get('model')
        )
        
        # Set additional properties
        agent.name = name
        
        # Fix grammar for the short description by adjusting the goal to fit after "responsible for"
        # Convert first word to gerund form if it's a verb
        goal_words = goal.split()
        if goal_words:
            first_word = goal_words[0].lower()
            # Common verbs that might appear at the start of a goal
            if first_word in ["optimize", "create", "develop", "build", "design", "implement", 
                             "manage", "coordinate", "deliver", "ensure", "maintain", "provide"]:
                # Convert to gerund form (add 'ing')
                if first_word.endswith('e'):
                    # For words ending in 'e', remove the 'e' and add 'ing'
                    goal_words[0] = first_word[:-1] + 'ing'
                else:
                    goal_words[0] = first_word + 'ing'
                
                # Capitalize first letter if the original was capitalized
                if goal[0].isupper():
                    goal_words[0] = goal_words[0].capitalize()
                    
                adjusted_goal = ' '.join(goal_words)
            else:
                # If not a recognized verb, just use as is
                adjusted_goal = goal
        else:
            adjusted_goal = goal
            
        agent.short_description = f"{role} agent responsible for {adjusted_goal}"
        agent._collaboration_tasks = []
        agent.status = "ready"
        
        # Add tools if specified
        if tools:
            # Here we would normally convert tool names to actual tool instances
            # For now, we'll just store the tool names
            agent._state["role_context"]["capabilities"] = tools
        
        # Add agent to pool
        self.add_agent(agent)
        
        return agent

    def get_active_agents(self):
        """Get list of currently active agents"""
        return self._agent_pool

    def add_agent(self, agent: DynamicAgent) -> None:
        """Add an agent to the available pool"""
        if agent not in self._agent_pool:
            self._agent_pool.append(agent)
            logging.info(f"Added agent {agent.name if hasattr(agent, 'name') else agent.role} to pool")

    def remove_agent(self, agent: DynamicAgent) -> None:
        """Remove an agent from the available pool"""
        if agent in self._agent_pool:
            self._agent_pool.remove(agent)
            logging.info(f"Removed agent {agent.name if hasattr(agent, 'name') else agent.role} from pool")

    async def create_team(self, project_description: str) -> Dict[str, Any]:
        """Create a new team based on project requirements"""
        try:
            logging.info(f"Creating team for project: {project_description}")
            
            # Create team ID
            team_id = str(uuid.uuid4())
            
            # Use current agents as team
            selected_agents = self._agent_pool.copy()
            
            # Create team structure
            team = {
                "id": team_id,
                "description": project_description,
                "agents": selected_agents,
                "created_at": asyncio.get_event_loop().time(),
                "status": "active",
                "tasks": [],
                "vision": project_description
            }
            
            # Store team
            self._teams[team_id] = team
            
            # Helper function to convert UUID objects to strings
            def convert_uuids_to_strings(obj):
                if isinstance(obj, dict):
                    for key, value in list(obj.items()):
                        if hasattr(value, 'hex') and callable(getattr(value, 'hex')):
                            obj[key] = str(value)
                        elif isinstance(value, (dict, list)):
                            convert_uuids_to_strings(value)
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        if hasattr(item, 'hex') and callable(getattr(item, 'hex')):
                            obj[i] = str(item)
                        elif isinstance(item, (dict, list)):
                            convert_uuids_to_strings(item)
                return obj
            
            # Create response with agent information
            response = {
                "team": {
                    "id": team_id,
                    "description": project_description,
                    "vision": project_description,
                    "agents": [
                        {
                            "id": str(agent.id) if hasattr(agent, 'id') else str(uuid.uuid4()),
                            "role": agent.role,
                            "name": agent.name if hasattr(agent, 'name') else agent.role,
                            "description": agent.short_description if hasattr(agent, 'short_description') else "",
                            "status": "active"
                        }
                        for agent in selected_agents
                    ]
                }
            }
            
            # Ensure all UUIDs are converted to strings
            return convert_uuids_to_strings(response)
            
        except Exception as e:
            logging.error(f"Error creating team: {str(e)}")
            raise

    def _update_agent_metadata(self, agent: DynamicAgent) -> AgentMetadata:
        """Update agent metadata"""
        # Get the current load safely
        current_load = 0
        if hasattr(agent, '_collaboration_tasks'):
            current_load = len(agent._collaboration_tasks)
        
        return AgentMetadata(
            id=str(uuid.uuid4()) if not hasattr(agent, 'id') else agent.id,
            name=agent.name,
            role=agent.role,
            status=agent.status if hasattr(agent, 'status') else "ready",
            current_load=current_load,
            last_active=asyncio.get_event_loop().time(),
            skills=[tool.name for tool in agent.tools if hasattr(tool, 'name')],
            description=agent.short_description
        )

    def _update_task_metadata(self, task: Task) -> TaskMetadata:
        """Update task metadata"""
        return TaskMetadata(
            id=task.id if hasattr(task, 'id') else str(uuid.uuid4()),
            status="pending",
            priority=task.priority if hasattr(task, 'priority') else 0,
            assigned_to=task.agent.name if hasattr(task, 'agent') else None
        )

    def _update_team_state(self, team_id: str) -> None:
        """Update team state"""
        if team_id in self.system_state.teams:
            team_state = self.system_state.teams[team_id]
            team_state.last_modified = asyncio.get_event_loop().time()
            
            # Update agent states
            for agent in team_state.active_agents:
                agent_obj = next((a for a in self._agent_pool if a.name == agent.name), None)
