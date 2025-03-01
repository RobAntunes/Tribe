import pytest
import pytest_asyncio
import asyncio
import os
from typing import Dict, Any
import os
import sys
from unittest.mock import MagicMock, patch

from src.python.core.crew_manager import CrewManager
from src.python.core.agent_project_manager import TaskStatus, TaskPriority

@pytest.fixture
def mock_flow_analyzer():
    """Create a mock flow analyzer"""
    mock = MagicMock()
    
    class MockFlow:
        def __init__(self):
            self.state = {}
        
        def start(self):
            return {
                'status': 'completed',
                'result': 'Test flow executed successfully'
            }
    
    def mock_get_flow(flow_id):
        if isinstance(flow_id, str):
            return {
                'id': flow_id,
                'preferred_approach': 'test-driven',
                'success_factors': ['Test coverage for all edge cases'],
                'estimated_duration': '2h'
            }
        return MockFlow
    
    mock.get_flow.side_effect = mock_get_flow
    
    mock.analyze_and_generate_flow.return_value = 'test_flow'
    return mock

@pytest_asyncio.fixture
async def crew_manager(tmp_path, mock_flow_analyzer):
    """Create a CrewManager instance with a temporary workspace"""
    workspace_path = str(tmp_path / "test_workspace")
    
    # Create test directories
    os.makedirs(workspace_path, exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'agents'), exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'flows'), exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'projects'), exist_ok=True)
    
    with patch('src.python.core.flow_manager.DynamicFlowAnalyzer', return_value=mock_flow_analyzer):
        manager = CrewManager(workspace_path)
        manager.initialize()
        return manager

@pytest.mark.asyncio
async def test_full_agent_flow_collaboration(crew_manager):
    """Test the complete workflow of creating and using agents with flows"""
    
    # 1. Create an agent with specific expertise
    agent_spec = {
        "name": "TestDev",
        "role": "Python Developer",
        "goal": "Write high-quality Python code with comprehensive test coverage",
        "expertise": ["Python", "Testing", "API Development"],
        "backstory": "Experienced developer focused on writing clean, testable code"
    }
    
    # 2. Define a flow for implementing a test
    flow_requirements = {
        "task_type": "implement_test",
        "description": "Create a unit test for the user authentication module",
        "language": "python",
        "file_type": "test",
        "estimated_duration": "2h",
        "success_factors": [
            "Test coverage for all edge cases",
            "Clear test descriptions"
        ]
    }
    
    # 3. Create collaboration between agent and flow
    collab = await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    
    # 4. Verify collaboration was created successfully
    assert collab["agent"]["name"] == "TestDev"
    assert "project_id" in collab
    assert "task_id" in collab
    
    # 5. Check task was created in project
    task = crew_manager.project_manager.get_task(collab["project_id"], collab["task_id"])
    assert task["name"] == "Execute implement_test"
    assert task["status"] == TaskStatus.PENDING.value
    
    # 6. Execute the flow
    result = await crew_manager.execute_flow(collab["flow_id"])
    assert result["status"] == "completed"
    
    # 7. Verify task status was updated
    task = crew_manager.project_manager.get_task(collab["project_id"], collab["task_id"])
    assert task["status"] == TaskStatus.COMPLETED.value

@pytest.mark.asyncio
async def test_learning_system_integration(crew_manager):
    """Test that the learning system properly influences flow execution"""
    
    # 1. Create multiple collaborations to build learning history
    for i in range(3):
        agent_spec = {
            "name": f"TestDev{i}",
            "role": "Python Developer",
            "goal": "Write high-quality Python code with comprehensive test coverage",
            "expertise": ["Python", "Testing"],
            "backstory": "Experienced Python developer with a focus on testing"
        }
        
        flow_requirements = {
            "task_type": "implement_feature",
            "language": "python",
            "description": f"Implement feature {i}"
        }
        
        await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    
    # 2. Create a new collaboration and verify learning system recommendations
    agent_spec = {
        "name": "TestDev4",
        "role": "Python Developer",
        "goal": "Write high-quality Python code with comprehensive test coverage",
        "expertise": ["Python"],
        "backstory": "Experienced Python developer with a focus on quality"
    }
    
    flow_requirements = {
        "task_type": "implement_feature",
        "language": "python",
        "description": "Implement new feature"
    }
    
    collab = await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    
    # 3. Verify learning system influenced the flow
    flow_metadata = crew_manager.flow_manager.get_flow_metadata(collab["flow_id"])
    assert "preferred_approach" in flow_metadata
    assert "success_factors" in flow_metadata

@pytest.mark.asyncio
async def test_persistence_and_recovery(crew_manager):
    """Test that system state persists and can be recovered"""
    
    # 1. Create initial state
    agent_spec = {
        "name": "TestDev",
        "role": "Python Developer",
        "goal": "Write high-quality Python code with comprehensive test coverage",
        "backstory": "Experienced Python developer with a focus on testing"
    }
    
    flow_requirements = {
        "task_type": "implement_feature",
        "description": "Test feature"
    }
    
    collab1 = await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    
    # 2. Create new manager instance with same workspace
    new_manager = CrewManager(crew_manager.workspace_path)
    new_manager.initialize()
    
    # 3. Verify state was recovered
    agents = new_manager.agent_commands.get_agents()
    agent_names = [agent['name'] for agent in agents]
    assert collab1["agent"]["name"] in agent_names
    assert collab1["flow_id"] in new_manager.flow_manager.get_flows()
    
    # 4. Verify can continue operations
    collab2 = await new_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    assert collab2["project_id"] == collab1["project_id"]  # Same project

@pytest.mark.asyncio
async def test_multi_agent_collaboration(crew_manager):
    """Test multiple agents working together on related tasks"""
    
    # 1. Create a project with multiple tasks
    project_id = await crew_manager._ensure_project_exists()
    
    # 2. Create multiple agents
    agents = []
    for role in ["Backend Developer", "Frontend Developer", "QA Engineer"]:
        agent_spec = {
            "name": f"Test{role.replace(' ', '')}",
            "role": role,
            "goal": f"Deliver high-quality {role} work",
            "expertise": [role],
            "backstory": f"Experienced {role} with a focus on quality and collaboration"
        }
        collab = await crew_manager.create_agent_flow_collaboration(
            agent_spec,
            {"task_type": "setup", "description": f"Setup for {role}"}
        )
        agents.append(collab["agent"])
    
    # 3. Create dependent tasks
    backend_task = crew_manager.project_manager.add_task(
        project_id,
        {
            "name": "Implement API",
            "description": "Create REST API endpoints",
            "priority": TaskPriority.HIGH.value
        }
    )
    
    frontend_task = crew_manager.project_manager.add_task(
        project_id,
        {
            "name": "Implement UI",
            "description": "Create user interface",
            "priority": TaskPriority.MEDIUM.value,
            "dependencies": [backend_task]
        }
    )
    
    qa_task = crew_manager.project_manager.add_task(
        project_id,
        {
            "name": "Test Integration",
            "description": "Test API and UI integration",
            "priority": TaskPriority.LOW.value,
            "dependencies": [backend_task, frontend_task]
        }
    )
    
    # 4. Assign tasks to appropriate agents
    crew_manager.project_manager.assign_agent(project_id, backend_task, agents[0]["id"])
    crew_manager.project_manager.assign_agent(project_id, frontend_task, agents[1]["id"])
    crew_manager.project_manager.assign_agent(project_id, qa_task, agents[2]["id"])
    
    # 5. Verify task dependencies are respected
    tasks = crew_manager.project_manager.get_tasks(project_id)
    assert tasks[frontend_task]["dependencies"] == [backend_task]
    assert sorted(tasks[qa_task]["dependencies"]) == sorted([backend_task, frontend_task])
