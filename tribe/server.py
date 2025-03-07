"""Tribe Language Server implementation."""

import os
import sys
import json
import time
import logging
import asyncio
import traceback
import signal
from typing import Dict, Any, Optional, List, Union, Tuple

# Import necessary modules
from pygls.server import LanguageServer
from lsprotocol.types import (
    InitializeParams,
    InitializeResult,
    ServerCapabilities,
    TextDocumentSyncKind,
    MessageType,
    INITIALIZED,
    INITIALIZE,
    SHUTDOWN,
    EXIT,
    TEXT_DOCUMENT_DID_OPEN,
    TEXT_DOCUMENT_DID_CHANGE,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tribe.server")

# Import tribe-specific modules
try:
    from tribe.core import direct_api
    from tribe.core.foundation_model import FoundationModelInterface
    logger.info("Successfully imported API modules")
except ImportError:
    try:
        sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from core import direct_api
        from core.foundation_model import FoundationModelInterface
        logger.info("Successfully imported API modules from alternate path")
    except ImportError as e:
        logger.error(f"Failed to import API modules: {str(e)}")
        direct_api = None

# Create the language server instance
tribe_server = LanguageServer("tribe-ls", "v1")

@tribe_server.feature(INITIALIZED)
async def initialized(params):
    """Handle initialized notification."""
    try:
        logger.info("Tribe language server initialized!")
        
        # Log all registered command handlers
        try:
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
        
        # Show initialization message
        try:
            tribe_server.show_message("Tribe language server initialized!", MessageType.Info)
        except Exception as e:
            logger.error(f"Error showing message (non-critical): {str(e)}")
            
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
    logger.info("Exit request received")
    return None

@tribe_server.feature("tribe.createTeam")
async def create_team_handler(ls, params):
    """Create a new team based on description using the foundation model.
    
    Uses the project analysis prompt pattern from dynamic.py to generate
    a complete team.
    """
    logger.info(f"Handling tribe.createTeam with params: {params}")
    
    try:
        # Check if direct_api is available
        if direct_api is None:
            raise ImportError("API modules are not available")
            
        # Extract parameters
        if isinstance(params, dict):
            description = params.get("description", "an AI development team")
            temperature = params.get("temperature", 0.7)
        else:
            description = getattr(params, "description", "an AI development team")
            temperature = getattr(params, "temperature", 0.7)
        
        logger.info(f"Creating team for '{description}' with temperature {temperature}")
        
        # Use the system and user prompts from dynamic.py analyze_project method
        system_prompt = """You are a structured data extraction system specialized in software project analysis.
        
        You are a VP of Engineering with expertise in team building and project planning.
        
        Your response will be parsed by a machine learning system, so it's critical that your output follows these rules:
        1. Respond ONLY with a valid JSON object.
        2. Do not include any explanations, markdown formatting, or text outside the JSON.
        3. Do not use ```json code blocks or any other formatting.
        4. Ensure all JSON keys and values are properly quoted and formatted.
        5. Do not include any comments within the JSON.
        6. The JSON must be parseable by the standard json.loads() function.
        """
            
        user_prompt = f"""Analyze this project description and create a comprehensive team blueprint:

        Project Description:
        {description}
        
        Create a complete team structure with the following components:
        
        1. A clear project vision statement
        2. A team of 3-7 specialized AI agents with complementary skills
        3. A set of initial tasks for each agent
        4. Required tools for the project
        5. Workflow patterns for team collaboration
        
        Your response must follow this JSON structure:
        ```
        {{
            "vision": string, # Project vision statement
            "agents": List[AgentModel], # List of agents with name, role, backstory, goal
            "tasks": List[TaskModel], # List of tasks with description, expected_output, agent
            "tools": List[ToolModel] # List of tools needed with name, description, capabilities
        }}
        ```
        """
        
        # Use direct_api to query the model with these prompts
        try:
            # Query the model
            blueprint = direct_api.query_model(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature
            )
            
            logger.info(f"Received response type: {type(blueprint)}")
            
            # Parse the response if needed
            if isinstance(blueprint, str):
                # Use JSON extraction if we got a string response
                clean_json = direct_api.extract_json_from_text(blueprint)
                blueprint_data = json.loads(clean_json)
            else:
                # Already parsed
                blueprint_data = blueprint
                
            # Extract agents from the blueprint
            agents = []
            for idx, agent_info in enumerate(blueprint_data.get("agents", [])):
                agent = {
                    "id": f"agent-{idx+1}",
                    "name": agent_info.get("name", f"Agent {idx+1}"),
                    "role": agent_info.get("role", "Specialist"),
                    "status": "available",
                    "description": agent_info.get("backstory", "") + "\n\nGoal: " + agent_info.get("goal", "")
                }
                agents.append(agent)
            
            # Create the team structure
            team_data = {
                "id": f"team-{int(time.time())}",
                "name": f"Team for {description}",
                "description": description,
                "vision": blueprint_data.get("vision", f"Building an exceptional {description}"),
                "agents": agents,
                "created_at": time.time()
            }
            
            logger.info(f"Successfully created team with {len(agents)} agents")
            
            return {
                "success": True,
                "team": team_data
            }
            
        except Exception as query_error:
            logger.error(f"Error querying model: {str(query_error)}")
            logger.error(traceback.format_exc())
            raise ValueError(f"Failed to create team blueprint: {str(query_error)}")
            
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error in create_team_handler: {error_msg}")
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": error_msg
        }

def start_server():
    """Start the language server."""
    try:
        logger.info("Starting Tribe language server...")
        
        # Handle signals to shutdown server gracefully
        def handle_signal(sig, frame):
            logger.info(f"Received signal {sig}, shutting down...")
            tribe_server.shutdown()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)
        
        # Start the server using STDIO
        logger.info("Server starting with STDIO transport")
        tribe_server.start_io()
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    start_server()