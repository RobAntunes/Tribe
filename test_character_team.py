import asyncio
import logging
import json
import sys
from tribe.core.direct_api import create_team, create_single_specialist

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

async def test_character_team():
    """Test creating a team with character-rich attributes."""
    logger.info("Starting character team test")
    
    # Project description
    project_description = """
    We are building a collaborative storytelling platform that uses AI to help
    writers develop characters, plot lines, and world-building. The platform should
    include tools for brainstorming, organizing story elements, providing feedback,
    and facilitating collaboration between multiple authors.
    """
    
    try:
        # Create a team with character-focused attributes
        team_members = create_team(
            project_description=project_description,
            team_size=3
        )
        
        # Log the team details
        logger.info(f"Successfully created a team of {len(team_members)} character-rich professionals")
        
        for i, member in enumerate(team_members):
            logger.info(f"\n====== Character {i+1}: {member.name} ======")
            logger.info(f"Role: {member.role}")
            logger.info(f"Objective: {member.objective[:100]}...")
            logger.info(f"Emoji: {member.emoji if member.emoji else 'None'}")
            
            logger.info("\nCharacter Traits:")
            for trait in member.character_traits:
                logger.info(f"  - {trait.trait}: {trait.description[:100]}...")
            
            logger.info(f"\nCommunication Style: {member.communication_style.style} - {member.communication_style.tone}")
            logger.info(f"Communication Description: {member.communication_style.description[:100]}...")
            
            logger.info(f"\nWorking Style: {member.working_style.style}")
            logger.info(f"Working Style Description: {member.working_style.description[:100]}...")
            
            logger.info(f"\nVisual Description: {member.visual_description if member.visual_description else 'None'}")
            logger.info(f"Catchphrase: {member.catchphrase if member.catchphrase else 'None'}")
            
            logger.info(f"\nSpecializations: {', '.join(member.specializations[:3])}...")
        
        logger.info("\nCharacter team creation test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Character team test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_character_team()) 