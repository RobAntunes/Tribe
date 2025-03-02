import os
import requests
import asyncio
import pytest
from unittest.mock import patch, MagicMock
from tribe.core.dynamic import DynamicCrew, DynamicAgent
from tribe.src.python.classes.extended.crew_collab import CollaborationMode
from tribe.src.python.tools.agents import AutonomousCrewManager
from crewai import Task, Process

import pytest_asyncio

@pytest_asyncio.fixture
async def crew():
    manager = AutonomousCrewManager()
    genesis_agent = await manager.create_genesis_agent()
    return DynamicCrew(
        config={
            'agents': [genesis_agent],
            'tasks': [],
            'manager_agent': genesis_agent,
            'process': Process.hierarchical,
            'verbose': True,
            'manager_llm': None,  # No need for custom LLM, using Lambda
            'function_calling_llm': None,  # No need for custom LLM, using Lambda
            'language': 'en',
            'language_file': None,
            'memory': None,  # Disable memory to avoid OpenAI dependencies
            'memory_config': None,  # Disable memory config
            'cache': True,
            'embedder': None,  # No need for embedder, using Lambda
            'full_output': False,
            'step_callback': None,
            'task_callback': None,
            'share_crew': False,
            'output_log_file': None,
            'prompt_file': None,
            'planning': True,  # Enable planning for test scenarios
            'planning_llm': None  # No need for custom LLM, using Lambda
        }
    )

class TestAutonomousCrew:

    @pytest.mark.asyncio
    async def test_agent_creation(self, crew):
        """Test dynamic agent creation and team formation"""
        # Create a planner agent
        planner_agent = DynamicAgent(
            role="Task Execution Planner",
            goal="Plan and coordinate task execution",
            backstory="Expert in planning and coordinating software development tasks",
            tools=[],
            collaboration_mode=CollaborationMode.HYBRID
        )
        
        # Test the agent's ability to get responses through OpenRouter Lambda
        response = planner_agent.get_response(
            "What are the key steps to plan a new API endpoint development?"
        )
        
        # Verify planner output
        assert response is not None
        assert isinstance(response, str)
        assert len(response) > 0
        
        # Print response for inspection
        print(f"\nPlanner Agent Response:\n{response}")
        
        # Verify response contains relevant planning concepts
        planning_concepts = ['requirements', 'design', 'implementation', 'testing']
        has_relevant_concepts = any(
            concept.lower() in response.lower() 
            for concept in planning_concepts
        )
        assert has_relevant_concepts, "Response should contain relevant planning concepts"

    @pytest.mark.asyncio
    async def test_collaboration(self, crew):
        """Test agent collaboration capabilities"""
        # Create two agents with different expertise
        backend_agent = DynamicAgent(
            role="Backend Developer",
            goal="Implement API endpoints",
            backstory="Expert in backend development and API design",
            tools=[],
            collaboration_mode=CollaborationMode.HYBRID
        )
        
        tester_agent = DynamicAgent(
            role="QA Engineer",
            goal="Ensure code quality and test coverage",
            backstory="Expert in testing and quality assurance",
            tools=[],
            collaboration_mode=CollaborationMode.HYBRID
        )
        
        crew.add_agent(backend_agent)
        crew.add_agent(tester_agent)
        
        # Create a task requiring collaboration
        task = Task(
            description="Implement and test new API endpoint",
            expected_output="Fully tested API endpoint",
            agent=backend_agent
        )
        
        # Request collaboration
        await backend_agent.request_collaboration(
            task=task,
            required_expertise=["testing"]
        )
        
        # Verify collaboration was established
        assert task.id in backend_agent.collaboration_tasks

    def _has_expertise(self, agent, expertise):
        """Helper to check if agent has specific expertise"""
        # In a real implementation, this would check agent's capabilities
        return expertise.lower() in agent.backstory.lower()

    @pytest.mark.asyncio
    async def test_openrouter_integration(self, crew):
        """Test OpenRouter Lambda integration for agent responses"""
        # Create an agent with OpenRouter capabilities
        agent = DynamicAgent(
            role="AI Researcher",
            goal="Provide accurate responses using OpenRouter",
            backstory="Expert in AI research and natural language processing",
            tools=[],
            collaboration_mode=CollaborationMode.HYBRID
        )
        
        test_prompt = "Explain what makes a good API design in 2-3 sentences."
        
        # Test the agent's ability to get responses through OpenRouter Lambda
        response = await agent.execute(Task(
            description=test_prompt,
            expected_output="A concise explanation of good API design principles"
        ))
        
        # Verify the response
        assert response is not None
        print(f"\nAI Response to API design question:\n{response}")
        
        # Verify response contains relevant API design concepts
        api_concepts = ['REST', 'endpoint', 'interface', 'design', 'API']
        has_relevant_concepts = any(concept.lower() in response.lower() for concept in api_concepts)
        assert has_relevant_concepts, "Response should contain relevant API design concepts"


