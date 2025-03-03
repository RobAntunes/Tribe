import asyncio
import logging
import json
import sys
from tribe.core.direct_api import create_single_specialist, TeamMember

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

async def test_simple_professional():
    """Test creating a single professional specialist using structured output."""
    logger.info("Starting professional creation test")
    
    # Simple project description
    project_description = """
    A mobile app for fitness tracking that helps users monitor their workouts, 
    nutrition, and progress towards fitness goals.
    """
    
    # Simple role description
    role_description = "Mobile Developer"
    
    try:
        # Create a professional specialist using the direct API
        professional = create_single_specialist(
            project_description=project_description,
            role_description=role_description
        )
        
        # Log the professional details
        logger.info(f"Successfully created professional: {professional.name}")
        logger.info(f"Role: {professional.role}")
        logger.info(f"Objective: {professional.objective}")
        logger.info(f"Technical skills: {len(professional.technical_skills)} skills")
        for skill in professional.technical_skills:
            logger.info(f"  - {skill.name}: Proficiency {skill.proficiency}")
        
        logger.info(f"Specializations: {professional.specializations}")
        logger.info(f"Key traits: {len(professional.key_traits)} traits")
        for trait in professional.key_traits:
            logger.info(f"  - {trait.trait}: {trait.description[:50]}...")
        
        logger.info("Test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_simple_professional()) 