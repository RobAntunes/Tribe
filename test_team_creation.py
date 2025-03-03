import asyncio
import json
import logging
import sys
from tribe.core.foundation_model import FoundationModelInterface
from tribe.extension import _create_additional_team_members

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)

async def test_team_creation():
    """Test the team creation process with the updated implementation."""
    
    # Project description
    project_description = """
    We're building a web application for task management. The application should allow users to:
    - Create and manage tasks with deadlines
    - Organize tasks into projects
    - Collaborate with team members
    - Track progress and generate reports
    - Integrate with calendar and email services
    
    The application should have a modern, responsive UI and be accessible on both desktop and mobile devices.
    """
    
    logger.info("Starting team creation test")
    
    try:
        # Create team members
        team_members = await _create_additional_team_members(project_description)
        
        # Log the results
        logger.info(f"Successfully created {len(team_members)} team members")
        
        for i, member in enumerate(team_members):
            logger.info(f"Team member {i+1}:")
            logger.info(f"  Name: {member.name}")
            logger.info(f"  Role: {member.role}")
            logger.info(f"  Goal: {member.goal}")
            logger.info(f"  Description: {member.short_description}")
            
        return team_members
    except Exception as e:
        logger.error(f"Error in team creation test: {str(e)}")
        return None

if __name__ == "__main__":
    # Run the test
    asyncio.run(test_team_creation()) 