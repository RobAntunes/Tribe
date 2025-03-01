import pytest
from tribe.src.python.core.flow_manager import FlowManager
from tribe.src.python.core.agent_project_manager import AgentProjectManager

def test_flow_manager_initialization():
    flow_manager = FlowManager()
    assert flow_manager is not None

def test_flow_generation():
    flow_manager = FlowManager()
    requirements = "Create a new React component"
    flow = flow_manager.generate_flow(requirements)
    
    assert flow is not None
    assert "flowType" in flow
    assert "steps" in flow
    assert "visualizations" in flow

def test_flow_execution():
    flow_manager = FlowManager()
    flow_type = "create_component"
    context = {"componentName": "TestComponent"}
    
    result = flow_manager.execute_flow(flow_type, context)
    assert result is not None
    assert "status" in result
    assert "proposedChanges" in result

def test_flow_visualization():
    flow_manager = FlowManager()
    flow = flow_manager.generate_flow("Create a button component")
    
    assert flow["visualizations"] is not None
    assert len(flow["visualizations"]) > 0
    assert "type" in flow["visualizations"][0]
    assert "content" in flow["visualizations"][0]

def test_flow_proposed_changes():
    flow_manager = FlowManager()
    flow = flow_manager.generate_flow("Create a button component")
    result = flow_manager.execute_flow(flow["flowType"], {})
    
    assert "proposedChanges" in result
    assert "filesToModify" in result["proposedChanges"]
    assert "filesToCreate" in result["proposedChanges"]
    assert "filesToDelete" in result["proposedChanges"]

def test_flow_integration_with_project_manager():
    flow_manager = FlowManager()
    project_manager = AgentProjectManager()
    
    # Test flow generation with project context
    project_context = project_manager.get_project_context()
    flow = flow_manager.generate_flow("Add error handling", project_context)
    
    assert flow is not None
    assert flow["context"]["projectStructure"] is not None
