import pytest
import pytest_asyncio
from unittest.mock import MagicMock, patch
import os
import asyncio
from typing import Dict, Any

from src.python.core.crew_manager import CrewManager
from src.python.core.agent_project_manager import TaskStatus, TaskPriority
from src.python.core.flow_manager import FlowManager

@pytest_asyncio.fixture
async def crew_manager(tmp_path):
    """Create a CrewManager instance with a temporary workspace"""
    workspace_path = str(tmp_path / "test_workspace")
    
    # Create test directories
    os.makedirs(workspace_path, exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'agents'), exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'flows'), exist_ok=True)
    os.makedirs(os.path.join(workspace_path, 'projects'), exist_ok=True)
    
    # Create a mock flow manager
    flow_manager = MagicMock(spec=FlowManager)
    flow_manager.active_flows = {}
    
    manager = CrewManager(workspace_path)
    manager.flow_manager = flow_manager
    manager.initialize()
    return manager

@pytest.mark.asyncio
async def test_execute_flow_error_handling(crew_manager):
    """Test that flow execution errors are handled properly"""
    # Setup
    flow_id = "test_flow"
    error_message = "Flow execution failed"
    
    # Mock flow manager to raise an exception
    async def mock_error_flow(_):
        raise Exception(error_message)
    crew_manager.flow_manager.execute_flow = mock_error_flow
    
    # Create a test task
    project_id = crew_manager.project_manager.create_project({
        'name': 'Test Project',
        'description': 'Test project for error handling'
    })
    
    task_spec = {
        'name': 'Test Task',
        'description': 'Test task for error handling',
        'priority': TaskPriority.MEDIUM.value,
        'flow_id': flow_id
    }
    task_id = crew_manager.project_manager.add_task(project_id, task_spec)
    
    # Update flow context
    crew_manager.flow_manager.active_flows[flow_id] = {
        'context': {
            'project_id': project_id,
            'task_id': task_id
        }
    }
    
    # Execute flow and verify error handling
    with pytest.raises(Exception) as exc_info:
        await crew_manager.execute_flow(flow_id)
    assert str(exc_info.value) == error_message
    
    # Verify task status was updated to FAILED
    task = crew_manager.project_manager.get_task(project_id, task_id)
    assert task['status'] == TaskStatus.FAILED.value

@pytest.mark.asyncio
async def test_execute_flow_with_missing_context(crew_manager):
    """Test flow execution with missing or invalid context"""
    # Setup flow without context
    flow_id = "test_flow"
    crew_manager.flow_manager.active_flows[flow_id] = {}
    
    # Mock successful flow execution
    async def mock_success_flow(_):
        return {'status': 'completed'}
    crew_manager.flow_manager.execute_flow = mock_success_flow
    
    # Execute flow and verify it completes without error
    result = await crew_manager.execute_flow(flow_id)
    assert result['status'] == 'completed'

@pytest.mark.asyncio
async def test_task_status_transitions(crew_manager):
    """Test that task status transitions work correctly"""
    # Setup
    flow_id = "test_flow"
    
    # Create a test task
    project_id = crew_manager.project_manager.create_project({
        'name': 'Test Project',
        'description': 'Test project for status transitions'
    })
    
    task_spec = {
        'name': 'Test Task',
        'description': 'Test task for status transitions',
        'priority': TaskPriority.MEDIUM.value,
        'flow_id': flow_id
    }
    task_id = crew_manager.project_manager.add_task(project_id, task_spec)
    
    # Verify initial status is PENDING
    task = crew_manager.project_manager.get_task(project_id, task_id)
    assert task['status'] == TaskStatus.PENDING.value
    
    # Update flow context
    crew_manager.flow_manager.active_flows[flow_id] = {
        'context': {
            'project_id': project_id,
            'task_id': task_id
        }
    }
    
    # Mock flow execution with different statuses
    async def mock_status_flow(_):
        return {'status': 'completed'}
    crew_manager.flow_manager.execute_flow = mock_status_flow
    
    # Execute flow and verify status transitions
    await crew_manager.execute_flow(flow_id)
    task = crew_manager.project_manager.get_task(project_id, task_id)
    assert task['status'] == TaskStatus.COMPLETED.value

@pytest.mark.asyncio
async def test_concurrent_flow_execution(crew_manager):
    """Test handling of concurrent flow executions"""
    # Setup multiple flows
    flow_ids = ["flow1", "flow2", "flow3"]
    tasks = []
    
    # Create a test project
    project_id = crew_manager.project_manager.create_project({
        'name': 'Test Project',
        'description': 'Test project for concurrent execution'
    })
    
    # Create tasks and flows
    for flow_id in flow_ids:
        task_spec = {
            'name': f'Task for {flow_id}',
            'description': 'Test concurrent execution',
            'priority': TaskPriority.MEDIUM.value,
            'flow_id': flow_id
        }
        task_id = crew_manager.project_manager.add_task(project_id, task_spec)
        tasks.append(task_id)
        
        # Setup flow context
        crew_manager.flow_manager.active_flows[flow_id] = {
            'context': {
                'project_id': project_id,
                'task_id': task_id
            }
        }
    
    # Mock flow execution with varying completion times
    async def mock_execute_flow(flow_id):
        return {'status': 'completed'}
    
    crew_manager.flow_manager.execute_flow = mock_execute_flow
    
    # Execute flows concurrently
    import asyncio
    await asyncio.gather(*[crew_manager.execute_flow(flow_id) for flow_id in flow_ids])
    
    # Verify all tasks completed
    for task_id in tasks:
        task = crew_manager.project_manager.get_task(project_id, task_id)
        assert task['status'] == TaskStatus.COMPLETED.value

@pytest.mark.asyncio
async def test_flow_execution_timeout(crew_manager):
    """Test handling of flow execution timeouts"""
    # Setup
    flow_id = "test_flow"
    
    # Create a test task
    project_id = crew_manager.project_manager.create_project({
        'name': 'Test Project',
        'description': 'Test project for timeout handling'
    })
    
    task_spec = {
        'name': 'Test Task',
        'description': 'Test task for timeout handling',
        'priority': TaskPriority.MEDIUM.value,
        'flow_id': flow_id
    }
    task_id = crew_manager.project_manager.add_task(project_id, task_spec)
    
    # Update flow context
    crew_manager.flow_manager.active_flows[flow_id] = {
        'context': {
            'project_id': project_id,
            'task_id': task_id
        }
    }
    
    # Mock flow execution with timeout
    async def mock_timeout_flow(_):
        await asyncio.sleep(0.1)  # Simulate slow execution
        raise asyncio.TimeoutError("Flow execution timed out")
    
    crew_manager.flow_manager.execute_flow = mock_timeout_flow
    
    # Execute flow and verify timeout handling
    with pytest.raises(asyncio.TimeoutError):
        await crew_manager.execute_flow(flow_id)
    
    # Verify task status was updated to FAILED
    task = crew_manager.project_manager.get_task(project_id, task_id)
    assert task['status'] == TaskStatus.FAILED.value
