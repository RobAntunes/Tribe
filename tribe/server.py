"""Tribe Language Server implementation."""

import os
import sys
import json
import time
import logging
import asyncio
import traceback
from pygls.server import LanguageServer
from lsprotocol.types import (
    TEXT_DOCUMENT_DID_OPEN,
    TEXT_DOCUMENT_DID_CLOSE,
    TEXT_DOCUMENT_DID_CHANGE,
    INITIALIZE,
    INITIALIZED,
    SHUTDOWN,
    EXIT,
    InitializeParams,
    InitializeResult,
    MessageType,
    ServerCapabilities,
    TextDocumentSyncKind,
)
from crewai import LLM

# Configure logging to a file in the home directory to ensure we can write to it
log_file = os.path.expanduser("~/tribe-server.log")
logging.basicConfig(
    level=logging.DEBUG,  # More verbose logging
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Load environment variables from .env file if not already set
try:
    # Look for .env file in current directory and parent directories
    env_file_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        os.path.join(os.getcwd(), ".env")
    ]
    
    for env_path in env_file_paths:
        if os.path.isfile(env_path):
            logger.info(f"Loading environment variables from {env_path}")
            with open(env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        key, value = line.split('=', 1)
                        # Only set if not already in environment
                        if key not in os.environ or not os.environ[key]:
                            os.environ[key] = value
                            if 'KEY' in key or 'SECRET' in key or 'TOKEN' in key:
                                logger.info(f"Set {key} from {env_path}")
                            else:
                                logger.info(f"Set {key}={value} from {env_path}")
            # Break after loading the first .env file found
            break
except Exception as e:
    logger.error(f"Error loading .env file: {e}")
    logger.error(traceback.format_exc())

# Log startup information
logger.debug("=" * 80)
logger.debug("TRIBE SERVER STARTING")
logger.debug("=" * 80)

# Log environment for debugging
logger.debug(f"Python version: {sys.version}")
logger.debug(f"Current directory: {os.getcwd()}")
logger.debug(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
logger.debug(f"TRIBE_MODEL: {os.environ.get('TRIBE_MODEL', 'Not set')}")
logger.debug(f"TRIBE_DEBUG: {os.environ.get('TRIBE_DEBUG', 'Not set')}")

# Log all environment variables in debug mode
if os.environ.get('TRIBE_DEBUG') == 'true':
    logger.debug("Environment variables:")
    for key, value in sorted(os.environ.items()):
        # Don't log actual API keys, just their existence
        if 'KEY' in key or 'SECRET' in key or 'TOKEN' in key or 'PASSWORD' in key:
            logger.debug(f"  {key}: [REDACTED]")
        else:
            logger.debug(f"  {key}: {value}")

# Log Python path and modules
try:
    import sys
    logger.debug(f"sys.path: {sys.path}")
    
    # Log installed packages
    import pkg_resources
    installed_packages = [f"{d.project_name}=={d.version}" for d in pkg_resources.working_set]
    logger.debug(f"Installed packages: {installed_packages}")
except Exception as e:
    logger.error(f"Error logging packages: {e}")

# Try to create the server instance with exception handling
try:
    logger.debug("Creating LanguageServer instance...")
    tribe_server = LanguageServer("tribe-ls", "v1.0.0")
    logger.debug("LanguageServer instance created successfully")
    
    # Register server capabilities early in initialization
    # This registers standard capabilities like text document sync
    server_capabilities = {
        "textDocumentSync": {
            "openClose": True,
            "change": TextDocumentSyncKind.Full,
            "willSave": False,
            "willSaveWaitUntil": False,
            "save": {"includeText": False}
        },
        # Register the custom commands explicitly
        "executeCommandProvider": {
            "commands": ["tribe/createTeam", "tribe/analyzeRequirements"]
        }
    }
    logger.debug(f"Setting server capabilities: {server_capabilities}")
    
    # Patch JSONRPC protocol to ensure Content-Length headers
    # This is critical to prevent the Content-Length header error
    try:
        # Try to directly patch JSON-RPC response serialization
        if hasattr(tribe_server, '_jsonrpc_protocol_cls'):
            original_cls = tribe_server._jsonrpc_protocol_cls
            
            class PatchedJsonRpcProtocol(original_cls):
                """Patched protocol class to ensure Content-Length headers."""
                
                async def __write(self, message):
                    """Ensure proper headers before writing messages."""
                    try:
                        logger.debug(f"Writing message: {message}")
                        # Add jsonrpc field if missing
                        if isinstance(message, dict) and "jsonrpc" not in message:
                            message["jsonrpc"] = "2.0"
                        # Call original implementation
                        return await super().__write(message)
                    except Exception as e:
                        logger.error(f"Error in patched __write: {e}")
                        error_msg = {"jsonrpc": "2.0", "error": {"code": -32603, "message": str(e)}}
                        try:
                            return await super().__write(error_msg)
                        except Exception:
                            logger.error("Failed to send error message")
                            return None
            
            # Replace the protocol class
            tribe_server._jsonrpc_protocol_cls = PatchedJsonRpcProtocol
            logger.info("Successfully patched JSON-RPC protocol class")
        else:
            logger.info("Server does not have _jsonrpc_protocol_cls, trying direct patching")
            
            # Directly patch protocol handler if available
            if hasattr(tribe_server, '_protocol'):
                proto = tribe_server._protocol
                if hasattr(proto, 'write'):
                    original_write = proto.write
                    
                    async def patched_write(message):
                        """Ensure messages have proper format."""
                        try:
                            if isinstance(message, dict) and "jsonrpc" not in message:
                                message["jsonrpc"] = "2.0"
                            logger.debug(f"Writing patched message: {message}")
                            return await original_write(message)
                        except Exception as e:
                            logger.error(f"Error in patched write: {e}")
                            return None
                    
                    proto.write = patched_write
                    logger.info("Successfully patched protocol.write method")
            else:
                logger.info("No protocol object found, will patch at runtime")
    except Exception as e:
        logger.warning(f"Failed to patch JSON-RPC protocol: {e}")
        logger.warning("Communication errors may occur")
except Exception as e:
    logger.error(f"Error creating LanguageServer: {str(e)}")
    logger.error(traceback.format_exc())
    # Re-raise to fail fast if we can't create the server
    raise

# Global LLM variable
llm = None

# Initialize the LLM
def initialize_llm():
    global llm
    try:
        # Try to initialize the LLM - this will be used for handling requests
        model_name = os.environ.get("TRIBE_MODEL", "claude-3-sonnet-20240229")
        logger.info(f"Initializing LLM with model: {model_name}")
        
        # Check if API key is set and is not a placeholder
        api_key_set = ('ANTHROPIC_API_KEY' in os.environ and 
                       os.environ['ANTHROPIC_API_KEY'] and 
                       not os.environ['ANTHROPIC_API_KEY'].lower() in ['your-api-key-here', 'your_api_key', 'your-key-here', 'api-key'])
        
        # Log the API key status (without revealing the key)
        if 'ANTHROPIC_API_KEY' in os.environ:
            key_value = os.environ['ANTHROPIC_API_KEY']
            if key_value:
                # Only show first 4 and last 4 characters if longer than 8
                if len(key_value) > 8:
                    masked_key = f"{key_value[:4]}...{key_value[-4:]}"
                else:
                    masked_key = "[HIDDEN]"
                logger.info(f"ANTHROPIC_API_KEY found in environment: {masked_key}")
            else:
                logger.warning("ANTHROPIC_API_KEY is set but empty")
        else:
            logger.warning("ANTHROPIC_API_KEY not found in environment")
        
        # Create mock LLM only if API key is not set
        if not api_key_set:
            logger.warning("ANTHROPIC_API_KEY not set in environment, using mock LLM")
                
            # Create a mock LLM that just echoes back input
            class MockLLM:
                def __init__(self, model, temperature):
                    self.model = model
                    self.temperature = temperature
                    logger.debug(f"MockLLM created with model={model}, temp={temperature}")
                
                def call(self, messages=None, **kwargs):
                    logger.debug(f"MockLLM.call called with messages={messages}")
                    if messages and len(messages) > 0:
                        last_message = messages[-1].get('content', 'No content') if hasattr(messages[-1], 'get') else 'No content'
                    else:
                        last_message = 'No input'
                    return f"Mock response for input: {last_message}"
            
            llm = MockLLM(model=model_name, temperature=0.7)
            logger.info("Mock LLM initialized successfully")
            return True
            
        # Create the real LLM if we have a valid API key and didn't create a mock LLM above
        try:
            # Try to create the real LLM
            llm = LLM(model=model_name, temperature=0.7)
            logger.info("LLM initialized successfully with model: %s", model_name)
            return True
        except Exception as e:
            logger.error(f"Failed to initialize real LLM: {e}")
            logger.error(traceback.format_exc())
            
            # If we get here and we have no LLM yet, create a mock one
            if llm is None:
                logger.warning("Creating fallback mock LLM due to initialization error")
                class MockLLM:
                    def __init__(self, model, temperature):
                        self.model = model
                        self.temperature = temperature
                        logger.debug(f"Fallback MockLLM created with model={model}, temp={temperature}")
                    
                    def call(self, messages=None, **kwargs):
                        logger.debug(f"Fallback MockLLM.call called with messages={messages}")
                        return f"Fallback mock response - LLM initialization failed"
                
                llm = MockLLM(model=model_name, temperature=0.7)
            
            return False
    except Exception as e:
        logger.error(f"Error initializing LLM: {str(e)}")
        logger.error(traceback.format_exc())
        # Continue without crashing as the LLM might be initialized later
        return False

# Try to initialize the LLM on module load but don't crash if it fails
try:
    initialize_llm()
except Exception as e:
    logger.error(f"Unexpected error during LLM initialization: {str(e)}")
    logger.error(traceback.format_exc())

# Add error handlers to all LSP operations
@tribe_server.feature(INITIALIZE)
async def initialize(params: InitializeParams) -> InitializeResult:
    """Initialize the language server."""
    try:
        logger.info("Initializing Tribe language server...")
        logger.debug(f"Initialize params: {params}")
        
        # Configure server capabilities with our custom command
        capabilities = ServerCapabilities(
            text_document_sync=TextDocumentSyncKind.Full,
            execute_command_provider={
                "commands": ["tribe/createTeam", "tribe/analyzeRequirements"]
            }
        )
        
        # Log the capabilities we're sending
        logger.info(f"Sending capabilities: {capabilities}")
        
        # Pre-register our command handlers for compatibility
        # This works around potential issues with different pygls versions
        if hasattr(tribe_server, "command_handlers"):
            tribe_server.command_handlers["tribe/createTeam"] = create_team_implementation
            logger.info("Directly registered tribe/createTeam in command_handlers")
        elif hasattr(tribe_server, "_commands"):
            tribe_server._commands["tribe/createTeam"] = create_team_implementation
            logger.info("Directly registered tribe/createTeam in _commands")
            
        # Also patch the command handler map if it exists
        try:
            from pygls.protocol import JsonRPCRequestHandler
            if hasattr(JsonRPCRequestHandler, 'REQUEST_HANDLERS'):
                # Add our commands to the global registry
                JsonRPCRequestHandler.REQUEST_HANDLERS['tribe/createTeam'] = create_team_implementation
                logger.info("Added tribe/createTeam to JsonRPCRequestHandler.REQUEST_HANDLERS")
        except Exception as register_err:
            logger.warning(f"Could not patch REQUEST_HANDLERS: {register_err}")
            
        # Create a properly formatted response to ensure Content-Length is added
        result = {
            "jsonrpc": "2.0",
            "result": {
                "capabilities": capabilities
            }
        }
        
        logger.info("Returning initialize result with explicit content")
        return InitializeResult(capabilities=capabilities)
    except Exception as e:
        logger.error(f"Error in initialize: {str(e)}")
        logger.error(traceback.format_exc())
        # Still need to return a result to avoid protocol errors
        return InitializeResult(capabilities=ServerCapabilities())

@tribe_server.feature(INITIALIZED)
async def initialized(params):
    """Handle initialized notification."""
    try:
        logger.info("Tribe language server initialized!")
        
        # Log all registered command handlers
        try:
            # In newer pygls versions, commands are stored differently
            # Try multiple attributes to find the commands
            if hasattr(tribe_server, '_commands'):
                commands = tribe_server._commands.keys()
                logger.info(f"Registered commands: {list(commands)}")
            elif hasattr(tribe_server, 'fm') and hasattr(tribe_server.fm, 'features'):
                commands = tribe_server.fm.features.keys()
                logger.info(f"Registered commands (fm.features): {list(commands)}")
            else:
                logger.info("Could not find commands registry attribute")
        except Exception as e:
            logger.error(f"Error listing commands: {str(e)}")
        
        # Now that we're initialized, we can show the message
        try:
            # This is optional, so wrap in try/except
            tribe_server.show_message("Tribe language server initialized!", MessageType.Info)
        except Exception as e:
            logger.error(f"Error showing message (non-critical): {str(e)}")
            
        # Add additional verification
        logger.info("Server is now fully initialized and ready to process commands")
        
    except Exception as e:
        logger.error(f"Error in initialized: {str(e)}")
        logger.error(traceback.format_exc())

@tribe_server.feature(SHUTDOWN)
async def shutdown(params):
    """Handle shutdown request."""
    try:
        logger.info("Shutting down Tribe language server...")
    except Exception as e:
        logger.error(f"Error in shutdown: {str(e)}")
        logger.error(traceback.format_exc())

@tribe_server.feature(EXIT)
async def exit(params):
    """Handle exit notification."""
    try:
        logger.info("Exiting Tribe language server...")
    except Exception as e:
        logger.error(f"Error in exit: {str(e)}")
        logger.error(traceback.format_exc())

# Custom command handlers with enhanced error handling

# Define the team creation implementation first
async def create_team_implementation(ls, params):
    """Implementation of team creation logic, shared between command handlers."""
    try:
        # Handle both dictionary and Object-style params
        logger.info(f"Params type: {type(params)}")
        
        # Convert params to dictionary if it's not already
        if hasattr(params, '__dict__'):
            # It's an Object from lsprotocol, need to convert to dict
            logger.info("Converting params from Object to dict")
            params_dict = vars(params)
            logger.debug(f"Converted params: {params_dict}")
        elif hasattr(params, 'get'):
            # It's already a dict-like object
            params_dict = params
        else:
            # Unknown type, try to handle gracefully
            logger.warning(f"Unknown params type: {type(params)}, trying to convert")
            try:
                # For pygls.protocol.Object, use dir to find attributes
                logger.info(f"Attempting to extract attributes from {type(params)}")
                params_dict = {}
                for attr in dir(params):
                    # Skip private/special attributes and methods
                    if not attr.startswith('_') and not callable(getattr(params, attr)):
                        value = getattr(params, attr)
                        params_dict[attr] = value
                        logger.debug(f"Extracted attribute {attr}={value}")
            except Exception as e:
                logger.error(f"Could not convert params to dict: {e}")
                # Fall back to an empty dict
                params_dict = {}
        
        # Get parameters directly from attributes for pygls.protocol.Object
        # This is the most reliable method for this type
        if hasattr(params, 'description') and getattr(params, 'description'):
            description = getattr(params, 'description')
            logger.info(f"Got description directly from attribute: {description}")
        else:
            # Fall back to dictionary method
            description = params_dict.get('description', '')
            logger.info(f"Got description from dict: {description}")
        
        # Provide a default if we still don't have a description
        if not description:
            description = "New development team"
            logger.info("Using default description")
            
        logger.info(f"Final description: {description}")
        
        logger.info(f"Creating team with description: {description}")
        logger.debug(f"Full params: {params_dict}")
        
        # Check if LLM is initialized
        global llm
        if llm is None:
            logger.info("LLM not initialized yet, attempting to initialize...")
            if not initialize_llm():
                logger.error("Could not initialize LLM for team creation")
                return {"error": "Could not initialize LLM for team creation"}
        
        # Check if we have a valid API key - if not, use mock team right away
        api_key_set = ('ANTHROPIC_API_KEY' in os.environ and 
                       os.environ['ANTHROPIC_API_KEY'] and 
                       not os.environ['ANTHROPIC_API_KEY'].lower() in ['your-api-key-here', 'your_api_key', 'your-key-here', 'api-key'])
        
        # Log status without revealing full key
        if 'ANTHROPIC_API_KEY' in os.environ:
            key_value = os.environ['ANTHROPIC_API_KEY']
            if key_value:
                if key_value.lower() in ['your-api-key-here', 'your_api_key', 'your-key-here', 'api-key']:
                    logger.warning(f"ANTHROPIC_API_KEY contains placeholder value: {key_value}")
                else:
                    masked_key = f"{key_value[:4]}...{key_value[-4:]}" if len(key_value) > 8 else "[HIDDEN]"
                    logger.info(f"Using API key: {masked_key}")
            else:
                logger.warning("ANTHROPIC_API_KEY is empty")
        
        # Use a mock team only if API key is missing (not in debug mode)
        use_mock_team = not api_key_set
        
        if not api_key_set:
            logger.warning("ANTHROPIC_API_KEY not set in environment, using mock team")
            
        # Try to import and use the real team creation function only if we have API key
        team_members = []
        
        if not use_mock_team:
            try:
                logger.debug("Attempting to import direct_api...")
                # Try relative import first
                try:
                    from .core.direct_api import create_team
                    logger.debug("Successfully imported create_team function via relative import")
                except ImportError:
                    # Try absolute import if relative fails
                    logger.debug("Relative import failed, trying absolute import...")
                    from tribe.core.direct_api import create_team
                    logger.debug("Successfully imported create_team function via absolute import")
                
                # Attempt to create the team
                logger.info("Calling create_team function...")
                
                # Extract team parameters directly from attributes for pygls.protocol.Object
                # Team size parameter
                if hasattr(params, 'team_size') and getattr(params, 'team_size') is not None:
                    team_size = getattr(params, 'team_size')
                    logger.info(f"Got team_size directly from attribute: {team_size}")
                else:
                    # Fall back to dictionary method
                    team_size = params_dict.get('team_size', 3)
                    logger.info(f"Got team_size from dict or default: {team_size}")
                
                # Temperature parameter
                if hasattr(params, 'temperature') and getattr(params, 'temperature') is not None:
                    temperature = getattr(params, 'temperature')
                    logger.info(f"Got temperature directly from attribute: {temperature}")
                else:
                    # Fall back to dictionary method
                    temperature = params_dict.get('temperature', 0.7)
                    logger.info(f"Got temperature from dict or default: {temperature}")
                    
                team_members = create_team(
                    project_description=description,
                    team_size=team_size,
                    model=os.environ.get("TRIBE_MODEL", "claude-3-sonnet-20240229"),
                    temperature=temperature
                )
                
                logger.info(f"Team created with {len(team_members)} members")
            except Exception as e:
                logger.error(f"Error when creating team via direct_api: {str(e)}")
                logger.error(traceback.format_exc())
                use_mock_team = True
        
        # Use mock team as fallback
        if use_mock_team:
            logger.info("Using mock team (debug mode, missing API key, or import error)")
            # Create a more detailed mock team
            team_members = [
                type('Agent', (), {
                    'role': 'Lead Developer', 
                    'name': 'Alex', 
                    'background': 'Experienced software engineer with 10+ years of focus on architecture and system design. Expert in Python, TypeScript, and cloud infrastructure.'
                }),
                type('Agent', (), {
                    'role': 'Front-end Developer', 
                    'name': 'Taylor', 
                    'background': 'UI/UX specialist with 5 years of experience in React, Vue, and modern frontend frameworks. Strong design sensibilities and accessibility focus.'
                }),
                type('Agent', (), {
                    'role': 'QA Engineer', 
                    'name': 'Jordan', 
                    'background': 'Testing expert with automation skills using Playwright, Jest, and other testing frameworks. Experience with CI/CD pipelines and quality processes.'
                })
            ]
            logger.info("Created mock team")
        
        # Format the response
        # Use fixed timestamps to create IDs to avoid potential asyncio event loop issues
        project_id = int(time.time() * 1000) 
        team_id = project_id + 1
        
        result = {
            "project": {
                "id": f"project-{project_id}",
                "name": "Project",
                "description": description,
                "initialized": True,
                "team": {
                    "id": f"team-{team_id}",
                    "name": "Team",
                    "description": f"Team for {description}",
                    "agents": [
                        {
                            "id": str(i),
                            "role": member.role,
                            "name": member.name,
                            "description": member.background,
                            "short_description": member.background[:100] + "..." if len(member.background) > 100 else member.background,
                            "backstory": member.background,
                            "status": "active",
                            "initialization_complete": True,
                            "tools": []
                        }
                        for i, member in enumerate(team_members)
                    ]
                }
            }
        }
        
        logger.debug(f"Returning team result: {result}")
        return result
    except Exception as e:
        logger.error(f"Unhandled error creating team: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": f"Unhandled error creating team: {str(e)}"}

# Register the team creation command using both methods for compatibility
# First using the "feature" style registration (newer pygls)
try:
    @tribe_server.feature("tribe/createTeam")
    async def create_team_feature(ls, params):
        """Create a new team (feature registration)."""
        logger.info("tribe/createTeam feature handler called")
        
        # Debug params to identify the exact format
        logger.info(f"Params type: {type(params)}")
        logger.info(f"Params dir: {dir(params)}")
        logger.info(f"Params has __dict__: {hasattr(params, '__dict__')}")
        logger.info(f"Params has get: {hasattr(params, 'get')}")
        
        # Try to print all public attributes
        logger.info("Public attributes of params:")
        for attr in dir(params):
            if not attr.startswith('_') and not callable(getattr(params, attr)):
                try:
                    value = getattr(params, attr)
                    logger.info(f"  {attr} = {value}")
                except Exception as e:
                    logger.info(f"  Error getting {attr}: {e}")
        
        if hasattr(params, '__dict__'):
            logger.info(f"Params __dict__: {vars(params)}")
        if hasattr(params, 'description'):
            logger.info(f"Params direct description: {params.description}")
            
        # Forward to implementation
        return await create_team_implementation(ls, params)
    
    logger.info("Registered tribe/createTeam as a feature")
except Exception as e:
    logger.error(f"Error registering feature tribe/createTeam: {e}")

# Then using the "command" style registration (older pygls)
try:
    @tribe_server.command("tribe/createTeam")
    async def create_team_command(ls, params):
        """Create a new team (command registration)."""
        logger.info("tribe/createTeam command handler called")
        
        # Debug params to identify the exact format
        logger.info(f"Command Params type: {type(params)}")
        logger.info(f"Command Params dir: {dir(params)}")
        logger.info(f"Command Params has __dict__: {hasattr(params, '__dict__')}")
        logger.info(f"Command Params has get: {hasattr(params, 'get')}")
        if hasattr(params, '__dict__'):
            logger.info(f"Command Params __dict__: {vars(params)}")
        
        # Forward to implementation
        return await create_team_implementation(ls, params)
    
    logger.info("Registered tribe/createTeam as a command")
except Exception as e:
    logger.error(f"Error registering command tribe/createTeam: {e}")

# Register the requirements analysis command
@tribe_server.command("tribe/analyzeRequirements")
async def analyze_requirements(ls, params):
    """Analyze requirements using the LLM."""
    try:
        # Handle both dictionary and Object-style params
        logger.info(f"Params type for requirements: {type(params)}")
        
        # Get requirements - handle both dict and object params
        requirements = ""
        
        # Try dict-style access
        if hasattr(params, 'get'):
            requirements = params.get('requirements', '')
        # Try object attribute access
        elif hasattr(params, 'requirements'):
            requirements = params.requirements
        # Try converting to dict
        elif hasattr(params, '__dict__'):
            params_dict = vars(params)
            requirements = params_dict.get('requirements', '')
        
        if not requirements:
            requirements = "No requirements provided"
            
        logger.info(f"Analyzing requirements: {requirements[:100]}...")
        logger.debug(f"Full requirements: {requirements}")
        
        # Check if LLM is initialized
        global llm
        if llm is None:
            logger.info("LLM not initialized yet, attempting to initialize...")
            if not initialize_llm():
                logger.error("Could not initialize LLM for requirements analysis")
                return {"error": "Could not initialize LLM for requirements analysis"}
        
        # Use the LLM to analyze the requirements
        system_message = """You are a requirements analysis expert. 
        Analyze the provided requirements and provide structured feedback 
        on completeness, feasibility, and potential implementation approach."""
        
        user_message = requirements
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
        
        logger.debug(f"Sending request to LLM with messages: {messages}")
        
        try:
            response = llm.call(messages=messages)
            logger.debug(f"Received response from LLM: {response[:100]}...")
            return response
        except Exception as e:
            logger.error(f"Error calling LLM: {str(e)}")
            logger.error(traceback.format_exc())
            
            # Return an error response
            return {"error": f"Error calling LLM: {str(e)}"}
    except Exception as e:
        logger.error(f"Unhandled error analyzing requirements: {str(e)}")
        logger.error(traceback.format_exc())
        return {"error": f"Unhandled error analyzing requirements: {str(e)}"}

# Entry point for starting the server
def start_server():
    """Start the language server."""
    try:
        logger.info("=" * 80)
        logger.info("Starting Tribe language server...")
        logger.info("=" * 80)
        
        # Set up additional signal handlers for graceful shutdown
        try:
            import signal
            
            def handle_signal(sig, frame):
                logger.info(f"Received signal {sig}, shutting down gracefully")
                sys.exit(0)
            
            signal.signal(signal.SIGINT, handle_signal)
            signal.signal(signal.SIGTERM, handle_signal)
            logger.info("Signal handlers installed")
        except Exception as e:
            logger.warning(f"Could not set up signal handlers: {e}")
        
        # Fix the header issues by properly configuring the server
        try:
            # Directly modify the server's MessageReader class
            from pygls.server import LanguageServer
            from pygls.protocol import JsonRpcProtocol
            
            # First, ensure all server responses have Content-Length headers
            # This works by adding a proper message formatter to the server
            original_write = tribe_server._JsonRpcProtocol__write
            
            async def patched_write(self, message):
                """Ensure all outgoing messages have proper headers."""
                try:
                    logger.debug(f"Sending message: {message}")
                    
                    # Ensure message is in the expected JSON-RPC format
                    if not isinstance(message, dict):
                        message = {"jsonrpc": "2.0", "result": message}
                    
                    # Add jsonrpc field if missing
                    if "jsonrpc" not in message:
                        message["jsonrpc"] = "2.0"
                    
                    # Call the original write method
                    return await original_write(self, message)
                except Exception as e:
                    logger.error(f"Error in patched_write: {e}")
                    logger.error(traceback.format_exc())
                    # Return a minimal error response
                    error_msg = {"jsonrpc": "2.0", "error": {"code": -32603, "message": f"Internal error: {str(e)}"}}
                    try:
                        await original_write(self, error_msg)
                    except Exception:
                        pass
            
            # Apply the write patch
            if hasattr(tribe_server, "_JsonRpcProtocol__write"):
                tribe_server._JsonRpcProtocol__write = patched_write
                logger.info("Successfully patched server's __write method")
            elif hasattr(tribe_server, "_protocol") and hasattr(tribe_server._protocol, "_JsonRpcProtocol__write"):
                tribe_server._protocol._JsonRpcProtocol__write = patched_write
                logger.info("Successfully patched protocol's __write method")
            else:
                logger.warning("Could not find __write method to patch")
                
            # Also patch the send_request and send_notification methods for extra safety
            if hasattr(tribe_server, "send_request"):
                original_send_request = tribe_server.send_request
                
                async def patched_send_request(method, params=None):
                    try:
                        logger.debug(f"Sending request: {method} with params {params}")
                        return await original_send_request(method, params)
                    except Exception as e:
                        logger.error(f"Error in send_request: {e}")
                        # Return a minimal response to avoid crashing
                        return {"error": {"code": -32603, "message": f"Error sending request: {e}"}}
                
                tribe_server.send_request = patched_send_request
                logger.info("Patched server's send_request method")
            
            if hasattr(tribe_server, "notify"):
                original_notify = tribe_server.notify
                
                def patched_notify(method, params=None):
                    try:
                        logger.debug(f"Sending notification: {method} with params {params}")
                        return original_notify(method, params)
                    except Exception as e:
                        logger.error(f"Error in notify: {e}")
                        # Just log and continue, no need to return anything for notifications
                        return None
                
                tribe_server.notify = patched_notify
                logger.info("Patched server's notify method")
                
            logger.info("Server communication methods patched successfully")
        except Exception as e:
            logger.error(f"Error setting up server patches: {e}")
            logger.error(traceback.format_exc())
        
        # One last attempt to patch the JSON-RPC protocol before starting
        try:
            # Direct access to message serialization 
            from pygls.protocol import JsonRpcProtocol
            
            if not hasattr(JsonRpcProtocol, '_original_create_message'):
                # Save original method
                JsonRpcProtocol._original_create_message = JsonRpcProtocol._create_message
                
                # Create patched method
                def patched_create_message(self, message):
                    """Create JSON-RPC message with required headers."""
                    try:
                        logger.debug(f"Creating message: {message}")
                        
                        # Ensure message is a proper dict with jsonrpc field
                        if isinstance(message, dict) and "jsonrpc" not in message:
                            message["jsonrpc"] = "2.0"
                        
                        # Call original implementation
                        result = self._original_create_message(message)
                        
                        # Verify Content-Length is in the result
                        if not result.startswith(b'Content-Length:'):
                            # Add Content-Length header if missing
                            logger.warning("Adding missing Content-Length header")
                            
                            # Manual serialization with proper headers
                            content = json.dumps(message).encode('utf-8')
                            length = len(content)
                            header = f'Content-Length: {length}\r\n\r\n'.encode('utf-8')
                            result = header + content
                            
                        logger.debug(f"Created message with headers: {result[:100]}")
                        return result
                    except Exception as e:
                        logger.error(f"Error in patched_create_message: {e}")
                        
                        # Create fallback error message with proper headers
                        try:
                            error_content = json.dumps({"jsonrpc": "2.0", "error": {"code": -32603, "message": str(e)}}).encode('utf-8')
                            error_length = len(error_content)
                            error_header = f'Content-Length: {error_length}\r\n\r\n'.encode('utf-8')
                            return error_header + error_content
                        except:
                            # Last resort
                            fallback = b'Content-Length: 2\r\n\r\n{}'
                            return fallback
                
                # Apply the patch
                JsonRpcProtocol._create_message = patched_create_message
                logger.info("Successfully patched JsonRpcProtocol._create_message")
            else:
                logger.info("JsonRpcProtocol._create_message already patched")
        except Exception as e:
            logger.error(f"Failed to patch message creation: {e}")
            logger.error(traceback.format_exc())
        
        # Start the server
        logger.info("Calling tribe_server.start_io()")
        tribe_server.start_io()
    except Exception as e:
        logger.critical(f"Critical error starting server: {e}")
        logger.critical(traceback.format_exc())
        # Re-raise to fail with a clear error message
        raise

if __name__ == "__main__":
    try:
        start_server()
    except Exception as e:
        print(f"Error starting server: {e}")
        traceback.print_exc()
        sys.exit(1)