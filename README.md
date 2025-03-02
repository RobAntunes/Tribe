# Enhanced Genesis Agent

This extension implements an enhanced version of the Genesis Agent, leveraging features from Crew AI to create a powerful, dynamic agent system with learning, feedback, and reflection capabilities.

## Features

### Foundation Model Interface

A standardized interface for interacting with foundation models, providing:

- Consistent query handling with caching and error management
- Agent specification generation based on project needs
- Optimized prompt generation for specific purposes

### Learning System

A framework for continuous improvement of agent performance and outputs:

- Experience capture for future learning
- Pattern extraction from past experiences
- Application of learning to improve current decisions
- Agent model updates based on accumulated learning

### Feedback System

A framework for collecting, analyzing, and applying feedback:

- Feedback collection from various sources
- Pattern identification in feedback data
- Recommendation generation based on feedback analysis
- Agent behavior updates based on feedback insights

### Reflection System

A framework for agents to analyze their own performance:

- Reflection creation on process, outcome, and decisions
- Insight extraction from reflections
- Improvement opportunity identification
- Structured improvement plan generation

## Architecture

The extension is built around the following core components:

- **Tribe**: Main class for managing AI agent crews
- **DynamicCrew**: Framework for dynamic agent collaboration
- **DynamicAgent**: Flexible agent implementation with various capabilities
- **FoundationModelInterface**: Standardized interface for model interactions
- **LearningSystem**: Framework for continuous learning
- **FeedbackSystem**: Framework for feedback collection and analysis
- **ReflectionSystem**: Framework for self-improvement

## Usage

### Initialization

```python
from tribe.extension import extension

# Initialize the extension
result = await extension.initialize(api_endpoint="https://api.example.com/v1")
```

### Creating a Team

```python
team_spec = {
    "name": "Development Team",
    "description": "Team for developing a web application",
    "roles": ["Project Manager", "Developer", "Designer", "Tester"]
}

result = await extension.create_team(team_spec=team_spec)
```

### Executing a Workflow

```python
workflow = {
    "name": "Development Workflow",
    "description": "Workflow for developing a feature",
    "steps": [
        {"name": "Design", "assignee": "Designer"},
        {"name": "Implement", "assignee": "Developer"},
        {"name": "Test", "assignee": "Tester"}
    ]
}

result = await extension.execute_workflow(workflow=workflow)
```

### Learning from Experiences

```python
# Capture an experience
experience_result = await extension.capture_experience(
    agent_id="agent-123",
    context={"task": "feature_implementation", "complexity": "high"},
    decision="delegate_to_specialist",
    outcome={"success": True, "time_taken": 120}
)

# Extract patterns from experiences
patterns_result = await extension.extract_patterns(
    agent_id="agent-123",
    topic="feature_implementation"
)
```

### Collecting and Analyzing Feedback

```python
# Collect feedback
feedback_result = await extension.collect_feedback(
    source_id="user-456",
    target_id="agent-123",
    feedback_type="performance",
    content={"rating": 4, "message": "Good work, but could be faster"}
)

# Analyze feedback
analysis_result = await extension.analyze_feedback(
    target_id="agent-123",
    feedback_types=["performance", "quality"]
)
```

### Creating Reflections and Improvement Plans

```python
# Create a reflection
reflection_result = await extension.create_reflection(
    agent_id="agent-123",
    task_id="task-789",
    reflection_type="outcome",
    content={"success": True, "factors": ["good_planning", "effective_communication"]}
)

# Extract insights from reflections
insights_result = await extension.extract_insights(
    agent_id="agent-123",
    reflection_types=["outcome", "process"]
)

# Create an improvement plan
plan_result = await extension.create_improvement_plan(
    agent_id="agent-123",
    opportunities=insights_result["insights"]["improvement_opportunities"]
)
```

### Interacting with the Foundation Model

```python
# Generate an optimized prompt
prompt_result = await extension.generate_optimized_prompt(
    purpose="explain_technical_concept",
    context={"concept": "machine_learning", "audience": "beginners"}
)

# Query the foundation model
response_result = await extension.query_model(
    prompt="Explain how neural networks work",
    temperature=0.7,
    max_tokens=500
)
```

## Requirements

- Python 3.8+
- crewai
- pydantic
- langchain
- requests
- asyncio
- and other dependencies listed in requirements.txt

## Installation

1. Clone the repository
2. Install dependencies: `pip install -r requirements.txt`
3. Set up environment variables:
   - `TRIBE_API_ENDPOINT`: API endpoint for the foundation model

## License

[MIT License](LICENSE)
