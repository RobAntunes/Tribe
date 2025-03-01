"""
Tribe - Main crew implementation for the Tribe framework
"""

from typing import Dict, Any, Optional
from crewai import Crew, Agent, Task, Process
from .core.dynamic import DynamicCrew, DynamicAgent, ProjectManager
from .core.crew_collab import CollaborationMode
import os
import asyncio
import logging
import uuid

class Tribe:
    """
    Main class for managing AI agent crews in the Tribe framework.
    Provides high-level interface for creating and managing agent crews.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize a new Tribe instance.
        
        Args:
            config (Optional[Dict[str, Any]]): Configuration dictionary for the tribe
        """
        self.config = config or {}
        
        # Get API endpoint from environment or config
        self.api_endpoint = (
            os.environ.get('AI_API_ENDPOINT') or 
            config.get('api_endpoint') or
            "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
        )
        logging.info(f"Using API endpoint from environment: {self.api_endpoint}")
        
        # Update config with API endpoint
        self.config['api_endpoint'] = self.api_endpoint
        
        # Initialize event loop
        try:
            self._init_loop = asyncio.get_event_loop()
        except RuntimeError:
            self._init_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._init_loop)
        
        self._initialized = False
        self._crew = None
        self._project_manager = None
        
    async def initialize(self):
        """Async initialization of Tribe"""
        if self._initialized:
            return
            
        try:
            logging.info("Creating Tribe instance with config...")
            
            # Create VP of Engineering with API endpoint
            vp_agent = await DynamicAgent.create_vp_engineering(project_description="Tribe System")
            
            # Initialize project manager for enhanced task execution
            self._project_manager = ProjectManager()
            
            # Initialize DynamicCrew with minimal config
            crew_config = {
                'api_endpoint': self.api_endpoint,
                'debug': self.config.get('debug', False),
                'project_manager': self._project_manager,
                'team_creation': {
                    'max_retries': 3,
                    'retry_delay': 1.0,
                    'validation_timeout': 30.0,
                    'min_agents_required': 1,
                    'max_team_size': 10
                }
            }
            
            self._crew = DynamicCrew(config=crew_config)
            self._crew._agent_pool = []  # Initialize agent pool
            
            # Add VP of Engineering to crew
            self._crew.add_agent(vp_agent)
            
            # Create setup task
            setup_task = Task(
                description="Initialize Tribe system and verify configuration",
                expected_output="Initialized system state",
                agent=self._crew.get_active_agents()[0]  # Use VP of Engineering
            )
            
            # Initialize crew and execute setup task
            team_id = str(uuid.uuid4())
            self._initialized = True
            
            return {
                "team": {
                    "id": team_id,
                    "description": "Tribe System",
                    "agents": [
                        {
                            "id": str(uuid.uuid4()),
                            "role": agent.role,
                            "status": "active"
                        }
                        for agent in self._crew.get_active_agents()
                    ]
                }
            }
            
        except Exception as e:
            logging.error(f"Error initializing Tribe: {str(e)}")
            raise
    
    @classmethod
    async def create(cls, config: Optional[Dict[str, Any]] = None) -> 'Tribe':
        """Factory method to create and initialize a Tribe instance"""
        instance = cls(config)
        await instance.initialize()
        return instance
    
    @property
    def crew(self) -> DynamicCrew:
        """Get the DynamicCrew instance."""
        if not self._initialized:
            raise RuntimeError("Tribe instance not initialized. Call initialize() first.")
        return self._crew
        
    def __del__(self):
        """Cleanup when Tribe instance is destroyed"""
        if hasattr(self, '_init_loop') and self._init_loop:
            try:
                self._init_loop.close()
            except Exception:
                pass 