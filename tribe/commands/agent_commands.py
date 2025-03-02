"""Commands implementation for Tribe extension using CrewAI."""
import os
import json
import asyncio
import logging
from typing import Dict, List, Optional, Any
from crewai import Agent, Task, Process
from ..core.dynamic import DynamicAgent, DynamicCrew
from crewai.tools import BaseTool
from crewai_tools import (
    CodeInterpreterTool,
    DirectorySearchTool,
    FileReadTool,
    GithubSearchTool,
    # SerperDevTool,  # Requires API key
)
from datetime import datetime
from ..extension import get_webview
import uuid

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentCommands:
    """Implementation of agent-related commands for Tribe extension."""
    
    def __init__(self, workspace_path: str):
        """Initialize AgentCommands with workspace path."""
        self.workspace_path = workspace_path
        self.active_crews: Dict[str, DynamicCrew] = {}
        self.active_agents: Dict[str, DynamicAgent] = {}
        self._setup_default_tools()

    def _setup_default_tools(self):
        """Initialize default tools available to all agents."""
        self.default_tools = [
            CodeInterpreterTool(),
            DirectorySearchTool(),
            FileReadTool(),
            GithubSearchTool(),
            # SerperDevTool(),  # Requires API key
        ]

    async def create_team(self, payload: dict) -> dict:
        """Create a new team using the DynamicCrew and VP of Engineering."""
        try:
            logger.info(f"Creating team for project: {payload.get('description')}")
            
            # Check if we already have a VP of Engineering in the system
            from tribe.crew import Tribe
            vp = None
            
            # Try to get existing VP from Tribe instance if initialized
            if hasattr(Tribe, '_instance') and Tribe._instance and Tribe._instance._initialized:
                crew = Tribe._instance.crew
                if crew and crew.get_active_agents():
                    # Look for existing VP of Engineering
                    for agent in crew.get_active_agents():
                        if agent.role == "VP of Engineering":
                            vp = agent
                            logger.info("Using existing VP of Engineering")
                            break
            
            # Create VP of Engineering if not found
            if not vp:
                try:
                    vp = await DynamicAgent.create_vp_engineering(payload.get('description', ''))
                    logger.info("VP of Engineering created successfully")
                    
                    # Verify VP initialization
                    if not vp.agent_state.project_context.get('initialization_complete'):
                        raise ValueError("VP of Engineering initialization incomplete")
                    
                    # Add default tools to VP
                    vp.tools = self.default_tools.copy()
                    logger.info("Added default tools to VP of Engineering")
                    
                except Exception as e:
                    logger.error(f"Failed to create VP of Engineering: {str(e)}", exc_info=True)
                    return {"error": f"Failed to create VP of Engineering: {str(e)}"}
            
            # Create additional team members
            additional_agents = await self._create_additional_team_members(payload.get('description', ''))
            logger.info(f"Created {len(additional_agents)} additional team members")
            
            # Create dynamic crew with the VP and additional agents
            try:
                all_agents = [vp] + additional_agents
                dynamic_crew = DynamicCrew(
                    config={
                        'agents': all_agents,
                        'tasks': [],
                        'process': Process.hierarchical,
                        'verbose': True,
                        'max_rpm': 60,
                        'share_crew': True,
                        'manager_llm': None,
                        'function_calling_llm': None,
                        'language': 'en',
                        'cache': True,
                        'embedder': None,
                        'full_output': False,
                        'planning': True,
                        'api_endpoint': self.endpoint_url
                    }
                )
                
                # Add all agents to crew and verify
                for agent in all_agents:
                    dynamic_crew.add_agent(agent)
                
                if not dynamic_crew.get_active_agents():
                    raise ValueError("Failed to add agents to crew")
                    
                logger.info("Dynamic crew created and all agents added successfully")
                
            except Exception as e:
                logger.error(f"Failed to create dynamic crew: {str(e)}", exc_info=True)
                return {"error": f"Failed to create team infrastructure: {str(e)}"}
            
            # Store crew for future reference
            crew_id = str(int(asyncio.get_event_loop().time() * 1000))
            self.active_crews[crew_id] = dynamic_crew
            
            # Store agent references
            for agent in all_agents:
                self.active_agents[agent.id] = agent
            
            # Helper function to convert UUID objects to strings
            def convert_uuids_to_strings(obj):
                import uuid
                if isinstance(obj, dict):
                    for key, value in list(obj.items()):
                        if isinstance(value, uuid.UUID):
                            obj[key] = str(value)
                        elif isinstance(value, (dict, list)):
                            convert_uuids_to_strings(value)
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        if isinstance(item, uuid.UUID):
                            obj[i] = str(item)
                        elif isinstance(item, (dict, list)):
                            convert_uuids_to_strings(item)
                return obj
            
            # Return successful response with detailed agent info
            response = {
                "crew_id": crew_id,
                "team": {
                    "id": crew_id,
                    "description": payload.get('description', ''),
                    "agents": [
                        {
                            "id": str(agent.id),
                            "role": agent.role,
                            "name": agent.name,
                            "description": agent.short_description,
                            "status": agent.status,
                            "initialization_complete": agent.agent_state.project_context.get('initialization_complete', False),
                            "tools": [tool.name for tool in agent.tools if hasattr(tool, 'name')]
                        }
                        for agent in all_agents
                    ],
                    "vision": payload.get('description', '')
                }
            }
            
            # Ensure all UUIDs are converted to strings
            return convert_uuids_to_strings(response)
            
        except Exception as e:
            logger.error(f"Error creating team: {str(e)}", exc_info=True)
            return {"error": f"Error creating team: {str(e)}"}

    async def _create_additional_team_members(self, project_description: str) -> List[DynamicAgent]:
        """Create additional team members with character-like names."""
        # Define roles and their corresponding character-like names
        team_roles = [
            {
                "role": "Lead Developer",
                "name": "Spark - Lead Developer",
                "backstory": "A brilliant programmer with a knack for solving complex problems. Known for writing elegant, efficient code and mentoring junior developers.",
                "skills": ["Full-stack development", "System architecture", "Code optimization"]
            },
            {
                "role": "UX Designer",
                "name": "Nova - UX Designer",
                "backstory": "A creative visionary with an eye for detail and user psychology. Creates intuitive, beautiful interfaces that users love.",
                "skills": ["UI/UX design", "User research", "Prototyping", "Visual design"]
            },
            {
                "role": "QA Engineer",
                "name": "Probe - QA Engineer",
                "backstory": "A meticulous tester with an uncanny ability to find edge cases and bugs. Ensures software quality through comprehensive testing strategies.",
                "skills": ["Test automation", "Quality assurance", "Bug tracking", "Performance testing"]
            },
            {
                "role": "DevOps Specialist",
                "name": "Forge - DevOps Specialist",
                "backstory": "An infrastructure expert who builds robust CI/CD pipelines and deployment systems. Keeps the development environment running smoothly.",
                "skills": ["CI/CD", "Cloud infrastructure", "Containerization", "Monitoring"]
            },
            {
                "role": "Security Engineer",
                "name": "Cipher - Security Engineer",
                "backstory": "A security-focused developer who identifies and mitigates potential vulnerabilities. Ensures the application is protected against threats.",
                "skills": ["Security analysis", "Penetration testing", "Authentication systems", "Encryption"]
            }
        ]
        
        # Create agents based on predefined roles
        additional_agents = []
        for role_spec in team_roles:
            agent = DynamicAgent(
                role=role_spec["role"],
                goal=f"Contribute to the project: {project_description}",
                backstory=role_spec["backstory"],
                verbose=True,
                allow_delegation=True,
                tools=self.default_tools.copy()
            )
            
            # Set name and description
            agent.name = role_spec["name"]
            agent.short_description = role_spec["backstory"]
            
            # Set skills
            agent.skills = role_spec["skills"]
            
            # Configure agent
            await agent.configure_collaboration({"team_communication": True})
            await agent.set_autonomy_level(0.7)  # Moderate autonomy
            
            additional_agents.append(agent)
        
        return additional_agents

    async def _create_agent_from_spec(self, agent_spec: Dict, team_spec: Dict) -> Optional[DynamicAgent]:
        """Create a DynamicAgent from specification."""
        try:
            # Create agent with enhanced capabilities
            agent = DynamicAgent(
                role=agent_spec.get("role"),
                goal=agent_spec.get("goal"),
                backstory=agent_spec.get("backstory"),
                verbose=True,
                allow_delegation=True,
                tools=self.default_tools.copy()
            )
            
            # Set name and description if provided
            if "name" in agent_spec:
                agent.name = agent_spec.get("name")
            else:
                agent.name = agent.role
                
            if "description" in agent_spec:
                agent.short_description = agent_spec.get("description")
            else:
                agent.short_description = self._generate_agent_description(agent.role, agent_spec.get("backstory", ""))
            
            # Configure agent based on team specification
            await agent.configure_collaboration(team_spec.get("collaboration", {}))
            await agent.setup_learning_system(team_spec.get("learning", {}))
            
            # Set autonomy level
            autonomy_level = agent_spec.get("autonomy_level", 0.5)
            await agent.set_autonomy_level(autonomy_level)
            
            return agent
        except Exception as e:
            logger.error(f"Error creating agent: {str(e)}")
            return None

    def _find_best_agent_for_task(self, task_spec: Dict, available_agents: List[DynamicAgent]) -> Optional[DynamicAgent]:
        """Find the most suitable agent for a task based on skills and current load."""
        try:
            # Get required skills
            required_skills = set(task_spec.get("required_skills", []))
            
            # Score each agent
            agent_scores = []
            for agent in available_agents:
                # Calculate skill match
                agent_skills = set(agent.skills)
                skill_match = len(required_skills.intersection(agent_skills)) / len(required_skills) if required_skills else 1.0
                
                # Consider current load
                current_tasks = 0  # Simplified without project manager
                load_factor = 1.0 / (current_tasks + 1)
                
                # Consider autonomy level if specified
                required_autonomy = task_spec.get("required_autonomy", 0.5)
                autonomy_match = 1.0 - abs(agent.autonomy_level - required_autonomy)
                
                # Calculate final score
                score = (skill_match * 0.5) + (load_factor * 0.3) + (autonomy_match * 0.2)
                agent_scores.append((score, agent))
            
            # Return agent with highest score
            if agent_scores:
                return max(agent_scores, key=lambda x: x[0])[1]
            return None
        except Exception as e:
            logger.error(f"Error finding best agent: {str(e)}")
            return None

    async def _execute_crew_tasks(self, crew_id: str):
        """Execute crew tasks asynchronously."""
        try:
            crew = self.active_crews.get(crew_id)
            if not crew:
                return
            
            # Execute tasks with proper error handling
            results = await crew.execute_tasks(crew.tasks)
            
            # Process results
            for result in results:
                if isinstance(result, dict) and "error" in result:
                    logger.error(f"Task execution error: {result['error']}")
                    # Handle task failure
                    await self._handle_task_failure(result, crew)
                else:
                    # Process successful result
                    await self._process_task_result(result, crew)
                    
        except Exception as e:
            logger.error(f"Error executing crew tasks: {str(e)}")

    async def _handle_task_failure(self, error_result: Dict, crew: DynamicCrew):
        """Handle task execution failure."""
        try:
            # Create recovery task
            recovery_task = Task(
                description=f"""Analyze and recover from task failure:
                Error: {error_result.get('error')}
                Task: {error_result.get('task')}
                
                1. Analyze failure cause
                2. Propose recovery strategy
                3. Create compensating tasks if needed""",
                expected_output="Recovery plan and actions taken",
                agent=crew.manager_agent
            )
            
            # Execute recovery
            await crew.execute_tasks([recovery_task])
            
        except Exception as e:
            logger.error(f"Error handling task failure: {str(e)}")

    async def _process_task_result(self, result: Any, crew: DynamicCrew):
        """Process successful task result."""
        try:
            # Create analysis task
            analysis_task = Task(
                description=f"""Analyze task result and determine next actions:
                Result: {result}
                
                1. Evaluate success criteria
                2. Identify optimization opportunities
                3. Update learning system
                4. Propose follow-up tasks if needed""",
                expected_output="Analysis and recommendations",
                agent=crew.manager_agent
            )
            
            # Execute analysis
            await crew.execute_tasks([analysis_task])
            
        except Exception as e:
            logger.error(f"Error processing task result: {str(e)}")

    async def initialize_project(self, payload: dict) -> dict:
        """Initialize a project with the created team data."""
        try:
            # Get active crew
            crew_id = payload.get("crew_id")
            if not crew_id or crew_id not in self.active_crews:
                raise ValueError("Invalid crew ID")
            
            crew = self.active_crews[crew_id]
            
            # Create initialization tasks
            init_tasks = [
                Task(
                    description=f"""Initialize project environment:
                    Project: {payload.get('description')}
                    
                    1. Set up project structure
                    2. Configure development environment
                    3. Initialize version control
                    4. Set up CI/CD pipelines
                    5. Configure monitoring and logging""",
                    expected_output="Project initialization report",
                    agent=crew.manager_agent
                ),
                Task(
                    description="""Create project management structure:
                    1. Define milestones
                    2. Create task breakdown
                    3. Set up tracking metrics
                    4. Configure collaboration tools
                    5. Establish review processes""",
                    expected_output="Project management setup report",
                    agent=crew.manager_agent
                )
            ]
            
            # Execute initialization
            results = await crew.execute_tasks(init_tasks)
            
            return {
                "crew_id": crew_id,
                "initialization_results": results,
                "status": "initialized"
            }
            
        except Exception as e:
            logger.error(f"Error initializing project: {str(e)}")
            return {"error": str(e)}

    async def create_agent(self, spec: dict) -> dict:
        """Create a new agent with specified capabilities."""
        try:
            logger.info(f"Creating agent with role: {spec.get('role')}")
            
            # Create agent with enhanced capabilities
            agent = DynamicAgent(
                role=spec.get("role"),
                goal=spec.get("goal"),
                backstory=spec.get("backstory"),
                verbose=True,
                allow_delegation=True,
                tools=self.default_tools.copy()
            )
            
            # Set name and description if provided
            if "name" in spec:
                agent.name = spec.get("name")
            else:
                agent.name = self._generate_unique_agent_name(spec.get("role"))
                
            if "description" in spec:
                agent.short_description = spec.get("description")
            else:
                agent.short_description = self._generate_agent_description(spec.get("role"), spec.get("backstory", ""))
            
            # Configure agent
            await agent.configure_collaboration(spec.get("collaboration", {}))
            await agent.setup_learning_system(spec.get("learning", {}))
            await agent.set_autonomy_level(spec.get("autonomy_level", 0.5))
            
            # Store agent
            self.active_agents[agent.id] = agent
            
            # Helper function to convert UUID objects to strings
            def convert_uuids_to_strings(obj):
                import uuid
                if isinstance(obj, dict):
                    for key, value in list(obj.items()):
                        if isinstance(value, uuid.UUID):
                            obj[key] = str(value)
                        elif isinstance(value, (dict, list)):
                            convert_uuids_to_strings(value)
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        if isinstance(item, uuid.UUID):
                            obj[i] = str(item)
                        elif isinstance(item, (dict, list)):
                            convert_uuids_to_strings(item)
                return obj
            
            # Create response with agent information
            response = {
                "id": agent.id,
                "role": agent.role,
                "name": agent.name,
                "description": agent.short_description,
                "status": "created",
                "capabilities": {
                    "tools": [tool.name for tool in agent.tools],
                    "autonomy_level": agent.autonomy_level,
                    "skills": agent.skills
                }
            }
            
            # Ensure all UUIDs are converted to strings
            return convert_uuids_to_strings(response)
            
        except Exception as e:
            logger.error(f"Error creating agent: {str(e)}")
            return {"error": str(e)}

    def _generate_unique_agent_name(self, role: str) -> str:
        """Generate a unique character-like name for an agent based on their role"""
        # For foundation models, we can simply return the role
        # The actual character-like name will be generated by the model
        return role

    def _generate_agent_description(self, role: str, backstory: str) -> str:
        """Generate a short description based on role and backstory"""
        import random
        
        # Extract key skills or focus areas from backstory
        # This is a simple approach - in a real system, you might use NLP
        skills = []
        key_terms = ["expertise in", "specialized in", "skilled in", "proficient in", "experienced in"]
        for term in key_terms:
            if term in backstory.lower():
                # Extract text after the term until the next period or comma
                start_idx = backstory.lower().find(term) + len(term)
                end_idx = min(
                    backstory.find(".", start_idx) if backstory.find(".", start_idx) != -1 else len(backstory),
                    backstory.find(",", start_idx) if backstory.find(",", start_idx) != -1 else len(backstory)
                )
                if end_idx > start_idx:
                    skills.append(backstory[start_idx:end_idx].strip())
        
        # If no skills were extracted, use generic descriptions
        if not skills:
            skills_text = "various technical areas"
        else:
            skills_text = ", ".join(skills[:2])  # Use at most 2 skills
        
        # Role-specific description templates
        role_templates = {
            "Developer": [
                f"Crafts elegant code solutions with expertise in {skills_text}",
                f"Builds robust software components using {skills_text}",
                f"Transforms requirements into working code with {skills_text}"
            ],
            "Designer": [
                f"Creates intuitive user experiences with {skills_text}",
                f"Designs beautiful interfaces using {skills_text}",
                f"Crafts visual solutions with expertise in {skills_text}"
            ],
            "Project Manager": [
                f"Coordinates team efforts with focus on {skills_text}",
                f"Ensures project success through {skills_text}",
                f"Manages resources and timelines with {skills_text}"
            ],
            "QA Engineer": [
                f"Ensures software quality through {skills_text}",
                f"Validates functionality using {skills_text}",
                f"Prevents bugs and issues with expertise in {skills_text}"
            ],
            "DevOps": [
                f"Streamlines deployment processes with {skills_text}",
                f"Maintains infrastructure using {skills_text}",
                f"Automates operations with expertise in {skills_text}"
            ],
            "Data Scientist": [
                f"Extracts insights from data using {skills_text}",
                f"Builds predictive models with {skills_text}",
                f"Transforms data into knowledge through {skills_text}"
            ],
            "Security Engineer": [
                f"Protects systems and data with {skills_text}",
                f"Implements security measures using {skills_text}",
                f"Identifies and mitigates vulnerabilities through {skills_text}"
            ],
            "Documentation": [
                f"Creates clear documentation using {skills_text}",
                f"Explains complex concepts with {skills_text}",
                f"Maintains knowledge base with expertise in {skills_text}"
            ],
            "VP of Engineering": [
                f"Leads technical strategy with focus on {skills_text}",
                f"Coordinates engineering efforts using {skills_text}",
                f"Drives technical excellence through {skills_text}"
            ]
        }
        
        # Get templates for this role, or use generic ones
        templates = role_templates.get(role, [
            f"Specializes in {skills_text} for optimal results",
            f"Expert in {skills_text} with proven track record",
            f"Brings expertise in {skills_text} to the team"
        ])
        
        # Return a random template
        return random.choice(templates)

    def get_agents(self) -> list:
        """Get all active agents."""
        try:
            return [
                {
                    "id": agent.id,
                    "role": agent.role,
                    "status": agent.status,
                    "current_tasks": 0,  # Simplified without project manager
                    "capabilities": {
                        "tools": [tool.name for tool in agent.tools],
                        "autonomy_level": agent.autonomy_level,
                        "skills": agent.skills
                    }
                }
                for agent in self.active_agents.values()
            ]
        except Exception as e:
            logger.error(f"Error getting agents: {str(e)}")
            return []

    async def send_crew_message(self, payload: dict) -> dict:
        """Send a message to the entire team and get consolidated response via VP of Engineering."""
        try:
            message = payload.get("message")
            if not message:
                raise ValueError("Message is required")
            
            # Find the VP of Engineering
            vp_agent = None
            for agent_id, agent in self.active_agents.items():
                if agent.role == "VP of Engineering":
                    vp_agent = agent
                    break
            
            if not vp_agent:
                logger.error("VP of Engineering not found in active agents")
                return {"error": "VP of Engineering not found"}
            
            responses = []
            vp_response = None
            
            # Create message handling task for each agent except VP
            for agent_id, agent in self.active_agents.items():
                if agent.role == "VP of Engineering":
                    continue  # Skip VP for now, will handle after collecting team responses
                    
                message_task = Task(
                    description=f"""Process and respond to team message:
                    Message: {message}
                    
                    Consider:
                    1. Message context and intent
                    2. Team-wide implications
                    3. Your role's perspective
                    4. Required actions
                    5. Collaboration opportunities""",
                    expected_output="Processed response",
                    agent=agent
                )
                
                # Execute task
                response = await agent.execute_task(message_task)
                responses.append({
                    "agentId": agent_id,
                    "role": agent.role,
                    "response": response,
                    "timestamp": datetime.now().isoformat()
                })
            
            # Now have VP consolidate the team responses and add their own insights
            if responses:
                # Create VP consolidation task
                vp_task = Task(
                    description=f"""As VP of Engineering, consolidate team responses and provide your own insights:
                    Original Message: {message}
                    
                    Team Responses:
                    {json.dumps(responses, indent=2)}
                    
                    Your job is to:
                    1. Synthesize all team input into a coherent response
                    2. Add your own strategic perspective
                    3. Ensure all key points are addressed
                    4. Provide clear next steps
                    5. Communicate in a unified voice to the human""",
                    expected_output="Consolidated response for human",
                    agent=vp_agent
                )
                
                # Execute VP task
                consolidated_response = await vp_agent.execute_task(vp_task)
                
                # Add VP to the responses for record keeping
                responses.append({
                    "agentId": vp_agent.id,
                    "role": "VP of Engineering",
                    "response": consolidated_response,
                    "timestamp": datetime.now().isoformat(),
                    "is_consolidated": True
                })
                
                # Set VP response separately for the return structure
                vp_response = consolidated_response
            else:
                # If no team responses, have VP respond directly
                vp_task = Task(
                    description=f"""As VP of Engineering, respond directly to this message:
                    Message: {message}
                    
                    Provide a comprehensive response that considers all team perspectives,
                    even though you're responding directly.""",
                    expected_output="Direct VP response",
                    agent=vp_agent
                )
                
                # Execute VP task
                vp_response = await vp_agent.execute_task(vp_task)
                
                # Add to responses for record keeping
                responses.append({
                    "agentId": vp_agent.id,
                    "role": "VP of Engineering",
                    "response": vp_response,
                    "timestamp": datetime.now().isoformat(),
                    "is_direct_response": True
                })
            
            return {
                "type": "team_response",
                "consolidated_response": vp_response,
                "individual_responses": responses,
                "vp_id": str(vp_agent.id)
            }
            
        except Exception as e:
            logger.error(f"Error sending team message: {str(e)}")
            return {"error": str(e)}

    async def send_agent_message(self, payload: dict) -> dict:
        """Send a message to a specific agent and get response, with VP oversight for non-VP messages."""
        try:
            agent_id = payload.get("agentId")
            message = payload.get("message")
            skip_vp_oversight = payload.get("skip_vp_oversight", False)
            
            if not agent_id or agent_id not in self.active_agents:
                raise ValueError("Invalid agent ID")
            if not message:
                raise ValueError("Message is required")
            
            agent = self.active_agents[agent_id]
            
            # Find VP agent for oversight
            vp_agent = None
            for a_id, a in self.active_agents.items():
                if a.role == "VP of Engineering":
                    vp_agent = a
                    break
            
            # If message is to VP, or skip_vp_oversight is True, or no VP exists, skip oversight
            if agent.role == "VP of Engineering" or skip_vp_oversight or not vp_agent:
                # Direct message to agent
                message_task = Task(
                    description=f"""Process and respond to direct message:
                    Message: {message}
                    
                    Consider:
                    1. Message context and intent
                    2. Required actions
                    3. Your specific expertise
                    4. Appropriate response format
                    5. Follow-up actions needed""",
                    expected_output="Processed response",
                    agent=agent
                )
                
                # Execute task
                response = await agent.execute_task(message_task)
                
                return {
                    "type": "agent_response",
                    "agentId": agent_id,
                    "agent_role": agent.role,
                    "response": response,
                    "timestamp": datetime.now().isoformat(),
                    "had_vp_oversight": False
                }
            else:
                # For non-VP agents, get their response but have VP review it
                # First get agent's direct response
                agent_task = Task(
                    description=f"""Process and respond to direct message:
                    Message: {message}
                    
                    Consider:
                    1. Message context and intent
                    2. Required actions
                    3. Your specific expertise
                    4. Appropriate response format
                    5. Follow-up actions needed""",
                    expected_output="Processed response",
                    agent=agent
                )
                
                # Execute agent task
                agent_response = await agent.execute_task(agent_task)
                
                # Now have VP review and add oversight
                vp_task = Task(
                    description=f"""As VP of Engineering, review this communication:
                    
                    Original Message to {agent.role}: 
                    {message}
                    
                    {agent.role}'s Response:
                    {agent_response}
                    
                    Your job is to:
                    1. Determine if the response accurately represents the team's position
                    2. Add any missing strategic context or considerations
                    3. Ensure alignment with overall project goals
                    4. Add your comments and oversight in a short addendum
                    5. Be brief and focused in your additions""",
                    expected_output="VP oversight comments",
                    agent=vp_agent
                )
                
                # Execute VP task
                vp_oversight = await vp_agent.execute_task(vp_task)
                
                # Combine response with VP oversight
                combined_response = {
                    "type": "agent_response_with_oversight",
                    "agentId": agent_id,
                    "agent_role": agent.role,
                    "agent_response": agent_response,
                    "vp_id": str(vp_agent.id),
                    "vp_oversight": vp_oversight,
                    "timestamp": datetime.now().isoformat(),
                    "had_vp_oversight": True
                }
                
                return combined_response
            
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            return {"error": str(e)}

    async def analyze_requirements(self, payload: dict) -> list:
        """Analyze requirements and create/update agents using the VP of Engineering."""
        try:
            # Find the existing VP of Engineering to use their expertise
            vp_agent = None
            for agent_id, agent in self.active_agents.items():
                if agent.role == "VP of Engineering":
                    vp_agent = agent
                    break
            
            # If no VP found, create a temporary one
            if not vp_agent:
                logger.info("Creating temporary VP of Engineering for analysis")
                vp_agent = await DynamicAgent.create_vp_engineering("Requirements analysis")
            
            # Create analysis task
            analysis_task = Task(
                description=f"""As the VP of Engineering, analyze these requirements and propose system updates:
                Requirements: {payload.get('requirements')}
                
                Provide a structured analysis including:
                1. Required new agent roles with specific character names and personalities
                2. Updates to existing agents to better meet requirements
                3. New tool requirements and capabilities
                4. Task reorganization needs
                5. Collaboration pattern updates
                6. Implementation priority
                
                Format your response as valid JSON with the following structure:
                {{
                    "analysis": {{
                        "summary": "Brief summary of analysis",
                        "key_requirements": ["req1", "req2"]
                    }},
                    "updates": [
                        {{
                            "type": "new_agent",
                            "priority": 1-5,
                            "specification": {{
                                "role": "Role name",
                                "name": "Character name - Role",
                                "backstory": "Detailed backstory with personality traits",
                                "goal": "Primary agent goal",
                                "required_skills": ["skill1", "skill2"]
                            }}
                        }},
                        {{
                            "type": "agent_update",
                            "agent_id": "existing-agent-id",
                            "priority": 1-5,
                            "changes": {{
                                "skill_additions": ["skill1"],
                                "role_adjustments": "Description of changes"
                            }}
                        }},
                        {{
                            "type": "new_tool",
                            "priority": 1-5,
                            "specification": {{
                                "name": "Tool name",
                                "description": "Tool description",
                                "capabilities": ["cap1", "cap2"],
                                "for_agents": ["role1", "role2"]
                            }}
                        }}
                    ]
                }}""",
                expected_output="Analysis and recommendations in JSON format",
                agent=vp_agent
            )
            
            # Execute analysis
            raw_result = await vp_agent.execute_task(analysis_task)
            
            # Parse the JSON result, handling potential formatting issues
            try:
                # If the result is already a dict, use it directly
                if isinstance(raw_result, dict):
                    analysis = raw_result
                else:
                    # Try to parse the string as JSON
                    analysis = json.loads(raw_result)
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing analysis JSON: {str(e)}")
                
                # Try to extract JSON from markdown blocks if present
                try:
                    import re
                    json_match = re.search(r'```(?:json)?\n(.*?)\n```', raw_result, re.DOTALL)
                    if json_match:
                        extracted_json = json_match.group(1)
                        analysis = json.loads(extracted_json)
                    else:
                        # If no JSON block found, create basic analysis
                        analysis = {
                            "analysis": {"summary": "Could not parse analysis"},
                            "updates": []
                        }
                except Exception as inner_e:
                    logger.error(f"Error extracting JSON from markdown: {str(inner_e)}")
                    analysis = {
                        "analysis": {"summary": "Could not parse analysis"},
                        "updates": []
                    }
            
            # Implement recommendations through the VP
            updates = []
            
            # First, capture the analysis summary
            updates.append({
                "type": "analysis_summary",
                "summary": analysis.get("analysis", {}).get("summary", "No summary provided"),
                "key_requirements": analysis.get("analysis", {}).get("key_requirements", [])
            })
            
            # Process updates in priority order
            sorted_updates = sorted(analysis.get("updates", []), 
                                   key=lambda x: x.get("priority", 5))
            
            for update in sorted_updates:
                update_type = update.get("type")
                
                if update_type == "new_agent":
                    agent_result = await self.create_agent(update.get("specification", {}))
                    updates.append({
                        "type": "agent_created", 
                        "result": agent_result,
                        "priority": update.get("priority", 5)
                    })
                
                elif update_type == "agent_update":
                    agent_id = update.get("agent_id")
                    agent = self.active_agents.get(agent_id)
                    if agent:
                        changes = update.get("changes", {})
                        
                        # Add skills if specified
                        if "skill_additions" in changes and hasattr(agent, "skills"):
                            if not hasattr(agent, "skills"):
                                agent.skills = []
                            agent.skills.extend(changes.get("skill_additions", []))
                        
                        # Update role description if provided
                        if "role_adjustments" in changes and hasattr(agent, "short_description"):
                            agent.short_description = f"{agent.short_description} | {changes.get('role_adjustments')}"
                        
                        updates.append({
                            "type": "agent_updated", 
                            "agent_id": agent_id,
                            "changes": changes,
                            "priority": update.get("priority", 5)
                        })
                
                elif update_type == "new_tool":
                    tool_spec = update.get("specification", {})
                    # Create the tool
                    if vp_agent and hasattr(vp_agent, "create_tool"):
                        tool_result = await vp_agent.create_tool(tool_spec)
                        
                        # Assign tool to specified agents
                        for role in tool_spec.get("for_agents", []):
                            for agent_id, agent in self.active_agents.items():
                                if agent.role == role:
                                    agent.tools.append(tool_result)
                        
                        updates.append({
                            "type": "tool_created", 
                            "result": {
                                "name": tool_spec.get("name"),
                                "description": tool_spec.get("description"),
                                "assigned_to": tool_spec.get("for_agents", [])
                            },
                            "priority": update.get("priority", 5)
                        })
            
            # Have VP create an implementation plan
            if vp_agent:
                plan_task = Task(
                    description=f"""As VP of Engineering, create a brief implementation plan for these updates:
                    Updates: {json.dumps(updates, indent=2)}
                    
                    Provide a concise plan with clear steps, priorities, and timeline.""",
                    expected_output="Implementation plan",
                    agent=vp_agent
                )
                
                implementation_plan = await vp_agent.execute_task(plan_task)
                
                # Add plan to the updates
                updates.append({
                    "type": "implementation_plan",
                    "plan": implementation_plan
                })
            
            return updates
            
        except Exception as e:
            logger.error(f"Error analyzing requirements: {str(e)}")
            return [{"error": str(e)}]

    async def create_task(self, payload: dict) -> dict:
        """Create a new task and assign to appropriate agent."""
        try:
            # Create task specification
            task_spec = {
                "description": payload.get("description"),
                "name": payload.get("name"),
                "required_skills": payload.get("required_skills", []),
                "priority": payload.get("priority", 1),
                "estimated_duration": payload.get("estimated_duration", 1.0),
                "max_parallel_agents": payload.get("max_parallel_agents", 1),
                "min_required_agents": payload.get("min_required_agents", 1),
                "dependencies": payload.get("dependencies", [])
            }
            
            # Find best agent
            assigned_agent = self._find_best_agent_for_task(
                task_spec, 
                list(self.active_agents.values())
            )
            
            if not assigned_agent:
                raise ValueError("No suitable agent found for task")
            
            # Create CrewAI task instead of ProjectTask
            task = Task(
                description=payload.get("description"),
                expected_output=payload.get("expected_output", "Task completed successfully"),
                agent=assigned_agent
            )
            
            # Generate a task ID
            task_id = str(uuid.uuid4())
            
            return {
                "id": task_id,
                "name": payload.get("name"),
                "status": "created",
                "assigned_to": assigned_agent.id,
                "description": payload.get("description")
            }
            
        except Exception as e:
            logger.error(f"Error creating task: {str(e)}")
            return {"error": str(e)}

    async def _create_tool(self, spec: Dict) -> Dict:
        """Create a new tool based on specification."""
        try:
            # Create tool using DynamicAgent's tool creation capability
            tool = await self.active_agents[spec.get("creator_agent_id")].create_tool(spec)
            
            if tool:
                return {
                    "name": tool.name,
                    "description": tool.description,
                    "status": "created"
                }
            return {"error": "Failed to create tool"}
            
        except Exception as e:
            logger.error(f"Error creating tool: {str(e)}")
            return {"error": str(e)} 