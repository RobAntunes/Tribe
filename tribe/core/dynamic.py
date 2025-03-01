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

# Setup logging
logging.basicConfig(level=logging.INFO)

# Core System Configuration Models
class TaskExecutionConfig(BaseModel):
    """Configuration for task execution behavior"""
    allow_parallel: bool = Field(default=True, description="Allow parallel task execution")
    allow_delegation: bool = Field(default=True, description="Allow task delegation between agents")
    max_concurrent_tasks: int = Field(default=10, ge=1, description="Maximum concurrent tasks")
    retry_failed_tasks: bool = Field(default=True, description="Retry failed tasks automatically")
    max_retries: int = Field(default=3, ge=0, description="Maximum retry attempts")
    use_enhanced_scheduling: bool = Field(default=True, description="Use enhanced task scheduling")

class TeamCreationConfig(BaseModel):
    """Configuration for team creation process"""
    max_retries: int = Field(default=3, ge=0, description="Maximum retry attempts for team creation")
    retry_delay: float = Field(default=1.0, ge=0.0, description="Delay between retries in seconds")
    validation_timeout: float = Field(default=30.0, ge=0.0, description="Timeout for team validation in seconds")
    min_agents_required: int = Field(default=1, ge=1, description="Minimum number of agents required")
    max_team_size: int = Field(default=10, ge=1, description="Maximum team size")

class TeamValidationResult(BaseModel):
    """Result of team validation"""
    is_valid: bool = Field(default=False)
    missing_roles: List[str] = Field(default_factory=list)
    missing_tools: List[str] = Field(default_factory=list)
    validation_errors: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

class SystemConfig(BaseModel):
    """Core system configuration"""
    api_endpoint: str = Field(..., description="API endpoint for AI operations")
    collaboration_mode: Literal["SOLO", "HYBRID", "FULL"] = Field(default="HYBRID")
    process_type: Literal["sequential", "hierarchical"] = Field(default="hierarchical")
    task_execution: TaskExecutionConfig = Field(default_factory=TaskExecutionConfig)
    team_creation: TeamCreationConfig = Field(default_factory=TeamCreationConfig)
    debug: bool = Field(default=False)
    max_rpm: int = Field(default=60, ge=1)
    cache_enabled: bool = Field(default=True)

class AgentMetadata(BaseModel):
    """Essential agent metadata for system operations"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str
    status: Literal["ready", "busy", "error", "dissolved"] = Field(default="ready")
    current_load: int = Field(default=0, ge=0)
    last_active: Optional[float] = None
    skills: List[str] = Field(default_factory=list)

class TaskMetadata(BaseModel):
    """Essential task metadata for system operations"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: Literal["pending", "in_progress", "completed", "failed", "cancelled"] = "pending"
    priority: int = Field(default=0)
    assigned_to: Optional[str] = None
    created_at: float = Field(default_factory=lambda: asyncio.get_event_loop().time())
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    retries: int = Field(default=0)

class TeamState(BaseModel):
    """Team state management"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    active_agents: List[AgentMetadata] = Field(default_factory=list)
    pending_tasks: List[TaskMetadata] = Field(default_factory=list)
    active_tasks: List[TaskMetadata] = Field(default_factory=list)
    completed_tasks: List[TaskMetadata] = Field(default_factory=list)
    creation_time: float = Field(default_factory=lambda: asyncio.get_event_loop().time())
    last_modified: float = Field(default_factory=lambda: asyncio.get_event_loop().time())
    status: Literal["forming", "active", "dissolving", "dissolved"] = "forming"

class SystemState(BaseModel):
    """Global system state"""
    teams: Dict[str, TeamState] = Field(default_factory=dict)
    available_agents: List[AgentMetadata] = Field(default_factory=list)
    global_tasks: List[TaskMetadata] = Field(default_factory=list)
    system_load: float = Field(default=0.0)
    last_cleanup: Optional[float] = None

# Response Schema Models
class RoleRequirement(BaseModel):
    """Model for role requirements"""
    role: str = Field(..., description="Role name")
    goal: str = Field(..., description="Role's primary objective")
    required_skills: List[str] = Field(..., description="Required skills for the role")
    collaboration_pattern: str = Field(..., description="Preferred collaboration mode")
    min_agents: int = Field(default=1, ge=1)
    max_agents: int = Field(default=3, ge=1)

class TeamStructure(BaseModel):
    """Model for team structure"""
    hierarchy: str = Field(..., description="Team hierarchy type (flat/hierarchical)")
    communication: str = Field(..., description="Communication patterns and protocols")
    coordination: str = Field(..., description="Coordination mechanisms")

class ToolRequirement(BaseModel):
    """Model for tool requirements"""
    name: str = Field(..., description="Tool name")
    purpose: str = Field(..., description="Tool purpose")
    required_by: List[str] = Field(..., description="Roles requiring this tool")

class InitialTask(BaseModel):
    """Model for initial tasks"""
    description: str = Field(..., description="Task description")
    assigned_to: str = Field(..., description="Role name of assignee")
    dependencies: List[str] = Field(default_factory=list)
    expected_output: str = Field(..., description="Expected result")

class TeamCompositionResponse(BaseModel):
    """Model for team composition response"""
    required_roles: List[RoleRequirement] = Field(..., min_items=1)
    team_structure: TeamStructure
    tools_required: List[ToolRequirement] = Field(default_factory=list)
    initial_tasks: List[InitialTask] = Field(default_factory=list)

class OptimizationAction(BaseModel):
    """Model for optimization actions"""
    action: str = Field(..., description="Action type (add/remove/modify)")
    role: str = Field(..., description="Role name")
    reason: str = Field(..., description="Explanation for the action")

class RoleAdjustment(BaseModel):
    """Model for role adjustments"""
    agent: str = Field(..., description="Agent name")
    new_role: str = Field(..., description="New role name")
    reason: str = Field(..., description="Explanation for the adjustment")

class CollaborationUpdate(BaseModel):
    """Model for collaboration updates"""
    pattern: str = Field(..., description="New collaboration pattern")
    affected_roles: List[str] = Field(..., description="Affected roles")
    reason: str = Field(..., description="Explanation for the update")

class ToolRecommendation(BaseModel):
    """Model for tool recommendations"""
    tool: str = Field(..., description="Tool name")
    action: str = Field(..., description="Action (add/remove)")
    for_roles: List[str] = Field(..., description="Target roles")
    reason: str = Field(..., description="Explanation for the recommendation")

class TeamOptimizationResponse(BaseModel):
    """Model for team optimization response"""
    composition_changes: List[OptimizationAction] = Field(default_factory=list)
    role_adjustments: List[RoleAdjustment] = Field(default_factory=list)
    collaboration_updates: List[CollaborationUpdate] = Field(default_factory=list)
    tool_recommendations: List[ToolRecommendation] = Field(default_factory=list)


class ToolConfig(BaseModel):
    """Configuration for a tool"""
    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    return_type: str = Field(default="Any")
    category: str = Field(default="custom")
    is_dynamic: bool = Field(default=True)


class AgentModel(BaseModel):
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


class TaskModel(BaseModel):
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


class ToolModel(BaseModel):
    """Model for a tool"""
    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description and purpose")
    capabilities: List[str] = Field(..., min_length=1)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class FlowModel(BaseModel):
    """Model for a workflow"""
    name: str = Field(..., description="Flow name")
    description: str = Field(..., description="Flow description")
    steps: List[str] = Field(..., min_length=1)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class TeamResponse(BaseModel):
    """Model for team response"""
    vision: str = Field(..., description="Project vision statement")
    agents: List[AgentModel] = Field(..., min_length=1)
    tasks: List[TaskModel] = Field(..., min_length=1)
    tools: List[ToolModel] = Field(..., min_length=1)
    flows: List[FlowModel] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class AgentState(BaseModel):
    """Structured state data for DynamicAgent"""

    name: str = Field(default="")
    created_agents: List[Agent] = Field(default_factory=list)
    collaboration_mode: str = Field(default="HYBRID")
    current_team: Optional[str] = Field(default=None)
    status: str = Field(default="ready")
    api_endpoint: str = Field(default="")
    tools_list: List[Any] = Field(default_factory=list)

    model_config = ConfigDict(arbitrary_types_allowed=True, extra="allow")

    def to_dict(self) -> Dict[str, Any]:
        """Convert state to dictionary"""
        return {
            "name": self.name,
            "created_agents": self.created_agents,
            "collaboration_mode": self.collaboration_mode,
            "current_team": self.current_team,
            "status": self.status,
            "api_endpoint": self.api_endpoint,
            "tools": self.tools_list
        }


class VPEngineeringModel(TeamResponse):
    """Model for VP of Engineering initialization, inheriting from TeamResponse"""
    model_config = ConfigDict(arbitrary_types_allowed=True)


class DynamicAgent(Agent):
    """Specialized agent for bootstrapping teams and analyzing project requirements"""
    
    # Define the system_manager field as a private attribute
    _system_manager: Optional[SystemAccessManager] = PrivateAttr(default=None)
    
    # Define name and short_description as attributes
    name: str = ""
    short_description: str = ""
    
    def __init__(self, role: str = "VP of Engineering", goal: str = None, backstory: str = None, api_endpoint: str = None):
        """Initialize DynamicAgent with API endpoint"""
        super().__init__(
            role=role,
            goal=goal or "Create and evolve optimal agent teams for projects",
            backstory=backstory or """You are responsible for analyzing project requirements
            and creating optimal teams of AI agents. You understand different roles, skills,
            and collaboration patterns needed for successful project execution.""",
            tools=[],  # Initialize with empty tools list
            api_endpoint=api_endpoint,
            verbose=True,
            allow_delegation=True
        )
        
        # Initialize name and short_description
        self.name = role
        self.short_description = f"Specialized agent for {role.lower()} tasks"
        
        # Initialize cache and state
        self._analysis_cache = {}
        self._state = {
            "status": "ready",
            "api_endpoint": api_endpoint,
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

    def get_role_context(self) -> dict:
        """Get the current role context for self-referential operations"""
        return self._state["role_context"]

    def update_role_context(self, **kwargs):
        """Update role-specific context"""
        self._state["role_context"].update(kwargs)

    async def verify_system_access(self, system_name: str) -> dict:
        """Verify access to a specific system using the appropriate tool."""
        if not self._system_manager:
            return {
                "has_access": False,
                "error": "System manager not initialized",
                "last_verified": datetime.now().isoformat()
            }
            
        tool = self._system_manager.get_tool(system_name)
        if not tool:
            return {
                "has_access": False,
                "error": f"System {system_name} not found",
                "last_verified": datetime.now().isoformat()
            }
        
        return await tool.execute(agent_role=self.role)

    async def handle_self_referential_query(self, query: str) -> str:
        """Handle queries about the agent's own role and capabilities"""
        context = self.get_role_context()
        
        # Check if query is about system access
        if any(keyword in query.lower() for keyword in ["access", "system", "learning", "project management"]):
            # Verify access for all systems using tools
            access_status = {}
            for system in ["learning_system", "project_management", "collaboration_tools"]:
                access_status[system] = await self.verify_system_access(system)
            
            context["system_access_status"] = access_status
        
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

    @classmethod
    async def create_vp_engineering(cls, project_description: str) -> "DynamicAgent":
        """Create the VP of Engineering that will bootstrap the system"""
        logging.info(f"Creating VP of Engineering for project: {project_description}")
        try:
            # Get API endpoint from environment
            api_endpoint = os.environ.get('AI_API_ENDPOINT')
            if not api_endpoint:
                api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
                logging.info(f"Using default API endpoint: {api_endpoint}")
            else:
                logging.info(f"Using API endpoint from environment: {api_endpoint}")

            # Generate a unique name for the VP
            vp_name = cls._generate_vp_name()
            
            # Generate a short description
            vp_description = cls._generate_vp_description(project_description)
            
            # Initialize VP of Engineering with all available tools
            vp = cls(
                role="VP of Engineering",
                goal=f"Create and evolve an optimal agent ecosystem to build and maintain {project_description}, leveraging parallel execution and built-in systems",
                backstory=f"""You are the VP of Engineering responsible for bootstrapping
                the AI ecosystem. Your purpose is to analyze requirements and create
                the first set of agents needed for building and maintaining a {project_description}.
                
                Available Systems and Tools:
                1. Project Management System:
                   - Task tracking and assignment
                   - Progress monitoring
                   - Resource allocation
                   - Performance metrics
                   - Collaboration tracking
                
                2. Learning System:
                   - Knowledge sharing between agents
                   - Performance improvement tracking
                   - Skill development
                   - Experience accumulation
                   - Adaptation mechanisms
                
                3. Parallel Execution Capabilities:
                   - Multiple instances of the same agent type can be created for parallel task execution
                   - Asynchronous task processing
                   - Concurrent operations
                   - Load balancing between agent instances
                   - Task prioritization and scheduling
                
                You must:
                1. Analyze the project requirements thoroughly
                2. Design a team of specialized AI agents with complementary skills
                   - Create multiple instances of agent types when parallel execution would be beneficial
                   - Configure each agent with access to the project management and learning systems
                3. Define clear roles, responsibilities, and collaboration patterns
                4. Create an initial set of tasks and workflows
                5. Establish communication protocols between agents
                6. Set up the project management system
                7. Configure the learning system for all agents
                8. Ensure the system is self-sustaining
                
                When creating new agents, always:
                1. Grant them access to the project management system
                2. Enable their learning capabilities
                3. Configure their collaboration patterns
                4. Set appropriate autonomy levels
                5. Define their parallel execution preferences
                
                The team you create should be capable of building and maintaining the project
                while adapting to new requirements and challenges. Multiple instances of the same
                agent type can be created to handle parallel workloads efficiently.""",
                api_endpoint=api_endpoint
            )
            
            # Set the unique name and description
            vp.name = vp_name
            vp.short_description = vp_description

            # Initialize state with better tracking
            vp.update_state(
                status="active",
                initialization_complete=True,
                project_context={
                    "description": project_description,
                    "initialization_time": asyncio.get_event_loop().time(),
                    "initialization_status": "completed",
                    "role": "VP of Engineering",
                    "name": vp_name,
                    "short_description": vp_description
                }
            )
            
            logging.info(f"VP of Engineering '{vp_name}' created successfully")
            return vp
            
        except Exception as e:
            logging.error(f"Error creating VP of Engineering: {str(e)}")
            raise

    @classmethod
    def _generate_vp_name(cls) -> str:
        """Generate a unique name for the VP of Engineering"""
        import random
        
        # List of executive-sounding prefixes
        prefixes = ["Chief", "Principal", "Lead", "Head", "Executive", "Senior", "Director"]
        
        # List of technical leadership suffixes
        suffixes = ["Architect", "Strategist", "Engineer", "Innovator", "Technologist", "Builder"]
        
        # Generate a unique name
        prefix = random.choice(prefixes)
        suffix = random.choice(suffixes)
        
        return f"{prefix} {suffix}"

    @classmethod
    def _generate_vp_description(cls, project_description: str) -> str:
        """Generate a short description for the VP of Engineering based on the project"""
        import random
        
        # Extract key terms from project description
        project_terms = project_description.lower().split()
        key_terms = [term for term in project_terms if len(term) > 3 and term not in ["and", "the", "for", "with"]]
        
        # If we have key terms, use them; otherwise use generic terms
        if key_terms:
            focus_area = random.choice(key_terms).capitalize()
        else:
            focus_area = "Technical excellence"
        
        # Templates for VP descriptions
        templates = [
            f"Orchestrates the development of {project_description} with strategic vision",
            f"Leads technical strategy with focus on {focus_area} and innovation",
            f"Architects comprehensive solutions for {project_description}",
            f"Drives engineering excellence in building {project_description}",
            f"Coordinates team efforts to deliver exceptional {focus_area} solutions"
        ]
        
        return random.choice(templates)

    async def analyze_project(self, project_description: str) -> Dict[str, Any]:
        """Analyze project requirements and determine optimal team structure"""
        try:
            logging.info(f"Analyzing project requirements: {project_description}")
            
            # Create analysis task
            analysis_task = Task(
                description=f"""Analyze project requirements and create team blueprint:
                Project: {project_description}
                
                Create a comprehensive analysis including:
                1. Required agent roles and expertise
                2. Team structure and hierarchy
                3. Communication protocols
                4. Required tools and capabilities
                5. Initial task breakdown
                6. Success metrics
                
                Important: For each agent role, provide a unique and descriptive name that reflects their function, along with a detailed description of their responsibilities and personality traits.""",
                expected_output="""Team blueprint in JSON format:
                {
                    "required_roles": [
                        {
                            "role": "Role name",
                            "name": "Unique descriptive name for the agent",
                            "description": "Detailed description of the agent's responsibilities and personality traits",
                            "goal": "Role's primary objective",
                            "required_skills": ["skill1", "skill2"],
                            "collaboration_pattern": "preferred collaboration mode",
                            "min_agents": 1,
                            "max_agents": 3
                        }
                    ],
                    "team_structure": {
                        "hierarchy": "flat/hierarchical",
                        "communication": "patterns and protocols",
                        "coordination": "coordination mechanisms"
                    },
                    "tools_required": [
                        {
                            "name": "tool name",
                            "purpose": "tool purpose",
                            "required_by": ["role1", "role2"]
                        }
                    ],
                    "initial_tasks": [
                        {
                            "description": "task description",
                            "assigned_to": "role name",
                            "dependencies": ["task1", "task2"],
                            "expected_output": "expected result"
                        }
                    ]
                }""",
                agent=self
            )
            
            # Execute analysis
            result = await self.execute_task(analysis_task)
            
            try:
                blueprint = json.loads(result)
                self._analysis_cache[project_description] = blueprint
                return blueprint
            except json.JSONDecodeError:
                raise ValueError("Invalid analysis result format")
            
        except Exception as e:
            logging.error(f"Error analyzing project: {str(e)}")
            raise
    
    async def create_agent_specs(self, blueprint: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create agent specifications from project blueprint"""
        try:
            specs = []
            
            # Generate unique names and descriptions for each role
            for role in blueprint.get("required_roles", []):
                # Create a unique name based on role
                role_name = role["role"]
                unique_name = self._generate_unique_name(role_name)
                
                # Create a concise description
                skills = role.get("required_skills", [])
                short_desc = self._generate_short_description(role_name, skills)
                
                # Create agent specification
                spec = {
                    "name": unique_name,
                    "role": role["role"],
                    "goal": role["goal"],
                    "backstory": role.get("description", f"""Expert in {role['role']} with skills in {', '.join(role['required_skills'])}.
                    Works best in {role['collaboration_pattern']} collaboration mode."""),
                    "short_description": short_desc,
                    "tools": [],  # Tools will be configured by DynamicCrew
                    "collaboration_mode": role["collaboration_pattern"],
                    "min_agents": role.get("min_agents", 1),
                    "max_agents": role.get("max_agents", 1)
                }
                specs.append(spec)
            
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


class DynamicCrew:
    """Dynamic crew management system for agent teams"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize DynamicCrew with configuration"""
        # Parse and validate configuration
        self.config = config
        self.system_state = {}
        
        # Initialize managers
        self.project_manager = config.get('project_manager')
        
        # Initialize agent pool and teams
        self._agent_pool = []
        self._teams = {}
        
        # Initialize task queue
        self._task_queue = asyncio.Queue()
        
        # Setup logging
        if config.get('debug', False):
            logging.basicConfig(level=logging.DEBUG)

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
                "tasks": []
            }
            
            # Store team
            self._teams[team_id] = team
            
            return {
                "team": {
                    "id": team_id,
                    "description": project_description,
                    "agents": [
                        {
                            "id": str(uuid.uuid4()),
                            "role": agent.role,
                            "status": "active"
                        }
                        for agent in selected_agents
                    ]
                }
            }
            
        except Exception as e:
            logging.error(f"Error creating team: {str(e)}")
            raise

    def _update_agent_metadata(self, agent: DynamicAgent) -> AgentMetadata:
        """Update agent metadata"""
        return AgentMetadata(
            id=str(uuid.uuid4()) if not hasattr(agent, 'id') else agent.id,
            name=agent.name,
            role=agent.role,
            status=agent.status,
            current_load=len(agent._collaboration_tasks),
            last_active=asyncio.get_event_loop().time(),
            skills=[tool.name for tool in agent.tools if hasattr(tool, 'name')]
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
                if agent_obj:
                    updated_metadata = self._update_agent_metadata(agent_obj)
                    agent.status = updated_metadata.status
                    agent.current_load = updated_metadata.current_load
                    agent.last_active = updated_metadata.last_active

    async def dissolve_team(self, team_id: str) -> bool:
        """Dissolve a team and release its agents"""
        try:
            if team_id not in self._teams:
                return False
            
            team = self._teams[team_id]
            
            # Stop agent tasks
            for agent in team["agents"]:
                await agent.stop_background_tasks()
                agent.current_team = None
            
            # Remove team
            del self._teams[team_id]
            
            logging.info(f"Team {team_id} dissolved")
            return True
            
        except Exception as e:
            logging.error(f"Error dissolving team: {str(e)}")
            return False

    async def regroup_team(self, team_id: str, new_requirements: str) -> Dict[str, Any]:
        """Regroup an existing team based on new requirements"""
        try:
            if team_id not in self._teams:
                raise ValueError(f"Team {team_id} not found")
            
            # Get current team
            current_team = self._teams[team_id]
            
            # Query new composition
            new_composition = await self._query_team_composition(new_requirements)
            
            # Find agents to remove and add
            current_agents = set(current_team["agents"])
            required_roles = new_composition.get("required_roles", [])
            
            # Select new agents
            new_agents = await self._select_agents(required_roles)
            new_agent_set = set(new_agents)
            
            # Determine changes
            agents_to_remove = current_agents - new_agent_set
            agents_to_add = new_agent_set - current_agents
            
            # Update team
            for agent in agents_to_remove:
                await agent.stop_background_tasks()
                agent.current_team = None
                current_team["agents"].remove(agent)
            
            for agent in agents_to_add:
                agent.current_team = team_id
                await agent.start_background_tasks()
                current_team["agents"].append(agent)
            
            current_team["description"] = new_requirements
            
            logging.info(f"Team {team_id} regrouped: {len(agents_to_remove)} agents removed, {len(agents_to_add)} agents added")
            
            return {
                "team": {
                    "id": team_id,
                    "description": new_requirements,
                    "agents": [
                        {
                            "id": str(uuid.uuid4()),
                            "role": agent.role,
                            "goal": agent.goal,
                            "status": "active"
                        }
                        for agent in current_team["agents"]
                    ]
                }
            }
            
        except Exception as e:
            logging.error(f"Error regrouping team: {str(e)}")
            raise

    async def execute_tasks(self, tasks: List[Task], team_id: Optional[str] = None) -> List[str]:
        """Execute tasks with a specific team or best available agents"""
        try:
            results = []
            
            # Get available agents
            available_agents = self._teams[team_id]["agents"] if team_id else self._agent_pool
            
            for task in tasks:
                # Find best agent for task
                agent = self._find_best_agent(task, available_agents)
                if not agent:
                    raise ValueError(f"No suitable agent found for task: {task.description}")
                
                # Schedule and execute task
                await agent.schedule_task(task)
                result = await agent.execute_task(task)
                results.append(result)
            
            return results
            
        except Exception as e:
            logging.error(f"Error executing tasks: {str(e)}")
            raise

    def _find_best_agent(self, task: Task, available_agents: List[DynamicAgent]) -> Optional[DynamicAgent]:
        """Find the best agent for a task from available agents"""
        best_agent = None
        best_score = -1
        
        for agent in available_agents:
            score = self._calculate_agent_score(agent, task)
            if score > best_score:
                best_score = score
                best_agent = agent
        
        return best_agent

    def _calculate_agent_score(self, agent: DynamicAgent, task: Task) -> float:
        """Calculate how well an agent matches a task"""
        score = 0.0
        
        # Check required skills
        if hasattr(task, 'required_skills'):
            matching_skills = sum(1 for skill in task.required_skills if skill in agent.tools)
            score += matching_skills / len(task.required_skills) if task.required_skills else 0
        
        # Check agent load
        if hasattr(agent, '_collaboration_tasks'):
            load_factor = 1.0 - (len(agent._collaboration_tasks) / 10)  # Assume max 10 tasks
            score += load_factor
        
        # Check agent status
        if agent.status == "ready":
            score += 1.0
        
        return score

    async def cleanup(self):
        """Clean up all crews and release resources"""
        try:
            logging.info("Cleaning up all crews")
            
            # Dissolve all teams
            for team_id in list(self._teams.keys()):
                await self.dissolve_team(team_id)
            
            # Clear agent pool
            self._agent_pool.clear()
            
            # Clear queues
            self._task_queue = asyncio.Queue()
            
            logging.info("Crew cleanup completed")
            
        except Exception as e:
            logging.error(f"Error during crew cleanup: {str(e)}")
            raise

class ProjectTask(Task):
    """Enhanced task model with project management capabilities"""
    
    def __init__(self, description: str, expected_output: str, agent: Agent,
                 priority: int = 1, estimated_duration: float = 1.0,
                 required_skills: List[str] = None, max_parallel_agents: int = 1,
                 min_required_agents: int = 1):
        """Initialize ProjectTask"""
        super().__init__(description=description, expected_output=expected_output, agent=agent)
        
        # Additional project management fields
        self.priority = priority
        self.estimated_duration = estimated_duration
        self.required_skills = required_skills or []
        self.max_parallel_agents = max_parallel_agents
        self.min_required_agents = min_required_agents
        
        # Task state
        self.state = TaskMetadata(
            id=str(uuid.uuid4()),
            status="pending",
            priority=priority,
            assigned_to=agent.id if hasattr(agent, 'id') else None
        )
        
        # Dependencies
        self.dependencies = []
        
    def add_dependency(self, task: 'ProjectTask') -> None:
        """Add a dependency to this task"""
        if task.state.id not in self.dependencies:
            self.dependencies.append(task.state.id)

class ProjectManager:
    """Project management system for task tracking and execution"""
    
    def __init__(self):
        """Initialize ProjectManager"""
        self.tasks = {}
        self.active_tasks = set()
        self.completed_tasks = set()
        self.task_dependencies = {}
        self.task_states = {}

    async def add_task(self, task: ProjectTask) -> None:
        """Add a task to the project manager"""
        self.tasks[task.state.id] = task
        self.task_states[task.state.id] = task.state
        
        # Add task dependencies
        if hasattr(task, 'dependencies'):
            self.task_dependencies[task.state.id] = set(task.dependencies)

    async def update_task_state(self, task_id: str, state: Dict[str, Any]) -> None:
        """Update task state"""
        if task_id in self.task_states:
            self.task_states[task_id].update(state)
            
            # Update task sets based on status
            if state.get('status') == 'completed':
                self.active_tasks.discard(task_id)
                self.completed_tasks.add(task_id)
            elif state.get('status') == 'in_progress':
                self.active_tasks.add(task_id)

    async def get_available_tasks(self) -> List[ProjectTask]:
        """Get tasks that are ready to be executed"""
        available_tasks = []
        
        for task_id, task in self.tasks.items():
            # Skip completed or active tasks
            if task_id in self.completed_tasks or task_id in self.active_tasks:
                continue
                
            # Check if all dependencies are completed
            dependencies = self.task_dependencies.get(task_id, set())
            if all(dep in self.completed_tasks for dep in dependencies):
                available_tasks.append(task)
                
        return available_tasks

    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a task"""
        return self.task_states.get(task_id)

    async def cleanup(self) -> None:
        """Clean up completed tasks and update states"""
        # Archive completed tasks
        for task_id in self.completed_tasks:
            if task_id in self.tasks:
                del self.tasks[task_id]
                del self.task_states[task_id]
                if task_id in self.task_dependencies:
                    del self.task_dependencies[task_id]