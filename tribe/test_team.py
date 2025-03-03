"""Test team creation functionality."""

import os
import logging
import asyncio
from typing import Optional
from tribe.core.dynamic import DynamicCrew, SystemConfig, DynamicAgent

# Set up logging
logger = logging.getLogger(__name__)

def setup_test_environment():
    """Set up the test environment with mock configurations."""
    # Use mock API endpoint for testing
    os.environ["AI_API_ENDPOINT"] = "http://localhost:8000"
    os.environ["ANTHROPIC_API_KEY"] = "test-key"

async def test_team_creation():
    """Test team creation functionality."""
    setup_test_environment()
    
    # Create config
    config = SystemConfig(
        api_endpoint='https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/'
    )
    
    # Create crew
    crew = DynamicCrew(config=config)
    
    # Create some agents
    dev_agent = await crew.create_agent(
        role='Developer',
        name='Dev',
        backstory='Expert developer with years of experience',
        goal='Build great software'
    )
    
    designer_agent = await crew.create_agent(
        role='Designer',
        name='Designer',
        backstory='Creative designer with an eye for detail',
        goal='Create beautiful user interfaces'
    )
    
    # Create team
    team = await crew.create_team("Project Management System")
    
    print(f'Team created: {team}')
    
    return team

if __name__ == "__main__":
    asyncio.run(test_team_creation()) 