"""Commands implementation for Tribe extension using CrewAI."""
import os
import json
import asyncio
import logging
from typing import Dict, List, Optional, Any
from crewai import Agent, Task, Process
from ..core.dynamic import DynamicAgent, DynamicCrew, ProjectManager, ProjectTask
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

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentCommands:
    """Implementation of agent-related commands for Tribe extension."""
    
    def __init__(self, workspace_path: str):
        """Initialize AgentCommands with workspace path."""
        self.workspace_path = workspace_path
        self.project_manager = ProjectManager()
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
            
            # Create VP of Engineering first
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
            
            # Create dynamic crew with the VP
            try:
                dynamic_crew = DynamicCrew(
                    config={
                        'agents': [vp],
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
                
                # Add VP to crew and verify
                dynamic_crew.add_agent(vp)
                if not dynamic_crew.get_active_agents():
                    raise ValueError("Failed to add VP of Engineering to crew")
                    
                logger.info("Dynamic crew created and VP of Engineering added successfully")
                
            except Exception as e:
                logger.error(f"Failed to create dynamic crew: {str(e)}", exc_info=True)
                return {"error": f"Failed to create team infrastructure: {str(e)}"}
            
            # Store crew for future reference
            crew_id = str(int(asyncio.get_event_loop().time() * 1000))
            self.active_crews[crew_id] = dynamic_crew
            
            # Store VP reference
            self.active_agents[vp.id] = vp
            
            # Return successful response with detailed agent info
            return {
                "crew_id": crew_id,
                "team": {
                    "id": crew_id,
                    "description": payload.get('description', ''),
                    "agents": [{
                        "id": vp.id,
                        "role": vp.role,
                        "status": vp.status,
                        "initialization_complete": vp.agent_state.project_context.get('initialization_complete', False),
                        "tools": [tool.name for tool in vp.tools if hasattr(tool, 'name')]
                    }]
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating team: {str(e)}", exc_info=True)
            return {"error": f"Error creating team: {str(e)}"}

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

    async def _create_task_from_spec(self, task_spec: Dict, available_agents: List[DynamicAgent]) -> Optional[ProjectTask]:
        """Create a ProjectTask from specification."""
        try:
            # Find best agent for task
            assigned_agent = self._find_best_agent_for_task(task_spec, available_agents)
            if not assigned_agent:
                return None
            
            # Create task with project management integration
            task = ProjectTask(
                description=task_spec.get("description"),
                expected_output=task_spec.get("expected_output"),
                agent=assigned_agent,
                priority=task_spec.get("priority", 1),
                estimated_duration=task_spec.get("estimated_duration", 1.0),
                required_skills=task_spec.get("required_skills", []),
                max_parallel_agents=task_spec.get("max_parallel_agents", 1),
                min_required_agents=task_spec.get("min_required_agents", 1)
            )
            
            # Add dependencies if specified
            for dep_id in task_spec.get("dependencies", []):
                if dep_id in self.project_manager.tasks:
                    task.add_dependency(self.project_manager.tasks[dep_id])
            
            return task
        except Exception as e:
            logger.error(f"Error creating task: {str(e)}")
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
                current_tasks = len([t for t in self.project_manager.tasks.values() if agent.id in t.state.assigned_agents])
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
            # Generate a unique name if not provided
            if not spec.get("name"):
                role = spec.get("role", "Agent")
                spec["name"] = self._generate_unique_agent_name(role)
            
            # Generate a short description if not provided
            if not spec.get("short_description"):
                role = spec.get("role", "Agent")
                backstory = spec.get("backstory", "")
                spec["short_description"] = self._generate_agent_description(role, backstory)
            
            # Create agent with enhanced capabilities
            agent = DynamicAgent(
                role=spec.get("role"),
                goal=spec.get("goal"),
                backstory=spec.get("backstory"),
                verbose=True,
                allow_delegation=True,
                tools=self.default_tools.copy()
            )
            
            # Set name and short description
            agent.name = spec.get("name")
            agent.short_description = spec.get("short_description")
            
            # Configure agent
            await agent.configure_collaboration(spec.get("collaboration", {}))
            await agent.setup_learning_system(spec.get("learning", {}))
            await agent.set_autonomy_level(spec.get("autonomy_level", 0.5))
            
            # Store agent
            self.active_agents[agent.id] = agent
            
            return {
                "id": agent.id,
                "name": agent.name,
                "role": agent.role,
                "short_description": agent.short_description,
                "status": "created",
                "capabilities": {
                    "tools": [tool.name for tool in agent.tools],
                    "autonomy_level": agent.autonomy_level,
                    "skills": agent.skills
                }
            }
        except Exception as e:
            logger.error(f"Error creating agent: {str(e)}")
            return {"error": str(e)}

    def _generate_unique_agent_name(self, role: str) -> str:
        """Generate a unique name for an agent based on their role"""
        import random
        import string
        
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
                    "current_tasks": len([t for t in self.project_manager.tasks.values() 
                                       if agent.id in t.state.assigned_agents]),
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
        """Send a message to the entire team and get responses."""
        try:
            message = payload.get("message")
            if not message:
                raise ValueError("Message is required")
            
            responses = []
            
            # Create message handling task for each agent
            for agent_id, agent in self.active_agents.items():
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
                    "response": response,
                    "timestamp": datetime.now().isoformat()
                })
            
            return {
                "type": "team_response",
                "responses": responses
            }
            
        except Exception as e:
            logger.error(f"Error sending team message: {str(e)}")
            return {"error": str(e)}

    async def send_agent_message(self, payload: dict) -> dict:
        """Send a message to a specific agent and get response."""
        try:
            agent_id = payload.get("agentId")
            message = payload.get("message")
            
            if not agent_id or agent_id not in self.active_agents:
                raise ValueError("Invalid agent ID")
            if not message:
                raise ValueError("Message is required")
            
            agent = self.active_agents[agent_id]
            
            # Create message handling task
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
                "response": response,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            return {"error": str(e)}

    async def analyze_requirements(self, payload: dict) -> list:
        """Analyze requirements and create/update agents."""
        try:
            # Create VP of Engineering for analysis
            vp = DynamicAgent()
            
            # Create analysis task
            analysis_task = Task(
                description=f"""Analyze requirements and propose system updates:
                Requirements: {payload.get('requirements')}
                
                Provide:
                1. Required new agent roles
                2. Updates to existing agents
                3. New tool requirements
                4. Task reorganization needs
                5. Collaboration pattern updates""",
                expected_output="Analysis and recommendations JSON",
                agent=vp
            )
            
            # Execute analysis
            result = await vp.execute_task(analysis_task)
            analysis = json.loads(result)
            
            # Implement recommendations
            updates = []
            for update in analysis.get("updates", []):
                if update["type"] == "new_agent":
                    agent_result = await self.create_agent(update["specification"])
                    updates.append({"type": "agent_created", "result": agent_result})
                elif update["type"] == "agent_update":
                    agent = self.active_agents.get(update["agent_id"])
                    if agent:
                        await agent.update_configuration(update["changes"])
                        updates.append({"type": "agent_updated", "agent_id": agent.id})
                elif update["type"] == "new_tool":
                    tool_result = await self._create_tool(update["specification"])
                    updates.append({"type": "tool_created", "result": tool_result})
            
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
            
            # Create project task
            task = await self._create_task_from_spec(task_spec, [assigned_agent])
            
            if not task:
                raise ValueError("Failed to create task")
            
            # Add to project manager
            await self.project_manager.add_task(task)
            
            return {
                "id": task.state.id,
                "name": payload.get("name"),
                "status": task.state.status,
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