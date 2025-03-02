"""
Tribe - Main crew implementation for the Tribe framework
"""

from typing import Dict, Any, Optional, List, Union
from crewai import Crew, Agent, Task, Process
from .core.dynamic import DynamicCrew, DynamicAgent, SystemConfig
from .core.crew_collab import CollaborationMode
from .core.foundation_model import FoundationModelInterface
from .core.learning_system import LearningSystem
from .core.feedback_system import FeedbackSystem
from .core.reflection_system import ReflectionSystem
import os
import asyncio
import logging
import uuid

class Tribe:
    """
    Main class for managing AI agent crews within the Tribe framework.
    """
    _instance = None
    
    def __init__(self, api_endpoint: Optional[str] = None):
        """
        Initialize the Tribe instance.
        
        Args:
            api_endpoint (str, optional): API endpoint for foundation model
        """
        self._dynamic_crew = None
        self._vp_of_engineering = None
        self._api_endpoint = api_endpoint or os.environ.get("TRIBE_API_ENDPOINT", "https://api.tribe.ai/v1")
        self._foundation_model = FoundationModelInterface(api_endpoint=self._api_endpoint)
        self._learning_system = LearningSystem()
        self._feedback_system = FeedbackSystem()
        self._reflection_system = ReflectionSystem()
        self._agent_pool = {}
        
    @classmethod
    def get_instance(cls) -> 'Tribe':
        """
        Get the singleton instance of Tribe.
        
        Returns:
            Tribe: The singleton instance
        """
        if cls._instance is None:
            cls._instance = Tribe()
        return cls._instance
        
    async def initialize(self):
        """
        Initialize the crew and set up the VP of Engineering agent.
        """
        try:
            logging.info("Initializing Tribe")
            
            # Create dynamic crew if it doesn't exist
            if self._dynamic_crew is None:
                config = SystemConfig(
                    api_endpoint=self._api_endpoint,
                    collaboration_mode="HYBRID",
                    process_type="hierarchical"
                )
                self._dynamic_crew = DynamicCrew(config=config)
                
            # Create VP of Engineering agent if it doesn't exist
            if self._vp_of_engineering is None:
                self._vp_of_engineering = await self._create_vp_of_engineering()
                
            # Execute setup task to initialize system state
            setup_task = {
                "description": "Initialize system state and prepare for operation",
                "context": {
                    "system_config": self._dynamic_crew.config.dict()
                }
            }
            
            # Execute setup task with a timeout
            try:
                result = await asyncio.wait_for(
                    self._vp_of_engineering.execute_task(setup_task),
                    timeout=60  # 60 second timeout
                )
                logging.info(f"Setup task result: {result}")
            except asyncio.TimeoutError:
                logging.error("Setup task timed out")
            except Exception as e:
                logging.error(f"Error executing setup task: {str(e)}")
            
            logging.info("Tribe initialization complete")
        except Exception as e:
            logging.error(f"Error initializing Tribe: {str(e)}")
            raise
        
    @classmethod
    async def create(cls, api_endpoint: Optional[str] = None) -> 'Tribe':
        """
        Create and initialize a Tribe instance.
        
        Args:
            api_endpoint (str, optional): API endpoint for foundation model
            
        Returns:
            Tribe: The initialized Tribe instance
        """
        instance = cls(api_endpoint=api_endpoint)
        await instance.initialize()
        return instance
        
    @property
    def crew(self) -> DynamicCrew:
        """
        Get the DynamicCrew instance.
        
        Returns:
            DynamicCrew: The crew instance
        """
        if self._dynamic_crew is None:
            config = SystemConfig(
                api_endpoint=self._api_endpoint,
                collaboration_mode="HYBRID",
                process_type="hierarchical"
            )
            self._dynamic_crew = DynamicCrew(config=config)
        return self._dynamic_crew
        
    @property
    def foundation_model(self) -> FoundationModelInterface:
        """
        Get the FoundationModelInterface instance.
        
        Returns:
            FoundationModelInterface: The foundation model interface
        """
        return self._foundation_model
        
    @property
    def learning_system(self) -> LearningSystem:
        """
        Get the LearningSystem instance.
        
        Returns:
            LearningSystem: The learning system
        """
        return self._learning_system
        
    @property
    def feedback_system(self) -> FeedbackSystem:
        """
        Get the FeedbackSystem instance.
        
        Returns:
            FeedbackSystem: The feedback system
        """
        return self._feedback_system
        
    @property
    def reflection_system(self) -> ReflectionSystem:
        """
        Get the ReflectionSystem instance.
        
        Returns:
            ReflectionSystem: The reflection system
        """
        return self._reflection_system
        
    async def _create_vp_of_engineering(self) -> DynamicAgent:
        """
        Create a VP of Engineering agent.
        
        Returns:
            DynamicAgent: The VP of Engineering agent
        """
        logging.info("Creating VP of Engineering agent")
        
        # Get agent specification from foundation model
        agent_spec = self._foundation_model.get_agent_specification(
            role="VP of Engineering",
            project_context={
                "description": "Tribe AI agent framework",
                "objectives": ["Create and manage AI agent teams", "Optimize team performance"]
            }
        )
        
        # Create the agent
        vp_agent = await self.crew.create_agent(
            role="VP of Engineering",
            name="Genesis",
            backstory="I am the Genesis VP of Engineering, responsible for creating and managing AI agent teams.",
            goal="Optimizing team performance and delivering high-quality results",
            allow_delegation=True,
            memory=True,
            verbose=True,
            tools=[
                "create_agent",
                "create_team",
                "create_workflow",
                "create_task",
                "analyze_project",
                "optimize_team"
            ]
        )
        
        # Add to agent pool and set as VP of Engineering
        self._agent_pool["vp_of_engineering"] = vp_agent
        self._vp_of_engineering = vp_agent
        
        # Create additional team members
        logging.info("Creating additional team members")
        additional_agents = await self._create_additional_team_members()
        
        # Add additional agents to agent pool
        for i, agent in enumerate(additional_agents):
            self._agent_pool[f"agent_{i}"] = agent
            
        logging.info(f"Created {len(additional_agents)} additional team members")
        
        return vp_agent
        
    async def _create_additional_team_members(self) -> List[DynamicAgent]:
        """
        Create additional team members based on foundation model recommendations.
        
        Returns:
            List[DynamicAgent]: List of created agents
        """
        logging.info("Creating team members using foundation model recommendations")
        
        try:
            # Use the VP of Engineering to analyze project and determine optimal team structure
            if not self._vp_of_engineering:
                logging.error("VP of Engineering not initialized")
                return []
                
            # Define project description
            project_description = "Tribe AI agent framework for creating and managing AI agent teams"
            
            # Use the VP to analyze the project and create a team blueprint
            logging.info(f"Analyzing project: {project_description}")
            blueprint = await self._vp_of_engineering.analyze_project(project_description)
            
            if not blueprint or "required_roles" not in blueprint:
                logging.error("Invalid blueprint returned from project analysis")
                return self._create_default_team_members()
                
            logging.info(f"Blueprint generated with {len(blueprint.get('required_roles', []))} roles")
            
            # Create agent specifications from the blueprint
            agent_specs = await self._vp_of_engineering.create_agent_specs(blueprint)
            
            if not agent_specs or len(agent_specs) == 0:
                logging.error("No agent specifications created from blueprint")
                return self._create_default_team_members()
                
            # Create agents based on the specifications
            additional_agents = []
            for spec in agent_specs:
                try:
                    # Log the specification to help with debugging
                    logging.info(f"Creating agent with spec: {spec}")
                    
                    agent = await self.crew.create_agent(
                        role=spec["role"],
                        name=spec["name"],
                        backstory=spec.get("backstory", f"Expert in {spec['role']}"),
                        goal=spec["goal"],
                        allow_delegation=True,
                        memory=True,
                        verbose=True,
                        tools=[
                            "create_task",
                            "analyze_code",
                            "optimize_code",
                            "review_code"
                        ]
                    )
                    
                    # Set additional properties if available
                    if "short_description" in spec:
                        agent.short_description = spec["short_description"]
                    
                    if "collaboration_mode" in spec:
                        agent.collaboration_mode = spec["collaboration_mode"]
                    
                    additional_agents.append(agent)
                    logging.info(f"Created agent: {spec['name']} ({spec['role']})")
                except Exception as e:
                    logging.error(f"Error creating agent {spec.get('name', spec.get('role', 'unknown'))}: {str(e)}")
            
            if len(additional_agents) == 0:
                logging.warning("No agents were created from specifications, falling back to default team")
                return self._create_default_team_members()
                
            logging.info(f"Created {len(additional_agents)} additional team members")
            return additional_agents
            
        except Exception as e:
            logging.error(f"Error creating additional team members: {str(e)}")
            return self._create_default_team_members()
            
    def _create_default_team_members(self) -> List[DynamicAgent]:
        """
        Create default team members as a fallback when the AI-based creation fails.
        
        Returns:
            List[DynamicAgent]: List of created default agents
        """
        logging.info("Creating default team members")
        
        # Define default agent specifications
        default_agents_specs = [
            {
                "role": "Lead Developer",
                "name": "Spark",
                "goal": "Lead the development team and ensure code quality",
                "backstory": "A brilliant programmer with a knack for solving complex problems. Known for writing elegant, efficient code and mentoring junior developers."
            },
            {
                "role": "UX Designer",
                "name": "Nova",
                "goal": "Create intuitive and beautiful user interfaces",
                "backstory": "A creative visionary with an eye for detail and user psychology. Creates intuitive, beautiful interfaces that users love."
            },
            {
                "role": "QA Engineer",
                "name": "Probe",
                "goal": "Ensure software quality and find edge cases",
                "backstory": "A meticulous tester with an uncanny ability to find edge cases and bugs. Ensures software quality through comprehensive testing strategies."
            },
            {
                "role": "DevOps Specialist",
                "name": "Forge",
                "goal": "Optimize deployment and infrastructure",
                "backstory": "An infrastructure expert who builds robust CI/CD pipelines and deployment systems. Keeps the development environment running smoothly."
            },
            {
                "role": "Security Engineer",
                "name": "Cipher",
                "goal": "Ensure application security and prevent vulnerabilities",
                "backstory": "A security-focused developer who identifies and mitigates potential vulnerabilities. Ensures the application is protected against threats."
            }
        ]
        
        # Create the default agents
        agents = []
        for spec in default_agents_specs:
            try:
                agent = DynamicAgent(
                    role=spec["role"],
                    goal=spec["goal"],
                    backstory=spec["backstory"],
                    api_endpoint=self._api_endpoint
                )
                
                # Set name and description
                agent.name = spec["name"]
                agent.short_description = spec["backstory"][:150] + "..." if len(spec["backstory"]) > 150 else spec["backstory"]
                
                # Add to agents list
                agents.append(agent)
                logging.info(f"Created default agent: {spec['name']} ({spec['role']})")
            except Exception as e:
                logging.error(f"Error creating default agent {spec['name']}: {str(e)}")
        
        logging.info(f"Created {len(agents)} default team members")
        return agents
        
    async def analyze_project(self, project_path: str) -> Dict[str, Any]:
        """
        Analyze a project to determine optimal team structure.
        
        Args:
            project_path (str): Path to the project
            
        Returns:
            dict: Analysis results
        """
        try:
            logging.info(f"Analyzing project at {project_path}")
            
            if self._vp_of_engineering is None:
                await self.initialize()
                
            analysis_task = {
                "description": f"Analyze project at {project_path} to determine optimal team structure",
                "context": {
                    "project_path": project_path
                }
            }
            
            # Execute analysis task with a timeout
            try:
                result = await asyncio.wait_for(
                    self._vp_of_engineering.execute_task(analysis_task),
                    timeout=60  # 60 second timeout
                )
                logging.info(f"Analysis task completed")
                return result
            except asyncio.TimeoutError:
                logging.error("Analysis task timed out")
                return {"error": "Analysis task timed out"}
            except Exception as e:
                logging.error(f"Error executing analysis task: {str(e)}")
                return {"error": f"Error analyzing project: {str(e)}"}
        except Exception as e:
            logging.error(f"Error analyzing project: {str(e)}")
            return {"error": f"Error analyzing project: {str(e)}"}
        
    async def create_team_from_spec(self, team_spec: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a team based on a specification.
        
        Args:
            team_spec (dict): Team specification
            
        Returns:
            dict: Created team details
        """
        try:
            logging.info("Creating team from specification")
            
            if self._vp_of_engineering is None:
                await self.initialize()
                
            team_creation_task = {
                "description": "Create a team based on the provided specification",
                "context": {
                    "team_spec": team_spec
                }
            }
            
            # Execute team creation task with a timeout
            try:
                result = await asyncio.wait_for(
                    self._vp_of_engineering.execute_task(team_creation_task),
                    timeout=60  # 60 second timeout
                )
                logging.info(f"Team creation task completed")
                return result
            except asyncio.TimeoutError:
                logging.error("Team creation task timed out")
                return {"error": "Team creation task timed out"}
            except Exception as e:
                logging.error(f"Error executing team creation task: {str(e)}")
                return {"error": f"Error creating team: {str(e)}"}
        except Exception as e:
            logging.error(f"Error creating team from spec: {str(e)}")
            return {"error": f"Error creating team: {str(e)}"}
        
    async def execute_workflow(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a workflow with the crew, supporting parallel and dependent task execution.
        
        Args:
            workflow (dict): Workflow specification with the following structure:
            {
                "name": "Workflow Name",
                "description": "Workflow Description",
                "execution_mode": "parallel|sequential|hybrid",
                "steps": [
                    {
                        "id": "step-1",
                        "name": "Step Name",
                        "description": "Step Description",
                        "assignee": "Agent ID or Role",
                        "execution_mode": "sync|async|parallel|concurrent",
                        "dependencies": [
                            {"id": "step-id", "type": "completion|start|output", "expected_value": "optional value"}
                        ],
                        "timeout_seconds": 300,
                        "max_retries": 3,
                        "priority": 0
                    }
                ]
            }
            
        Returns:
            dict: Workflow execution results
        """
        try:
            workflow_name = workflow.get('name', 'Unnamed workflow')
            logging.info(f"Executing workflow: {workflow_name}")
            
            if self._vp_of_engineering is None:
                await self.initialize()
                
            # Initialize workflow tracking
            workflow_id = workflow.get("id", str(uuid.uuid4()))
            workflow_execution = {
                "id": workflow_id,
                "name": workflow_name,
                "description": workflow.get("description", ""),
                "execution_mode": workflow.get("execution_mode", "sequential"),
                "steps": workflow.get("steps", []),
                "status": "in_progress",
                "started_at": time.time(),
                "completed_at": None,
                "step_results": {},
                "success": False,
                "error": None
            }
            
            # Store steps as tasks for execution
            task_map = {}  # Maps step IDs to task IDs
            execution_map = {}  # Maps step IDs to execution IDs
            for step in workflow.get("steps", []):
                step_id = step.get("id", str(uuid.uuid4()))
                
                # Find the assignee agent
                assignee_id = None
                assignee_spec = step.get("assignee", "")
                if assignee_spec:
                    # Try to find agent by ID first
                    agent = next((a for a in self.crew.get_active_agents() if getattr(a, "id", "") == assignee_spec), None)
                    
                    # If not found by ID, try to find by role
                    if not agent:
                        agent = next((a for a in self.crew.get_active_agents() if getattr(a, "role", "") == assignee_spec), None)
                    
                    if agent:
                        assignee_id = getattr(agent, "id", None)
                
                if not assignee_id:
                    # If no assignee found, use VP of Engineering
                    assignee_id = self._vp_of_engineering.id
                
                # Create a task for this step
                task = Task(
                    description=step.get("description", f"Step {step_id} in workflow {workflow_name}"),
                    expected_output=step.get("expected_output", "Completion of workflow step"),
                    agent=next((a for a in self.crew.get_active_agents() if getattr(a, "id", "") == assignee_id), self._vp_of_engineering)
                )
                
                # Add context to the task
                task.context = {
                    "workflow": workflow,
                    "step": step,
                    "workflow_id": workflow_id,
                    "step_id": step_id
                }
                
                # Add the task to a team
                team_id = list(self.crew._teams.keys())[0] if self.crew._teams else None
                if team_id:
                    self.crew._teams[team_id]["tasks"].append(task)
                
                # Store the task ID for later reference
                task_map[step_id] = task.id
            
            # Convert step dependencies to task dependencies
            dependencies_map = {}
            for step in workflow.get("steps", []):
                step_id = step.get("id", "")
                if step_id in task_map:
                    dependencies = []
                    for dep in step.get("dependencies", []):
                        dep_step_id = dep.get("id", "")
                        if dep_step_id in task_map:
                            dependencies.append({
                                "id": execution_map.get(dep_step_id),  # Will be None for steps not yet scheduled
                                "type": dep.get("type", "completion"),
                                "expected_value": dep.get("expected_value")
                            })
                    dependencies_map[step_id] = dependencies
            
            # Execute steps based on execution mode
            results = {}
            all_execution_ids = []
            
            if workflow.get("execution_mode", "sequential") == "parallel":
                # Execute all steps in parallel
                batch_tasks = []
                
                for step in workflow.get("steps", []):
                    step_id = step.get("id", "")
                    if step_id not in task_map:
                        continue
                    
                    task_id = task_map[step_id]
                    assignee_id = step.get("assignee_id")
                    if not assignee_id:
                        # Find assignee from the task
                        for team in self.crew._teams.values():
                            for task in team.get("tasks", []):
                                if task.id == task_id:
                                    assignee_id = task.agent.id
                                    break
                            if assignee_id:
                                break
                    
                    if not assignee_id:
                        assignee_id = self._vp_of_engineering.id
                    
                    # Prepare task for batch execution
                    batch_tasks.append({
                        "task_id": task_id,
                        "agent_id": assignee_id,
                        "execution_mode": step.get("execution_mode", "parallel"),
                        "dependencies": dependencies_map.get(step_id, []),
                        "priority": step.get("priority", 0),
                        "timeout_seconds": step.get("timeout_seconds", 300),
                        "max_retries": step.get("max_retries", 3)
                    })
                
                # Execute all tasks in batch
                execution_ids = await self.crew.execute_tasks_batch(batch_tasks)
                all_execution_ids.extend(execution_ids)
                
                # Map step IDs to execution IDs for dependency tracking
                for i, step in enumerate(workflow.get("steps", [])):
                    if i < len(execution_ids):
                        execution_map[step.get("id", "")] = execution_ids[i]
                
                # Update dependencies with actual execution IDs
                for step_id, deps in dependencies_map.items():
                    for dep in deps:
                        dep_step_id = next((s.get("id", "") for s in workflow.get("steps", []) if s.get("id", "") == dep.get("id", "")), None)
                        if dep_step_id in execution_map:
                            dep["id"] = execution_map[dep_step_id]
                
                # Wait for all tasks to complete
                # Wait for a bit to let tasks get queued and worker pickup
                await asyncio.sleep(0.5)
                
                # Wait for all tasks to complete with status polling
                pending_executions = set(execution_ids)
                completed_executions = set()
                
                max_wait_time = 600  # 10 minutes maximum wait time
                start_time = time.time()
                
                while pending_executions and (time.time() - start_time) < max_wait_time:
                    for exec_id in list(pending_executions):
                        status = await self.crew.get_task_status(exec_id)
                        if status and status.get("status") in ["completed", "failed", "cancelled"]:
                            pending_executions.remove(exec_id)
                            completed_executions.add(exec_id)
                            
                            # Store result in workflow execution
                            for step in workflow.get("steps", []):
                                step_id = step.get("id", "")
                                if step_id in execution_map and execution_map[step_id] == exec_id:
                                    result = status.get("result", {})
                                    error = status.get("error")
                                    
                                    workflow_execution["step_results"][step_id] = {
                                        "success": status.get("status") == "completed",
                                        "result": result,
                                        "error": error,
                                        "execution_id": exec_id,
                                        "completed_at": status.get("completed_at")
                                    }
                                    
                                    # Store result for later reference
                                    results[step_id] = result
                                    break
                    
                    # Sleep a bit to not hammer the CPU
                    if pending_executions:
                        await asyncio.sleep(1.0)
                
                # Handle any remaining tasks that might have timed out
                for exec_id in pending_executions:
                    # Try to cancel it
                    await self.crew.cancel_task(exec_id)
                    
                    # Find step ID for this execution
                    step_id = next((sid for sid, eid in execution_map.items() if eid == exec_id), None)
                    if step_id:
                        workflow_execution["step_results"][step_id] = {
                            "success": False,
                            "result": None,
                            "error": "Task execution timed out",
                            "execution_id": exec_id,
                            "completed_at": time.time()
                        }
            
            else:  # sequential or hybrid
                # Execute steps in sequence, respecting dependencies
                for step in workflow.get("steps", []):
                    step_id = step.get("id", "")
                    if step_id not in task_map:
                        continue
                    
                    task_id = task_map[step_id]
                    assignee_id = step.get("assignee_id")
                    if not assignee_id:
                        # Find assignee from the task
                        for team in self.crew._teams.values():
                            for task in team.get("tasks", []):
                                if task.id == task_id:
                                    assignee_id = task.agent.id
                                    break
                            if assignee_id:
                                break
                    
                    if not assignee_id:
                        assignee_id = self._vp_of_engineering.id
                    
                    # Schedule the task
                    execution_id = await self.crew.schedule_task(
                        task_id=task_id,
                        agent_id=assignee_id,
                        execution_mode=step.get("execution_mode", "sync"),
                        dependencies=dependencies_map.get(step_id, []),
                        priority=step.get("priority", 0),
                        timeout_seconds=step.get("timeout_seconds", 300),
                        max_retries=step.get("max_retries", 3)
                    )
                    
                    all_execution_ids.append(execution_id)
                    execution_map[step_id] = execution_id
                    
                    # If this is a sync step, wait for it to complete
                    if step.get("execution_mode", "sync") == "sync":
                        # Wait for task to complete
                        completed = False
                        start_time = time.time()
                        timeout = step.get("timeout_seconds", 300)
                        
                        while not completed and (time.time() - start_time) < timeout:
                            status = await self.crew.get_task_status(execution_id)
                            if status and status.get("status") in ["completed", "failed", "cancelled"]:
                                completed = True
                                
                                result = status.get("result", {})
                                error = status.get("error")
                                
                                workflow_execution["step_results"][step_id] = {
                                    "success": status.get("status") == "completed",
                                    "result": result,
                                    "error": error,
                                    "execution_id": execution_id,
                                    "completed_at": status.get("completed_at")
                                }
                                
                                # Store result for later reference
                                results[step_id] = result
                                
                                # If the step failed and it's a sequential workflow, stop execution
                                if status.get("status") != "completed" and workflow.get("execution_mode") == "sequential":
                                    break
                            else:
                                # Sleep a bit to not hammer the CPU
                                await asyncio.sleep(1.0)
                        
                        if not completed:
                            # Try to cancel it
                            await self.crew.cancel_task(execution_id)
                            
                            workflow_execution["step_results"][step_id] = {
                                "success": False,
                                "result": None,
                                "error": "Task execution timed out",
                                "execution_id": execution_id,
                                "completed_at": time.time()
                            }
                            
                            # If this is a sequential workflow, stop execution
                            if workflow.get("execution_mode") == "sequential":
                                break
                    
                    # For hybrid mode, update dependencies after each step
                    if workflow.get("execution_mode") == "hybrid":
                        for next_step in workflow.get("steps", []):
                            next_step_id = next_step.get("id", "")
                            if next_step_id in dependencies_map:
                                for dep in dependencies_map[next_step_id]:
                                    dep_step_id = next((s.get("id", "") for s in workflow.get("steps", []) if s.get("id", "") == dep.get("id", "")), None)
                                    if dep_step_id in execution_map:
                                        dep["id"] = execution_map[dep_step_id]
            
            # Wait for any remaining async tasks to complete
            if workflow.get("execution_mode") != "sequential":
                # Find any remaining steps without results
                remaining_steps = [s.get("id", "") for s in workflow.get("steps", []) if s.get("id", "") not in workflow_execution["step_results"]]
                if remaining_steps:
                    # Wait for a bit to let tasks complete
                    await asyncio.sleep(2.0)
                    
                    # Check for remaining step results
                    for step_id in remaining_steps:
                        if step_id in execution_map:
                            exec_id = execution_map[step_id]
                            status = await self.crew.get_task_status(exec_id)
                            
                            if status and status.get("status") in ["completed", "failed", "cancelled"]:
                                result = status.get("result", {})
                                error = status.get("error")
                                
                                workflow_execution["step_results"][step_id] = {
                                    "success": status.get("status") == "completed",
                                    "result": result,
                                    "error": error,
                                    "execution_id": exec_id,
                                    "completed_at": status.get("completed_at")
                                }
                                
                                # Store result for later reference
                                results[step_id] = result
            
            # Finalize workflow execution
            workflow_execution["completed_at"] = time.time()
            workflow_execution["success"] = all(step.get("success", False) for step in workflow_execution["step_results"].values())
            
            # Capture experience for learning
            try:
                self._learning_system.capture_experience(
                    agent_id=self._vp_of_engineering.id,
                    context={"workflow": workflow},
                    decision="execute_workflow",
                    outcome=workflow_execution,
                    metadata={"workflow_name": workflow_name}
                )
            except Exception as e:
                logging.error(f"Error capturing experience: {str(e)}")
            
            # Create reflection
            try:
                self._reflection_system.create_reflection(
                    agent_id=self._vp_of_engineering.id,
                    task_id=workflow_id,
                    reflection_type="outcome",
                    content={
                        "success": workflow_execution["success"],
                        "steps_completed": len(workflow_execution["step_results"]),
                        "steps_successful": sum(1 for step in workflow_execution["step_results"].values() if step.get("success", False)),
                        "execution_time": workflow_execution["completed_at"] - workflow_execution["started_at"],
                        "execution_mode": workflow_execution["execution_mode"]
                    }
                )
            except Exception as e:
                logging.error(f"Error creating reflection: {str(e)}")
            
            return workflow_execution
        except Exception as e:
            logging.error(f"Error executing workflow: {str(e)}")
            return {"error": f"Error executing workflow: {str(e)}", "success": False}
        
    def cleanup(self):
        """
        Clean up resources when Tribe instance is destroyed.
        """
        logging.info("Cleaning up Tribe resources")
        
        # Clean up crew resources
        if self._dynamic_crew is not None:
            self._dynamic_crew.cleanup()
            
    def __del__(self):
        """
        Destructor to ensure cleanup is called.
        """
        self.cleanup() 