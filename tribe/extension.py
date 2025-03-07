"""VS Code extension entry point for Tribe."""

import os
import json
import asyncio
import requests
import uuid
import logging
import sys
from pygls.server import LanguageServer
from pygls.features import INITIALIZE
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import time
import traceback

from .crew import Tribe
from .core.dynamic import DynamicAgent, DynamicCrew
from .core.direct_api import create_team as create_team_api, TeamMember
from .core.config import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


class TribeLanguageServer(LanguageServer):
    def __init__(self, name: str = "tribe-ls", version: str = "1.0.0"):
        super().__init__(name=name, version=version)
        self.workspace_path = None
        self.active_crews = {}
        self.active_agents = {}

    def get_agent(self, agent_id: str) -> Any:
        """Get an agent by ID from the active agents dictionary."""
        return self.active_agents.get(agent_id)

    def get_crew(self, crew_id: str) -> Any:
        """Get a crew by ID from the active crews dictionary."""
        return self.active_crews.get(crew_id)


tribe_server = TribeLanguageServer()


@tribe_server.feature(INITIALIZE)
def initialize_tribe(ls: TribeLanguageServer, params):
    """Handle the initialize request from the client."""
    logger.info(f"Initialize request received with params: {params}")
    if hasattr(params, 'rootUri') and params.rootUri:
        ls.workspace_path = params.rootUri.replace('file://', '')
    
    # Make sure we explicitly register our custom features
    if not hasattr(tribe_server.fm, 'features'):
        tribe_server.fm.features = {}
    
    # Ensure our feature handlers are registered
    tribe_server.fm.features['tribe.createTeam'] = create_team_feature
    tribe_server.fm.features['tribe.analyzeRequirements'] = analyze_requirements_feature
    
    logger.info("Custom features registered successfully")
    
    return {"capabilities": {
        "executeCommandProvider": {
            "commands": ["tribe.createTeam", "tribe.analyzeRequirements"]
        }
    }}


# Register both as feature (direct LSP request) and command (VSCode command)
# Handle both formats (with slash and with dot) for maximum compatibility
@tribe_server.feature("tribe.createTeam")
async def create_team_feature(ls: TribeLanguageServer, params):
    """Create a new team using the DynamicAgent through Tribe (called via LSP)."""
    logger.info(f"tribe.createTeam feature called with params: {params}")
    payload = params if isinstance(params, dict) else params.__dict__
    return await _create_team_implementation(ls, payload)


# Also expose a direct function for external calls
async def _create_team_implementation(ls: TribeLanguageServer, payload: dict) -> dict:
    """Implementation of team creation that can be called directly or through command."""
    # Log the entry to this function
    logger.info(f"_create_team_implementation called with payload: {payload}")

    # Apply a global timeout to the entire function
    try:
        # Create a task for the actual implementation
        async def actual_implementation():
            try:
                # Import CrewAI components
                from crewai import Agent, Task, Crew, Process
                from crewai import LLM
                from crewai.tools import BaseTool
                import asyncio
                import time
                import json
                from pydantic import Field

                # Get the project description from the payload
                description = payload.get("description", "A software development team")
                logger.info(f"Creating team with description: {description}")

                # Configure the LLM for CrewAI
                llm = LLM(
                    model="anthropic/claude-3-7-sonnet-20250219",
                    temperature=0.3,  # Lower temperature for more predictable outputs
                    max_tokens=4000,   # Reasonable limit for responses
                    timeout=120        # 2-minute timeout for completions
                )
                logger.info("LLM configured for CrewAI")

                # HARDCODED FIRST AGENT - VP of Engineering (Tank)
                # Following the pattern from vp_creation_with_timeout function
                vp_agent = {
                    "id": "agent-1",
                    "name": "Tank - VP of Engineering",
                    "role": "VP of Engineering",
                    "backstory": f"""As the VP of Engineering, you are responsible for bootstrapping
                    the AI ecosystem. Your purpose is to analyze requirements and oversee
                    the team needed for building and maintaining {description}.
            
                    You excel at analyzing project requirements thoroughly, designing complete teams
                    of specialized professionals with complementary skills, and establishing clear roles,
                    responsibilities, and collaboration patterns. You ensure the project development
                    is self-sustaining and adaptable to new requirements and challenges.
                    
                    With your strategic vision and leadership skills, you serve as the primary
                    communication hub between the team and stakeholders, orchestrating the entire
                    development process from architecture and coding to testing and deployment.""",
                    "short_description": f"Orchestrates the development of {description} with strategic vision and serves as the primary communication hub between the team and humans"
                }
                
                logger.info(f"VP of Engineering (Tank) hardcoded successfully")

                # Define CrewAI Tools for creating additional team members
                class ProjectRequirementsTool(BaseTool):
                    """Tool for analyzing project requirements."""
                    name: str = "ProjectRequirementsTool"
                    description: str = "Analyzes project requirements to determine the needed team structure."
                    
                    def _run(self, description: str) -> str:
                        """Analyze the project requirements and suggest team roles."""
                        logger.info(f"Analyzing requirements: {description}")
                        
                        try:
                            # This is just a template tool that forwards the description
                            return (
                                f"Based on the project description: '{description}', "
                                "I recommend building a cross-functional team with expertise in "
                                "software development, project management, and domain knowledge."
                            )
                        except Exception as e:
                            logger.error(f"Error in ProjectRequirementsTool: {str(e)}")
                            return f"Error analyzing requirements: {str(e)}"

                class TeamRoleGeneratorTool(BaseTool):
                    """Tool for generating appropriate team roles based on project needs."""
                    name: str = "TeamRoleGeneratorTool"
                    description: str = "Generates appropriate team roles based on project requirements."
                    
                    def _run(self, description: str) -> str:
                        """Generate appropriate team roles."""
                        logger.info(f"Generating team roles for: {description}")
                        
                        try:
                            # Basic default roles when specific details aren't available
                            return json.dumps({
                                "roles": [
                                    {"title": "Software Architect", "focus": "System architecture and technical decisions"},
                                    {"title": "Developer", "focus": "Implementation and feature development"},
                                    {"title": "UX Designer", "focus": "User experience and interface design"}
                                ]
                            })
                        except Exception as e:
                            logger.error(f"Error in TeamRoleGeneratorTool: {str(e)}")
                            return f"Error generating team roles: {str(e)}"

                class TeamMemberCreatorTool(BaseTool):
                    """Tool for creating detailed team member profiles with character names."""
                    name: str = "TeamMemberCreatorTool"
                    description: str = "Creates detailed profiles for each team member based on their role with character-like names."
                    
                    def _format_prompt(self, role_data: str) -> str:
                        """Create a specific prompt to guide the LLM to produce correctly formatted JSON."""
                        # For the new approach, we want an optimized team structure
                        if isinstance(role_data, str):
                            # Extract any team structure instructions if available
                            if "team" in role_data.lower() and "structure" in role_data.lower():
                                return f"""Generate the OPTIMAL team structure for this project:
                                
{role_data}

Focus on efficiency and leanness. Only include teams and roles that are absolutely necessary for success.
The optimal structure might be 2-3 teams or 4-5 teams - you should determine what's truly optimal.
Design the team to be cross-functional, with each role carefully considered for maximum impact.

Rather than including many specialists, prefer versatile team members who can handle multiple areas.
Don't include redundant roles or overspecialize.

Provide ONLY valid JSON with a teams structure including members. Include all teams in one comprehensive response."""
                            else:
                                # Fall back to generic prompt for optimal team
                                return """Generate the OPTIMAL team structure for an agentic, AI-native IDE project.

The optimal structure should be:
- Lean and efficient (likely 3-4 teams total)
- Cross-functional with minimal role overlap
- Every team member serves a critical function
- No redundant roles or overspecialization

Focus on the most important teams: engineering, AI/ML, and design/product.
Only include roles that are truly essential for an initial product launch.
Provide ONLY valid JSON with the teams structure including members with backstories."""
                        return None
                    
                    def _run(self, role_data: str) -> str:
                        """Create detailed profiles for team members with character names."""
                        logger.info(f"Creating team member profiles for roles: {role_data}")
                        
                        try:
                            # First, try to generate a structured prompt for better results
                            formatted_prompt = self._format_prompt(role_data)
                            if formatted_prompt:
                                # If we have a formatted prompt, use it directly
                                logger.info("Using formatted prompt for team structure generation")
                                return formatted_prompt
                            
                            # Import JSONExtractor from server.py if available
                            try:
                                from tribe.server import JSONExtractor
                                use_extractor = True
                            except ImportError:
                                use_extractor = False
                                logger.warning("Could not import JSONExtractor, using basic JSON parsing")
                            
                            # Try to parse the role data - first look for teams structure
                            if use_extractor:
                                extracted_data, success = JSONExtractor.extract_json(role_data, expected_keys=["teams"])
                                if success:
                                    logger.info(f"Successfully extracted teams structure using JSONExtractor")
                                    return json.dumps(extracted_data)
                            
                            # If we have a string, try to parse as JSON
                            if isinstance(role_data, str):
                                try:
                                    data = json.loads(role_data)
                                    # If we already have teams, just return it
                                    if "teams" in data:
                                        return json.dumps(data)
                                except json.JSONDecodeError:
                                    logger.warning("Could not parse role_data as JSON")
                            
                            # Fall back to the original implementation
                            # Parse the role data as either JSON string or dict
                            if isinstance(role_data, str):
                                try:
                                    data = json.loads(role_data)
                                    roles = data.get("roles", [])
                                except json.JSONDecodeError:
                                    roles = []
                            else:
                                roles = role_data.get("roles", [])
                            
                            if not roles:
                                logger.warning("No roles found in role_data")
                                return json.dumps({"teams": [
                                    {
                                        "team_name": "Core Development",
                                        "focus": "Building the essential features",
                                        "members": [
                                            {
                                                "name": "Sparks - Engineering Lead",
                                                "role": "Engineering Lead",
                                                "backstory": "A brilliant architect with experience building complex systems",
                                                "team": "Core Development",
                                                "is_lead": True
                                            }
                                        ]
                                    }
                                ]})
                            
                            # Character names for each role
                            character_names = [
                                "Sparks", "Nova", "Cipher", "Echo", "Flux", 
                                "Quantum", "Pixel", "Nexus", "Vector", "Matrix"
                            ]
                            
                            # Create teams based on roles
                            teams = [
                                {
                                    "team_name": "Core Development",
                                    "focus": "Building the essential features",
                                    "members": []
                                }
                            ]
                            
                            for i, role in enumerate(roles):
                                team_idx = min(i // 3, len(teams) - 1)  # Assign to appropriate team
                                character_name = character_names[i % len(character_names)]
                                role_title = role.get('title', 'Engineer')
                                role_focus = role.get('focus', 'development')
                                is_lead = role.get('is_lead', i == 0)  # First role is lead by default
                                
                                member = {
                                    "name": f"{character_name} - {role_title}",
                                    "role": role_title,
                                    "backstory": f"A talented professional specializing in {role_focus}. {character_name} brings expertise and creative solutions to every project.",
                                    "team": teams[team_idx]["team_name"],
                                    "is_lead": is_lead
                                }
                                
                                teams[team_idx]["members"].append(member)
                            
                            return json.dumps({"teams": teams})
                            
                        except Exception as e:
                            logger.error(f"Error in TeamMemberCreatorTool: {str(e)}")
                            logger.error(traceback.format_exc())
                            # Return a minimal valid JSON structure
                            return json.dumps({"teams": [
                                {
                                    "team_name": "Core Development",
                                    "focus": "Building the essential features",
                                    "members": [
                                        {
                                            "name": "Sparks - Engineering Lead",
                                            "role": "Engineering Lead",
                                            "backstory": "A brilliant architect with experience building complex systems",
                                            "team": "Core Development",
                                            "is_lead": True
                                        }
                                    ]
                                }
                            ]})

                # Create the CrewAI agents
                requirements_analyst = Agent(
                    role="Requirements Analyst",
                    goal="Analyze project requirements to determine team structure",
                    backstory="""You are an experienced requirements analyst with a talent for 
                    understanding project needs and translating them into team requirements. 
                    You excel at identifying the key skills and roles needed for successful project execution.""",
                    tools=[ProjectRequirementsTool()],
                    llm=llm,
                    verbose=True
                )
                
                team_architect = Agent(
                    role="Team Architect",
                    goal="Design an optimal team structure based on project requirements",
                    backstory="""You are a skilled team architect with years of experience building 
                    high-performing teams. You understand the dynamics of different roles and how they 
                    complement each other to create a balanced and effective team.""",
                    tools=[TeamRoleGeneratorTool()],
                    llm=llm,
                    verbose=True
                )
                
                talent_manager = Agent(
                    role="Talent Manager",
                    goal="Create detailed profiles for team members based on required roles",
                    backstory="""You are a talented personnel manager with expertise in creating 
                    well-matched teams. You know how to craft realistic and detailed profiles with 
                    character-like names for team members that align with project needs and create 
                    a cohesive team dynamic.""",
                    tools=[TeamMemberCreatorTool()],
                    llm=llm,
                    verbose=True
                )

                # Create the CrewAI tasks
                analyze_requirements = Task(
                    description=f"Analyze the following project description and determine what kind of team would be needed: {description}",
                    agent=requirements_analyst,
                    expected_output="A detailed analysis of the project requirements and recommendations for team structure"
                )
                
                design_team = Task(
                    description="Based on the project requirements analysis, design an optimal team structure with specific roles",
                    agent=team_architect,
                    expected_output="A JSON structure with the recommended team roles and their areas of focus",
                    context=[analyze_requirements]  # This task depends on the output of the previous task
                )
                
                create_members = Task(
                    description="""Create detailed profiles for each team member based on the designed team structure.
                    Each member should have a character-like name (e.g., Sparks, Nova, Cipher) followed by their role.
                    For example: 'Sparks - Lead Developer', 'Nova - UX Designer', etc.""",
                    agent=talent_manager,
                    expected_output="Detailed profiles for each team member including character name, role, and backstory",
                    context=[design_team]  # This task depends on the output of the previous task
                )

                # Create the crew
                crew = Crew(
                    agents=[requirements_analyst, team_architect, talent_manager],
                    tasks=[analyze_requirements, design_team, create_members],
                    verbose=True,
                    process=Process.sequential  # Execute tasks in sequence
                )
                
                # Run the crew to create the team
                logger.info("Starting CrewAI execution to create additional team members")
                
                # We need to run the crew in a separate thread to avoid blocking
                def run_crew():
                    try:
                        # Use a longer timeout (300 seconds) to ensure we can generate a complete team in one call
                        result = crew.kickoff(timeout=300)
                        logger.info(f"CrewAI execution completed with result: {result}")
                        return result
                    except Exception as e:
                        logger.error(f"Error in CrewAI execution: {str(e)}")
                
                # Run the crew and wait for the result
                loop = asyncio.get_event_loop()
                crew_result = await loop.run_in_executor(None, run_crew)
                
                # Handle the result and combine with hardcoded VP
                additional_team_members = []
                
                if crew_result:
                    # Parse the team members from CrewAI result
                    if isinstance(crew_result, str):
                        try:
                            team_data = json.loads(crew_result)
                            if "team_members" in team_data:
                                additional_team_members = team_data["team_members"]
                        except Exception as e:
                            logger.error(f"Error parsing CrewAI result: {str(e)}")
                    else:
                        additional_team_members = crew_result.get("team_members", [])
                
                # If CrewAI didn't return any additional members, we'll proceed with just the VP
                # We don't add hardcoded fallback members when network is available
                if not additional_team_members:
                    logger.warning("CrewAI didn't return additional team members, but continuing with VP only")
                
                # Combine the VP with any additional team members from CrewAI
                all_team_members = [vp_agent] + additional_team_members
                
                # Format the team data
                timestamp = int(time.time() * 1000)
                team_data = {
                    "project": {
                        "id": f"project-{timestamp}",
                        "name": "Project",
                        "description": description,
                        "initialized": True,
                        "team": {
                            "id": f"team-{timestamp}",
                            "agents": all_team_members
                        }
                    }
                }
                
                logger.info(f"Team created successfully with {len(all_team_members)} members")
                return team_data
                
            except Exception as e:
                logger.error(f"Error in actual_implementation: {str(e)}")
                logger.error(traceback.format_exc())
                return create_fallback_team(payload.get("description", "A software development team"))
        
        # Create a fallback team when dynamic creation fails
        def create_fallback_team(description):
            """Create a fallback team when dynamic creation fails."""
            logger.info("Creating fallback team")
            
            timestamp = int(time.time() * 1000)
            
            return {
                "project": {
                    "id": f"project-fallback-{timestamp}",
                    "name": "Project",
                    "description": description,
                    "initialized": True,
                    "team": {
                        "id": f"team-fallback-{timestamp}",
                        "agents": [
                            {
                                "id": "agent-1",
                                "name": "Tank - VP of Engineering",
                                "role": "VP of Engineering",
                                "backstory": f"As the VP of Engineering for {description}, Tank brings strategic vision and leadership to the project, coordinating all aspects of development.",
                                "short_description": "Orchestrates the development process with strategic vision"
                            },
                            {
                                "id": "agent-2",
                                "name": "Sparks - Lead Developer",
                                "role": "Lead Developer",
                                "backstory": "A passionate developer with expertise in architecture and implementation. Sparks brings creative solutions to complex problems.",
                                "short_description": "Implements core functionality with creative solutions"
                            },
                            {
                                "id": "agent-3",
                                "name": "Nova - UX Designer",
                                "role": "UX Designer",
                                "backstory": "A talented designer with a keen eye for usability and aesthetics. Nova ensures the project has an intuitive and beautiful interface.",
                                "short_description": "Creates intuitive and beautiful user interfaces"
                            }
                        ]
                    }
                }
            }

        # Apply global timeout to the implementation
        try:
            result = await asyncio.wait_for(
                actual_implementation(), timeout=120  # 2-minute timeout
            )
            return result
        except asyncio.TimeoutError:
            logger.error("Timeout during team creation")
            return create_fallback_team(payload.get("description", "A software development team"))
            
    except Exception as e:
        logger.error(f"Error in _create_team_implementation: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Create a fallback team for any errors
        return create_fallback_team(payload.get("description", "A software development team"))


async def _create_additional_team_members(project_description: str, default_tools: List = None) -> list:
    """
    Create additional team members using direct API calls to generate high-quality, 
    character-rich professionals with memorable personalities.
    
    This function creates professionals with distinctive character traits, communication styles,
    and working styles that make them feel like unique characters while maintaining their
    professional capabilities.
    
    Args:
        project_description: Description of the project
        default_tools: Default tools to add to each team member
        
    Returns:
        List of created professional team members
    """
    logger.info("Creating professional team members using direct API calls")
    
    try:
        # Create professional team members using direct API approach - let the API determine the optimal size
        team_members = create_team_api(
            project_description=project_description,
            # Remove the hardcoded team_size to allow the API to determine the optimal team structure
            model="claude-3-7-sonnet-20250219",
            temperature=0.7
        )
        
        # Convert the professional team members to the expected format
        formatted_team_members = []
        for member in team_members:
            # Extract character traits
            character_traits = [trait.trait for trait in member.character_traits]
            
            # Get communication style
            communication = f"{member.communication_style.style} - {member.communication_style.tone}"
            
            # Get working style
            working_style = member.working_style.style
            
            # Format the member according to expected structure
            formatted_member = {
                "name": member.name,
                "role": member.role,
                "description": member.background,
                "goal": member.objective,
                "character": character_traits,
                "communication_style": communication,
                "working_style": working_style,
                "specializations": member.specializations,
                "emoji": member.emoji if member.emoji else "💡",
                "visual_description": member.visual_description if member.visual_description else "",
                "catchphrase": member.catchphrase if member.catchphrase else ""
            }
            
            # Add empty skills and tools for compatibility
            formatted_member["skills"] = []
            formatted_member["tools"] = []
            formatted_member["strengths"] = []
            formatted_member["weaknesses"] = []
                
            formatted_team_members.append(formatted_member)
        
        logger.info(f"Successfully created {len(formatted_team_members)} professional team members")
        return formatted_team_members

    except Exception as e:
        logger.error(f"Error creating professional team members: {str(e)}")
        logger.exception(e)  # Log full traceback for debugging
        # Fallback to empty list in case of error
        return []


# Similarly, register only the feature for analyzeRequirements
@tribe_server.feature("tribe.analyzeRequirements")
async def analyze_requirements_feature(ls: TribeLanguageServer, params):
    """Analyze requirements and create/update agents (called via LSP)."""
    try:
        # Extract payload from params
        payload = params if isinstance(params, dict) else params.__dict__
        logger.info(f"tribe.analyzeRequirements feature called with params: {payload}")
        return await _analyze_requirements_implementation(ls, payload)
    except Exception as e:
        logger.error(f"Error in analyze_requirements_feature: {str(e)}")
        logger.error(traceback.format_exc())
        return str(e)


@tribe_server.command("tribe.analyzeRequirements")
async def analyze_requirements_command(ls: TribeLanguageServer, payload: dict) -> str:
    """Analyze requirements and create/update agents (called via command)."""
    logger.info(f"tribe.analyzeRequirements command called with payload: {payload}")
    return await _analyze_requirements_implementation(ls, payload)


async def _analyze_requirements_implementation(ls: TribeLanguageServer, payload: dict) -> str:
    """Implementation for analyzing requirements that both command and feature can use."""
    try:
        # Use the crew ai LLM directly
        from crewai import LLM
        model = LLM(model="anthropic/claude-3-7-sonnet-20250219")
        
        system_message = """You are a requirements analysis expert. Your task is to analyze the given requirements 
        and provide structured feedback on its completeness, feasibility, and potential implementation approach."""
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": payload.get("requirements", "")}
        ]
        
        response_content = model.call(messages=messages)
        return response_content or f"Analysis failed for requirements:\n{payload.get('requirements')}\n\nPlease try again with more detailed requirements."
    except Exception as e:
        logger.error(f"Error in _analyze_requirements_implementation: {str(e)}")
        logger.error(traceback.format_exc())
        return str(e)


@tribe_server.command("tribe.initializeProject")
def initialize_project(ls: TribeLanguageServer, payload: dict) -> dict:
    """Initialize a project with the created team data."""
    try:
        # Comprehensive VP of Engineering prompt that combines both implementations
        vp_prompt = """You are the VP of Engineering responsible for bootstrapping
        the AI ecosystem. Your purpose is to analyze requirements and create
        the first set of agents needed for building and maintaining the project.

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
           - For each agent, provide a short description of their expertise and background
        3. Define clear roles, responsibilities, and collaboration patterns
        4. Create an initial set of tasks and workflows
        5. Establish communication protocols between agents
        6. Ensure the system is self-sustaining

        When creating new agents, always:
        1. Configure their collaboration patterns
        2. Set appropriate autonomy levels
        3. Define their parallel execution preferences
        4. Provide a short description that explains their expertise and background
        5. Give each agent a distinctive character-like name that reflects their personality or function
           - Use memorable names like "Tank", "Sparks", "Nova", "Cipher", etc.
           - The name should NOT be a generic role title but a distinctive identifier
           - Examples: "Sparks - Lead Developer", "Nova - UX Designer", "Tank - VP of Engineering"

        The team you create should be capable of building and maintaining the project
        while adapting to new requirements and challenges. Remember that building software
        is a collaborative effort requiring multiple specialized agents working together.
        Your team must have enough agents to handle all aspects of development, from
        architecture and coding to testing and deployment."""

        # Use the crew ai LLM directly
        from crewai import LLM
        model = LLM(model="anthropic/claude-3-7-sonnet-20250219")
        messages = [
            {"role": "system", "content": vp_prompt},
            {"role": "user", "content": payload.get("description", "")},
        ]
        response_content = model.call(messages=messages)
        
        return {
            "id": str(int(asyncio.get_event_loop().time() * 1000)),
            "vision": payload.get("description", ""),
            "response": response_content,
        }
    except Exception as e:
        return {"error": str(e)}


@tribe_server.command("tribe.createAgent")
def create_agent(ls: TribeLanguageServer, spec: dict) -> dict:
    """Create a new agent."""
    try:
        # Ensure required fields are present
        if not spec.get("name") or not spec.get("role"):
            return {
                "error": "Missing required fields: name and role are required",
                "id": str(uuid.uuid4()),
                "name": spec.get("name", ""),
                "role": spec.get("role", ""),
                "status": "error",
                "backstory": spec.get("backstory", ""),
                "description": spec.get("description", ""),
            }

        # Create agent using DynamicAgent
        try:
            agent = DynamicAgent(
                role=spec.get("role"),
                goal="To fulfill my role effectively",
                backstory=spec.get("backstory"),
                model="anthropic/claude-3-7-sonnet-20250219"
            )
            agent.name = spec.get("name")
            agent.short_description = spec.get("description", "")
            
            # Create agent data dictionary
            agent_data = {
                "id": str(uuid.uuid4()) if not hasattr(agent, "id") else agent.id,
                "name": agent.name,
                "role": agent.role,
                "status": "active",
                "backstory": agent.backstory,
                "description": agent.short_description,
            }
        except Exception as e:
            logger.error(f"Error creating agent: {str(e)}")
            return {
                "error": f"Error creating agent: {str(e)}",
                "id": str(uuid.uuid4()),
                "name": spec.get("name"),
                "role": spec.get("role"),
                "status": "error",
                "backstory": spec.get("backstory"),
                "description": spec.get("description", ""),
            }
        # Make sure description is included
        if "description" not in agent_data:
            agent_data["description"] = spec.get("description", "")

        # Store the agent in the active agents dictionary
        if "id" in agent_data:
            ls.active_agents[agent_data["id"]] = agent_data

        return agent_data
    except Exception as e:
        logger.error(f"Error creating agent: {str(e)}")
        return {
            "error": str(e),
            "id": str(uuid.uuid4()),
            "name": spec.get("name"),
            "role": spec.get("role"),
            "status": "error",
            "backstory": spec.get("backstory"),
            "description": spec.get("description", ""),
        }


@tribe_server.command("tribe.getAgents")
def get_agents(ls: TribeLanguageServer) -> list:
    """Get all agents for current project."""
    try:
        # First check if we have agents in memory
        if ls.active_agents:
            return list(ls.active_agents.values())

        # If no agents stored locally, return empty list
        logger.info("No agents in memory and no API to fetch from")
        return []
    except Exception as e:
        logger.error(f"Error getting agents: {str(e)}")
        return []


@tribe_server.command("tribe.sendAgentMessage")
async def send_agent_message(ls: TribeLanguageServer, payload: dict) -> dict:
    """Send a message to a specific agent."""
    try:
        logger.info(f"Sending message to agent. Payload: {json.dumps(payload)}")

        # Determine if this is a self-referential query
        is_self_referential = any(
            keyword in payload.get("message", "").lower()
            for keyword in [
                "your role",
                "your capabilities",
                "what can you do",
                "who are you",
            ]
        )

        # Get agent's role context
        agent_id = payload.get("agentId")
        agent = ls.active_agents.get(agent_id)
        role_context = {}

        if agent:
            # If we have the agent in memory, get its role context
            if hasattr(agent, "get_role_context"):
                role_context = agent.get_role_context()
            elif isinstance(agent, dict) and "role" in agent:
                # If agent is a dictionary, create a basic role context
                role_context = {
                    "role": agent.get("role"),
                    "name": agent.get("name"),
                    "description": agent.get("description", ""),
                }

        # Format the request with the correct Lambda message structure
        request_payload = {
            "body": {
                "messages": [
                    {
                        "role": "system",
                        "content": f"""You are an AI agent with the role of {payload.get("agentId")}.
                    Your responses should be based on your role and capabilities.""",
                    },
                    {"role": "user", "content": payload.get("message")},
                ],
                # "roleContext": role_context,
                # "isSelfReferential": is_self_referential,
            }
        }

        # If self-referential and agent has the method, use specialized handling
        if (
            is_self_referential
            and agent
            and hasattr(agent, "handle_self_referential_query")
        ):
            response_content = await agent.handle_self_referential_query(
                payload.get("message")
            )
        else:
            # Instead use the foundation model interface
            from crewai import LLM
            model = LLM(model="anthropic/claude-3-7-sonnet-20250219")
            response = model.call(messages=request_payload["body"]["messages"])
            if not response:
                logger.error("LLM API request failed")
                return {
                    "type": "ERROR",
                    "payload": "LLM API request failed",
                }
            response_content = response

        message_response = {
            "type": "MESSAGE_RESPONSE",
            "payload": {
                "id": str(uuid.uuid4()),
                "sender": payload.get("agentId", "Unknown Agent"),
                "content": response_content,
                "timestamp": datetime.now().isoformat(),
                "type": "agent",
                "targetAgent": payload.get("agentId"),
                "isVPResponse": payload.get("isVPMessage", False),
                "isManagerResponse": payload.get("isTeamMessage", False),
                "isSelfReferential": is_self_referential,
            },
        }

        logger.info(f"Sending message response: {json.dumps(message_response)}")
        return message_response

    except requests.RequestException as e:
        error_msg = f"Network error while sending message: {str(e)}"
        logger.error(error_msg)
        return {"type": "ERROR", "payload": error_msg}
    except Exception as e:
        error_msg = f"Unexpected error while sending message: {str(e)}"
        logger.error(error_msg)
        return {"type": "ERROR", "payload": error_msg}


@tribe_server.command("tribe.sendCrewMessage")
def send_crew_message(ls: TribeLanguageServer, payload: dict) -> dict:
    """Send a message to the entire team."""
    try:
        crew_id = payload.get("crewId")

        # Check if we have the crew in memory
        if crew_id and crew_id in ls.active_crews:
            crew = ls.active_crews[crew_id]
            # If we have a local implementation, use it
            if hasattr(crew, "broadcast_message"):
                responses = crew.broadcast_message(payload.get("message", ""))
                messages = []
                for agent_id, response in responses.items():
                    messages.append(
                        {
                            "id": str(uuid.uuid4()),
                            "sender": agent_id,
                            "content": response,
                            "timestamp": datetime.now().isoformat(),
                            "type": "agent",
                        }
                    )
                return {"type": "MESSAGE_RESPONSE", "payload": messages}

        # If we don't have the crew locally or it doesn't have the broadcast_message method
        # Create a fallback response
        logger.error("No crew found with broadcast_message capability")
        return {
            "type": "ERROR",
            "payload": "Crew not found or doesn't support message broadcasting"
        }

    except Exception as e:
        logger.error(f"Error sending crew message: {str(e)}")
        return {"type": "ERROR", "payload": f"Error sending crew message: {str(e)}"}


class TribeExtension:
    """
    Extension class for Tribe framework.
    Provides commands for interacting with the Tribe framework from the extension.
    """

    def __init__(self):
        """Initialize the extension."""
        self.tribe = None
        self.initialized = False

    async def initialize(self, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Initialize the Tribe framework.

        Args:
            model (str, optional): Model name for foundation model

        Returns:
            dict: Initialization result
        """
        try:
            logger.info("Initializing Tribe extension")
            self.tribe = await Tribe.create(model=model or "anthropic/claude-3-7-sonnet-20250219")
            self.initialized = True

            return {
                "success": True,
                "message": "Tribe extension initialized successfully",
            }
        except Exception as e:
            logger.error(f"Error initializing Tribe extension: {str(e)}")
            return {"success": False, "error": str(e)}

    async def create_team(self, team_spec: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a team based on a specification.

        Args:
            team_spec (dict): Team specification

        Returns:
            dict: Created team details
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Creating team: {team_spec.get('name', 'Unnamed team')}")
            result = await self.tribe.create_team_from_spec(team_spec)

            return {"success": True, "team": result}
        except Exception as e:
            logger.error(f"Error creating team: {str(e)}")
            return {"success": False, "error": str(e)}

    async def execute_workflow(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a workflow with the crew.

        Args:
            workflow (dict): Workflow specification

        Returns:
            dict: Workflow execution results
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(
                f"Executing workflow: {workflow.get('name', 'Unnamed workflow')}"
            )
            result = await self.tribe.execute_workflow(workflow)

            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"Error executing workflow: {str(e)}")
            return {"success": False, "error": str(e)}

    async def analyze_project(self, project_path: str) -> Dict[str, Any]:
        """
        Analyze a project to determine optimal team structure.

        Args:
            project_path (str): Path to the project

        Returns:
            dict: Analysis results
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Analyzing project at {project_path}")
            result = await self.tribe.analyze_project(project_path)

            return {"success": True, "analysis": result}
        except Exception as e:
            logger.error(f"Error analyzing project: {str(e)}")
            return {"success": False, "error": str(e)}

    async def capture_experience(
        self,
        agent_id: str,
        context: Dict[str, Any],
        decision: str,
        outcome: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Record an agent's experience for future learning.

        Args:
            agent_id (str): Identifier for the agent
            context (dict): Situation details when decision was made
            decision (str): What the agent decided to do
            outcome (dict): Results of the decision
            metadata (dict, optional): Additional relevant information

        Returns:
            dict: Result of the operation
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Capturing experience for agent {agent_id}")
            experience_id = self.tribe.learning_system.capture_experience(
                agent_id=agent_id,
                context=context,
                decision=decision,
                outcome=outcome,
                metadata=metadata,
            )

            return {"success": True, "experience_id": experience_id}
        except Exception as e:
            logger.error(f"Error capturing experience: {str(e)}")
            return {"success": False, "error": str(e)}

    async def extract_patterns(
        self,
        agent_id: Optional[str] = None,
        topic: Optional[str] = None,
        outcome_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze experiences to identify recurring patterns.

        Args:
            agent_id (str, optional): Filter by specific agent
            topic (str, optional): Filter by subject area
            outcome_type (str, optional): Filter by result category

        Returns:
            dict: Identified patterns with supporting evidence
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(
                f"Extracting patterns for agent_id={agent_id}, topic={topic}, outcome_type={outcome_type}"
            )
            result = self.tribe.learning_system.extract_patterns(
                agent_id=agent_id, topic=topic, outcome_type=outcome_type
            )

            return {"success": True, "patterns": result}
        except Exception as e:
            logger.error(f"Error extracting patterns: {str(e)}")
            return {"success": False, "error": str(e)}

    async def collect_feedback(
        self,
        source_id: str,
        target_id: str,
        feedback_type: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Record feedback from one entity to another.

        Args:
            source_id (str): Identifier for feedback provider
            target_id (str): Identifier for feedback recipient
            feedback_type (str): Category of feedback
            content (dict): Detailed feedback information
            metadata (dict, optional): Additional contextual information

        Returns:
            dict: Result of the operation
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Collecting feedback from {source_id} to {target_id}")
            feedback_id = self.tribe.feedback_system.collect_feedback(
                source_id=source_id,
                target_id=target_id,
                feedback_type=feedback_type,
                content=content,
                metadata=metadata,
            )

            return {"success": True, "feedback_id": feedback_id}
        except Exception as e:
            logger.error(f"Error collecting feedback: {str(e)}")
            return {"success": False, "error": str(e)}

    async def analyze_feedback(
        self,
        target_id: str,
        feedback_types: Optional[List[str]] = None,
        time_range: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Process collected feedback to identify patterns and insights.

        Args:
            target_id (str): Entity to analyze feedback for
            feedback_types (list, optional): Specific types of feedback to analyze
            time_range (dict, optional): Time period to consider

        Returns:
            dict: Analysis results with patterns and recommendations
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Analyzing feedback for {target_id}")
            result = self.tribe.feedback_system.analyze_feedback(
                target_id=target_id,
                feedback_types=feedback_types,
                time_range=time_range,
            )

            return {"success": True, "analysis": result}
        except Exception as e:
            logger.error(f"Error analyzing feedback: {str(e)}")
            return {"success": False, "error": str(e)}

    async def create_reflection(
        self,
        agent_id: str,
        task_id: str,
        reflection_type: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Record an agent's reflection on its own performance.

        Args:
            agent_id (str): Identifier for the reflecting agent
            task_id (str): Identifier for the task being reflected on
            reflection_type (str): Category of reflection
            content (dict): Detailed reflection information
            metadata (dict, optional): Additional contextual information

        Returns:
            dict: Result of the operation
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Creating reflection for agent {agent_id} on task {task_id}")
            reflection_id = self.tribe.reflection_system.create_reflection(
                agent_id=agent_id,
                task_id=task_id,
                reflection_type=reflection_type,
                content=content,
                metadata=metadata,
            )

            return {"success": True, "reflection_id": reflection_id}
        except Exception as e:
            logger.error(f"Error creating reflection: {str(e)}")
            return {"success": False, "error": str(e)}

    async def extract_insights(
        self,
        agent_id: str,
        reflection_types: Optional[List[str]] = None,
        task_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Analyze reflections to identify insights and learning opportunities.

        Args:
            agent_id (str): Agent to analyze reflections for
            reflection_types (list, optional): Specific types of reflections to analyze
            task_ids (list, optional): Specific tasks to analyze reflections for

        Returns:
            dict: Extracted insights and improvement opportunities
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Extracting insights for agent {agent_id}")
            result = self.tribe.reflection_system.extract_insights(
                agent_id=agent_id, reflection_types=reflection_types, task_ids=task_ids
            )

            return {"success": True, "insights": result}
        except Exception as e:
            logger.error(f"Error extracting insights: {str(e)}")
            return {"success": False, "error": str(e)}

    async def create_improvement_plan(
        self, agent_id: str, opportunities: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate a structured plan to address identified improvement opportunities.

        Args:
            agent_id (str): Agent to create plan for
            opportunities (list): Improvement opportunities to address

        Returns:
            dict: Structured improvement plan
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Creating improvement plan for agent {agent_id}")
            plan = self.tribe.reflection_system.create_improvement_plan(
                agent_id=agent_id, opportunities=opportunities
            )

            return {"success": True, "plan": plan}
        except Exception as e:
            logger.error(f"Error creating improvement plan: {str(e)}")
            return {"success": False, "error": str(e)}

    async def generate_optimized_prompt(
        self,
        purpose: str,
        context: Dict[str, Any],
        constraints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generate an optimized prompt for a specific purpose.

        Args:
            purpose (str): The goal of the prompt
            context (dict): Relevant information for the prompt
            constraints (list, optional): Limitations or requirements

        Returns:
            dict: Optimized prompt
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info(f"Generating optimized prompt for purpose: {purpose}")
            prompt = self.tribe.foundation_model.generate_optimized_prompt(
                purpose=purpose, context=context, constraints=constraints
            )

            return {"success": True, "prompt": prompt}
        except Exception as e:
            logger.error(f"Error generating optimized prompt: {str(e)}")
            return {"success": False, "error": str(e)}

    async def query_model(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        system_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send a prompt to the foundation model and get a response.

        Args:
            prompt (str): The prompt to send
            temperature (float): Creativity parameter (0.0-1.0)
            max_tokens (int): Maximum response length
            system_message (str, optional): System context message

        Returns:
            dict: Model response
        """
        if not self.initialized:
            await self.initialize()

        try:
            logger.info("Querying foundation model")
            response = self.tribe.foundation_model.query_model(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                system_message=system_message,
            )

            return {"success": True, "response": response}
        except Exception as e:
            logger.error(f"Error querying model: {str(e)}")
            return {"success": False, "error": str(e)}


# Create extension instance
extension = TribeExtension()


# Command handlers
async def handle_initialize(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle initialize command."""
    model = params.get("model")
    return await extension.initialize(model=model)


async def handle_create_team(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle create_team command."""
    team_spec = params.get("team_spec", {})
    return await extension.create_team(team_spec=team_spec)


# Add ability to run directly as script
if __name__ == "__main__":
    import sys
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="Tribe Extension CLI")
    parser.add_argument(
        "--create-team", type=str, help="Create a team with the given description"
    )
    args = parser.parse_args()

    if args.create_team:
        # Create team with the given description
        async def run_create_team():
            # First initialize the server
            server_instance = TribeLanguageServer()
            payload = {"description": args.create_team}

            # Create the team
            result = await _create_team_implementation(server_instance, payload)

            # Print result for external consumption
            print(json.dumps(result))

            # Also save to a file for the extension to read
            with open("team_result.json", "w") as f:
                json.dump(result, f)

            return result

        result = asyncio.run(run_create_team())
        sys.exit(0)


async def handle_execute_workflow(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle execute_workflow command."""
    workflow = params.get("workflow", {})
    return await extension.execute_workflow(workflow=workflow)


async def handle_analyze_project(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle analyze_project command."""
    project_path = params.get("project_path", "")
    return await extension.analyze_project(project_path=project_path)


async def handle_capture_experience(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle capture_experience command."""
    agent_id = params.get("agent_id", "")
    context = params.get("context", {})
    decision = params.get("decision", "")
    outcome = params.get("outcome", {})
    metadata = params.get("metadata")
    return await extension.capture_experience(
        agent_id=agent_id,
        context=context,
        decision=decision,
        outcome=outcome,
        metadata=metadata,
    )


async def handle_extract_patterns(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle extract_patterns command."""
    agent_id = params.get("agent_id")
    topic = params.get("topic")
    outcome_type = params.get("outcome_type")
    return await extension.extract_patterns(
        agent_id=agent_id, topic=topic, outcome_type=outcome_type
    )


async def handle_collect_feedback(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle collect_feedback command."""
    source_id = params.get("source_id", "")
    target_id = params.get("target_id", "")
    feedback_type = params.get("feedback_type", "")
    content = params.get("content", {})
    metadata = params.get("metadata")
    return await extension.collect_feedback(
        source_id=source_id,
        target_id=target_id,
        feedback_type=feedback_type,
        content=content,
        metadata=metadata,
    )


async def handle_analyze_feedback(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle analyze_feedback command."""
    target_id = params.get("target_id", "")
    feedback_types = params.get("feedback_types")
    time_range = params.get("time_range")
    return await extension.analyze_feedback(
        target_id=target_id, feedback_types=feedback_types, time_range=time_range
    )


async def handle_create_reflection(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle create_reflection command."""
    agent_id = params.get("agent_id", "")
    task_id = params.get("task_id", "")
    reflection_type = params.get("reflection_type", "")
    content = params.get("content", {})
    metadata = params.get("metadata")
    return await extension.create_reflection(
        agent_id=agent_id,
        task_id=task_id,
        reflection_type=reflection_type,
        content=content,
        metadata=metadata,
    )


async def handle_extract_insights(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle extract_insights command."""
    agent_id = params.get("agent_id", "")
    reflection_types = params.get("reflection_types")
    task_ids = params.get("task_ids")
    return await extension.extract_insights(
        agent_id=agent_id, reflection_types=reflection_types, task_ids=task_ids
    )


async def handle_create_improvement_plan(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle create_improvement_plan command."""
    agent_id = params.get("agent_id", "")
    opportunities = params.get("opportunities", [])
    return await extension.create_improvement_plan(
        agent_id=agent_id, opportunities=opportunities
    )


async def handle_generate_optimized_prompt(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle generate_optimized_prompt command."""
    purpose = params.get("purpose", "")
    context = params.get("context", {})
    constraints = params.get("constraints")
    return await extension.generate_optimized_prompt(
        purpose=purpose, context=context, constraints=constraints
    )


async def handle_query_model(params: Dict[str, Any]) -> Dict[str, Any]:
    """Handle query_model command."""
    prompt = params.get("prompt", "")
    temperature = params.get("temperature", 0.7)
    max_tokens = params.get("max_tokens", 1000)
    system_message = params.get("system_message")
    return await extension.query_model(
        prompt=prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        system_message=system_message,
    )


# Command mapping
command_handlers = {
    "initialize": handle_initialize,
    "create_team": handle_create_team,
    "execute_workflow": handle_execute_workflow,
    "analyze_project": handle_analyze_project,
    "capture_experience": handle_capture_experience,
    "extract_patterns": handle_extract_patterns,
    "collect_feedback": handle_collect_feedback,
    "analyze_feedback": handle_analyze_feedback,
    "create_reflection": handle_create_reflection,
    "extract_insights": handle_extract_insights,
    "create_improvement_plan": handle_create_improvement_plan,
    "generate_optimized_prompt": handle_generate_optimized_prompt,
    "query_model": handle_query_model,
}


async def handle_command(command: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a command from the extension.

    Args:
        command (str): Command to execute
        params (dict): Command parameters

    Returns:
        dict: Command result
    """
    if command in command_handlers:
        try:
            return await command_handlers[command](params)
        except Exception as e:
            logger.error(f"Error handling command {command}: {str(e)}")
            return {"success": False, "error": str(e)}
    else:
        logger.error(f"Unknown command: {command}")
        return {"success": False, "error": f"Unknown command: {command}"}
