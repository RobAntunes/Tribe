import asyncio
import logging
import sys
from tribe.core.direct_api import create_team

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

async def test_team_creation():
    """Test creating a team of professionals using structured output."""
    logger.info("Starting team creation test")
    
    # Project description
    project_description = """
    We are building a modern e-commerce platform with a focus on personalized shopping experiences. 
    The platform needs a responsive web interface, mobile apps, secure payment processing, 
    and AI-driven product recommendations. It should handle high traffic and be scalable.
    """
    
    try:
        # Create a team of 3 professionals
        team = create_team(
            project_description=project_description,
            team_size=3
        )
        
        # Log the team details
        logger.info(f"Successfully created a team of {len(team)} professionals")
        
        for i, member in enumerate(team):
            logger.info(f"\nTeam Member {i+1}: {member.name}")
            logger.info(f"Role: {member.role}")
            logger.info(f"Objective: {member.objective[:100]}...")
            logger.info(f"Skills: {len(member.technical_skills)} skills")
            logger.info(f"Tools: {len(member.tools_and_technologies)} tools")
            logger.info(f"Key traits: {len(member.key_traits)} traits")
            logger.info(f"Specializations: {', '.join(member.specializations[:3])}...")
        
        logger.info("Team creation test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Team creation test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_team_creation()) 