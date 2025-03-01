import pytest
from tribe.src.python.core.crew_manager import CrewManager
from tribe.src.python.core.agent_project_manager import AgentProjectManager

def test_crew_manager_initialization():
    crew_manager = CrewManager()
    assert crew_manager is not None

def test_create_agent():
    crew_manager = CrewManager()
    agent = crew_manager.create_agent("Test Agent", "Developer", "A test agent")
    
    assert agent is not None
    assert agent["name"] == "Test Agent"
    assert agent["role"] == "Developer"
    assert agent["backstory"] == "A test agent"

def test_create_crew():
    crew_manager = CrewManager()
    requirements = "Build a React application"
    crew = crew_manager.create_crew(requirements)
    
    assert crew is not None
    assert len(crew) > 0
    assert all("id" in agent for agent in crew)
    assert all("role" in agent for agent in crew)

def test_agent_interaction():
    crew_manager = CrewManager()
    agent = crew_manager.create_agent("Test Agent", "Developer", "A test agent")
    response = crew_manager.interact_with_agent(agent["id"], "What's your role?")
    
    assert response is not None
    assert isinstance(response, str)
    assert len(response) > 0

def test_crew_task_assignment():
    crew_manager = CrewManager()
    crew = crew_manager.create_crew("Build a React application")
    task = crew_manager.create_task("Create component", "Create a new React component")
    
    assigned_agent = crew_manager.assign_task(task["id"], crew[0]["id"])
    assert assigned_agent is not None
    assert assigned_agent["id"] == crew[0]["id"]

def test_crew_collaboration():
    crew_manager = CrewManager()
    crew = crew_manager.create_crew("Build a React application")
    
    # Test collaboration between agents
    result = crew_manager.collaborate(
        crew[0]["id"],
        crew[1]["id"],
        "Review this code implementation"
    )
    
    assert result is not None
    assert "review" in result
    assert "suggestions" in result

def test_crew_integration_with_project_manager():
    crew_manager = CrewManager()
    project_manager = AgentProjectManager()
    
    # Test crew creation with project context
    project_context = project_manager.get_project_context()
    crew = crew_manager.create_crew("Improve error handling", project_context)
    
    assert crew is not None
    assert len(crew) > 0
    assert all("expertise" in agent for agent in crew)
