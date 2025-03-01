import requests
import os

"""
Dynamic classes for Tribe extension
"""

class DynamicCrew:
    """Dynamic crew class for managing agents and tasks"""
    
    def __init__(self):
        """Initialize DynamicCrew"""
        self._active_agents = []
    
    def get_active_agents(self):
        """Get list of currently active agents
        
        Returns:
            list: List of active DynamicAgent instances
        """
        return self._active_agents
        
    def add_agent(self, agent):
        """Add an agent to the crew
        
        Args:
            agent: DynamicAgent instance to add
        """
        if isinstance(agent, DynamicAgent):
            self._active_agents.append(agent)
            
    def remove_agent(self, agent):
        """Remove an agent from the crew
        
        Args:
            agent: DynamicAgent instance to remove
        """
        if agent in self._active_agents:
            self._active_agents.remove(agent)

class DynamicAgent:
    """Dynamic agent class representing an AI agent in the crew"""
    
    def __init__(self, name, role):
        """Initialize DynamicAgent
        
        Args:
            name (str): Name of the agent
            role (str): Role/purpose of the agent
        """
        self.name = name
        self.role = role
        self.active = True
        
    def __str__(self):
        return f"Agent({self.name}, {self.role})"

class GenesisAgent:
    """Genesis agent class for high-level AI operations"""
    
    def __init__(self):
        self.api_endpoint = os.environ.get('AI_API_ENDPOINT', 'https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/')
    
    def analyze_codebase(self, context):
        """Analyze codebase and suggest improvements"""
        response = requests.post(
            self.api_endpoint,
            json={
                'type': 'genesis_analyze',
                'context': context
            }
        )
        return response.json()
    
    def generate_code(self, requirements, context):
        """Generate code based on requirements"""
        response = requests.post(
            self.api_endpoint,
            json={
                'type': 'genesis_generate',
                'requirements': requirements,
                'context': context
            }
        )
        return response.json()
    
    def review_changes(self, changes, context):
        """Review code changes"""
        response = requests.post(
            self.api_endpoint,
            json={
                'type': 'genesis_review',
                'changes': changes,
                'context': context
            }
        )
        return response.json()
