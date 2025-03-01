import pytest
from tribe.src.python.core.learning_system import LearningSystem
from tribe.src.python.core.agent_project_manager import AgentProjectManager

def test_learning_system_initialization():
    learning_system = LearningSystem()
    assert learning_system is not None

def test_project_analysis():
    learning_system = LearningSystem()
    project_manager = AgentProjectManager()
    project_context = project_manager.get_project_context()
    
    analysis = learning_system.analyze_project(project_context)
    assert analysis is not None
    assert "patterns" in analysis
    assert "suggestions" in analysis

def test_code_pattern_learning():
    learning_system = LearningSystem()
    code_sample = """
    function MyComponent() {
        return <div>Hello World</div>;
    }
    """
    
    patterns = learning_system.learn_patterns(code_sample)
    assert patterns is not None
    assert len(patterns) > 0
    assert all("type" in pattern for pattern in patterns)

def test_suggestion_generation():
    learning_system = LearningSystem()
    context = {
        "file": "MyComponent.tsx",
        "content": "function MyComponent() { return <div>Hello</div>; }"
    }
    
    suggestions = learning_system.generate_suggestions(context)
    assert suggestions is not None
    assert len(suggestions) > 0
    assert all("description" in suggestion for suggestion in suggestions)

def test_feedback_incorporation():
    learning_system = LearningSystem()
    feedback = {
        "suggestion_id": "123",
        "accepted": True,
        "context": {"file": "test.tsx"}
    }
    
    result = learning_system.incorporate_feedback(feedback)
    assert result is not None
    assert "status" in result
    assert result["status"] == "success"

def test_pattern_matching():
    learning_system = LearningSystem()
    code = "function test() { console.log('hello'); }"
    
    matches = learning_system.match_patterns(code)
    assert matches is not None
    assert isinstance(matches, list)
    assert all("confidence" in match for match in matches)

def test_integration_with_project_manager():
    learning_system = LearningSystem()
    project_manager = AgentProjectManager()
    
    # Test learning from project structure
    project_context = project_manager.get_project_context()
    learning_result = learning_system.learn_from_project(project_context)
    
    assert learning_result is not None
    assert "patterns" in learning_result
    assert "insights" in learning_result
