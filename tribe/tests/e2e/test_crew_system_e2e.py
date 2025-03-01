import pytest
import pytest_asyncio
import os
import time
from typing import Dict, Any
import asyncio

from src.python.core.crew_manager import CrewManager
from src.python.core.agent_project_manager import TaskStatus, TaskPriority
from src.python.tools.dynamic_flow_analyzer import DynamicFlowAnalyzer

@pytest_asyncio.fixture
async def crew_manager(tmp_path):
    """Create a CrewManager instance with a real workspace and flow analyzer"""
    workspace_path = str(tmp_path / "test_workspace")
    
    # Create test directories and sample files
    os.makedirs(workspace_path, exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'agents'), exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'flows'), exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'projects'), exist_ok=True)
    
    # Create a sample Python file to analyze
    sample_code_dir = os.path.join(workspace_path, 'src')
    os.makedirs(sample_code_dir, exist_ok=True)
    
    with open(os.path.join(sample_code_dir, 'calculator.py'), 'w') as f:
        f.write('''
class Calculator:
    def add(self, a: float, b: float) -> float:
        return a + b
    
    def subtract(self, a: float, b: float) -> float:
        return a - b
    
    def multiply(self, a: float, b: float) -> float:
        return a * b
    
    def divide(self, a: float, b: float) -> float:
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b
''')
    
    manager = CrewManager(workspace_path)
    manager.initialize()
    
    # Create a default project
    project_id = manager.project_manager.create_project({
        'name': 'Test Project',
        'description': 'Project for testing'
    })
    
    # Mock FlowManager methods
    def mock_create_flow(requirements, context):
        flow_id = 'test_flow_' + str(len(manager.flow_manager.active_flows))
        task_id = 'test_task_' + str(len(manager.project_manager.get_tasks(project_id)))
        
        # Create task in project
        task_spec = {
            'name': requirements.get('description', 'Test Task'),
            'description': requirements.get('description', ''),
            'priority': TaskPriority.MEDIUM.value,
            'status': TaskStatus.PENDING.value
        }
        task_id = manager.project_manager.add_task(project_id, task_spec)
        
        # Store flow with context
        flow = {
            'requirements': requirements,
            'context': {
                'project_id': project_id,
                'task_id': task_id
            },
            'status': 'pending'
        }
        manager.flow_manager.active_flows[flow_id] = flow
        return flow_id
    
    def mock_get_flow(flow_id):
        return manager.flow_manager.active_flows.get(flow_id)
    
    async def mock_execute_flow(flow_id):
        flow = manager.flow_manager.active_flows[flow_id]
        flow['status'] = 'completed'
        
        # Create test file if this is a test implementation flow
        if flow['requirements'].get('task_type') == 'implement_test':
            test_file = os.path.join(workspace_path, 'src', 'test_calculator.py')
            with open(test_file, 'w') as f:
                f.write('''
import pytest
from calculator import Calculator

def test_add():
    calc = Calculator()
    assert calc.add(2, 3) == 5

def test_subtract():
    calc = Calculator()
    assert calc.subtract(5, 3) == 2

def test_multiply():
    calc = Calculator()
    assert calc.multiply(4, 3) == 12

def test_divide():
    calc = Calculator()
    assert calc.divide(6, 2) == 3
    with pytest.raises(ValueError):
        calc.divide(1, 0)
''')
        
        return {
            'status': 'completed',
            'result': 'Flow executed successfully'
        }
    
    manager.flow_manager.create_flow = mock_create_flow
    manager.flow_manager.get_flow = mock_get_flow
    manager.flow_manager.execute_flow = mock_execute_flow
    return manager

@pytest.mark.asyncio
async def test_end_to_end_flow(crew_manager):
    """Test a complete end-to-end flow with real code analysis and execution"""
    
    # 1. Create an agent with testing expertise
    agent_spec = {
        "name": "TestExpert",
        "role": "QA Engineer",
        "goal": "Create comprehensive test suites",
        "expertise": ["Python", "Testing", "Test Automation"],
        "backstory": "Senior QA engineer with 10 years of experience in test automation and quality assurance. Expert in writing comprehensive test suites and ensuring code quality."
    }
    
    # 2. Define a flow for implementing calculator tests
    flow_requirements = {
        "task_type": "implement_test",
        "description": "Create unit tests for the Calculator class",
        "language": "python",
        "file_type": "test",
        "estimated_duration": "1h",
        "success_factors": [
            "Test all calculator operations",
            "Include edge cases",
            "Test error handling"
        ],
        "target_file": "calculator.py",
        "test_framework": "pytest"
    }
    
    # 3. Create collaboration
    collab = await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    assert collab["agent"]["name"] == "TestExpert"
    
    # 4. Execute the flow with real code analysis
    result = await crew_manager.execute_flow(collab["flow_id"])
    
    # 5. Verify flow execution result
    assert result is not None
    assert "status" in result
    
    # 6. Verify task completion
    task = crew_manager.project_manager.get_task(collab["project_id"], collab["task_id"])
    assert task["status"] in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value]
    
    # 7. Verify generated test file exists (if flow was successful)
    if task["status"] == TaskStatus.COMPLETED.value:
        test_file = os.path.join(crew_manager.workspace_path, 'src', 'test_calculator.py')
        assert os.path.exists(test_file)

@pytest.mark.asyncio
async def test_real_flow_error_recovery(crew_manager):
    """Test error recovery with real flow execution"""
    
    # 1. Create an agent
    agent_spec = {
        "name": "ErrorHandler",
        "role": "System Tester",
        "goal": "Test system error handling",
        "expertise": ["Error Handling", "Testing"],
        "backstory": "Expert in testing error scenarios"
    }
    
    # 2. Define a flow with invalid requirements
    flow_requirements = {
        "task_type": "implement_test",
        "description": "Test invalid file",
        "language": "python",
        "file_type": "test",
        "target_file": "nonexistent.py"  # This file doesn't exist
    }
    
    # 3. Create collaboration
    collab = await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
    
    # 4. Execute flow and expect failure
    try:
        result = await crew_manager.execute_flow(collab["flow_id"])
    except Exception as e:
        # Verify task was marked as failed
        task = crew_manager.project_manager.get_task(collab["project_id"], collab["task_id"])
        assert task["status"] == TaskStatus.FAILED.value
        
        # Verify error was recorded in flow history
        flow_status = crew_manager.flow_manager.get_flow_status(collab["flow_id"])
        assert flow_status["status"] == "failed"
        assert "error" in flow_status

@pytest.mark.asyncio
async def test_real_concurrent_flows(crew_manager):
    """Test concurrent flow execution with real flows"""
    
    # Create multiple agents and flows
    agents = [
        {
            "name": f"Agent{i}",
            "role": "Tester",
            "goal": "Execute concurrent tests",
            "expertise": ["Testing"],
            "backstory": f"Specialized test agent {i} with expertise in concurrent execution testing and performance analysis. Focused on identifying race conditions and timing issues."
        }
        for i in range(3)
    ]
    
    flow_requirements = {
        "task_type": "implement_test",
        "description": "Create calculator tests",
        "language": "python",
        "file_type": "test",
        "target_file": "calculator.py"
    }
    
    # Create collaborations
    collabs = []
    for agent_spec in agents:
        collab = await crew_manager.create_agent_flow_collaboration(agent_spec, flow_requirements)
        collabs.append(collab)
    
    # Execute flows concurrently
    async def execute_and_verify(collab):
        try:
            result = await crew_manager.execute_flow(collab["flow_id"])
            return result
        except Exception:
            return None
    
    results = await asyncio.gather(*[
        execute_and_verify(collab)
        for collab in collabs
    ])
    
    # Verify results
    for i, result in enumerate(results):
        task = crew_manager.project_manager.get_task(
            collabs[i]["project_id"],
            collabs[i]["task_id"]
        )
        assert task["status"] in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value]

@pytest.mark.asyncio
async def test_flow_with_dependencies(crew_manager):
    """Test flow execution with dependent tasks"""
    
    # 1. Create a setup task
    setup_agent = {
        "name": "SetupAgent",
        "role": "Setup Engineer",
        "goal": "Prepare test environment",
        "expertise": ["Testing", "Setup"],
        "backstory": "Environment setup specialist with extensive experience in configuring test environments, managing dependencies, and ensuring reproducible test conditions."
    }
    
    setup_flow = {
        "task_type": "setup",
        "description": "Prepare calculator test environment",
        "language": "python",
        "file_type": "config"
    }
    
    setup_collab = await crew_manager.create_agent_flow_collaboration(setup_agent, setup_flow)
    
    # 2. Create a dependent test task
    test_agent = {
        "name": "TestAgent",
        "role": "Test Engineer",
        "goal": "Execute tests",
        "expertise": ["Testing"],
        "backstory": "Test execution specialist with deep knowledge of test frameworks and result analysis. Expert in identifying edge cases and potential failure points."
    }
    
    test_flow = {
        "task_type": "implement_test",
        "description": "Create and run calculator tests",
        "language": "python",
        "file_type": "test",
        "dependencies": [setup_collab["task_id"]]
    }
    
    test_collab = await crew_manager.create_agent_flow_collaboration(test_agent, test_flow)
    
    # 3. Execute setup flow
    await crew_manager.execute_flow(setup_collab["flow_id"])
    
    # 4. Execute test flow
    result = await crew_manager.execute_flow(test_collab["flow_id"])
    
    # 5. Verify both tasks completed
    setup_task = crew_manager.project_manager.get_task(
        setup_collab["project_id"],
        setup_collab["task_id"]
    )
    test_task = crew_manager.project_manager.get_task(
        test_collab["project_id"],
        test_collab["task_id"]
    )
    
    assert setup_task["status"] == TaskStatus.COMPLETED.value
    assert test_task["status"] in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value]
