"""
Agent tools for Tribe extension
"""
from typing import Dict, List, Optional, Any
import json
import os
import sys

class AutonomousCrewManager:
    """Autonomous crew manager class
    
    This class manages autonomous agents that can perform various tasks
    in the Python environment.
    """
    
    def __init__(self):
        """Initialize the autonomous crew manager"""
        self.agents = {}
        self.active_agents = []
        self.config = self._load_default_config()
    
    def _load_default_config(self) -> Dict[str, Any]:
        """Load the default configuration for agents"""
        return {
            "max_agents": 5,
            "default_timeout": 30,  # seconds
            "logging_enabled": True,
            "agent_types": {
                "code_analyzer": {
                    "description": "Analyzes code for patterns and issues",
                    "capabilities": ["static_analysis", "complexity_measurement"]
                },
                "code_generator": {
                    "description": "Generates code based on specifications",
                    "capabilities": ["function_generation", "class_generation"]
                },
                "documentation": {
                    "description": "Generates and validates documentation",
                    "capabilities": ["docstring_generation", "readme_generation"]
                }
            }
        }
    
    def register_agent(self, agent_id: str, agent_type: str, capabilities: List[str]) -> bool:
        """Register a new agent with the manager
        
        Args:
            agent_id: Unique identifier for the agent
            agent_type: Type of agent (must be one of the configured types)
            capabilities: List of capabilities the agent has
            
        Returns:
            True if registration was successful, False otherwise
        """
        if agent_id in self.agents:
            return False
            
        if agent_type not in self.config["agent_types"]:
            return False
            
        if len(self.agents) >= self.config["max_agents"]:
            return False
            
        self.agents[agent_id] = {
            "type": agent_type,
            "capabilities": capabilities,
            "status": "idle",
            "created_at": None,  # Would use datetime in a real implementation
            "last_active": None
        }
        
        return True
    
    def activate_agent(self, agent_id: str) -> bool:
        """Activate an agent
        
        Args:
            agent_id: ID of the agent to activate
            
        Returns:
            True if activation was successful, False otherwise
        """
        if agent_id not in self.agents:
            return False
            
        if agent_id in self.active_agents:
            return True  # Already active
            
        self.active_agents.append(agent_id)
        self.agents[agent_id]["status"] = "active"
        
        return True
    
    def deactivate_agent(self, agent_id: str) -> bool:
        """Deactivate an agent
        
        Args:
            agent_id: ID of the agent to deactivate
            
        Returns:
            True if deactivation was successful, False otherwise
        """
        if agent_id not in self.agents:
            return False
            
        if agent_id in self.active_agents:
            self.active_agents.remove(agent_id)
            self.agents[agent_id]["status"] = "idle"
            
        return True
    
    def get_agent_info(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get information about an agent
        
        Args:
            agent_id: ID of the agent
            
        Returns:
            Dictionary with agent information or None if agent doesn't exist
        """
        return self.agents.get(agent_id)
    
    def list_agents(self) -> List[Dict[str, Any]]:
        """List all registered agents
        
        Returns:
            List of dictionaries with agent information
        """
        return [
            {"id": agent_id, **agent_info}
            for agent_id, agent_info in self.agents.items()
        ]
    
    def list_active_agents(self) -> List[Dict[str, Any]]:
        """List all active agents
        
        Returns:
            List of dictionaries with agent information for active agents
        """
        return [
            {"id": agent_id, **self.agents[agent_id]}
            for agent_id in self.active_agents
        ]
    
    def get_agent_by_capability(self, capability: str) -> List[str]:
        """Find agents with a specific capability
        
        Args:
            capability: The capability to search for
            
        Returns:
            List of agent IDs that have the specified capability
        """
        return [
            agent_id
            for agent_id, agent_info in self.agents.items()
            if capability in agent_info["capabilities"]
        ]
