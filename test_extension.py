import asyncio
import logging
import json
import sys
from tribe.extension import _create_additional_team_members

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

async def test_extension_team_creation():
    """Test the extension's team creation functionality."""
    logger.info("Starting extension team creation test")
    
    # Project description
    project_description = """
    We are building a project management tool with integrated AI capabilities 
    to help teams track progress, automate routine tasks, and provide insights 
    for better decision making. It should have a modern UI, responsive design, 
    and integrate with popular tools and services.
    """
    
    try:
        # Create additional team members using the extension function
        team_members = await _create_additional_team_members(project_description)
        
        # Log the team details
        logger.info(f"Successfully created {len(team_members)} team members")
        
        for i, member in enumerate(team_members):
            logger.info(f"\nTeam Member {i+1}: {member['name']}")
            logger.info(f"Role: {member['role']}")
            logger.info(f"Goal: {member['goal'][:100]}...")
            logger.info(f"Skills: {', '.join(member['skills'][:3])}...")
            logger.info(f"Tools: {', '.join(member['tools'][:3])}...")
            logger.info(f"Strengths: {', '.join(member['strengths'][:3])}...")
        
        logger.info("Extension team creation test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Extension team creation test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_extension_team_creation()) 