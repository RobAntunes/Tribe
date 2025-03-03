import asyncio
import logging
import json
import sys
from typing import List, Dict, Any
from tribe.core.direct_api import create_team, TeamMember, create_single_specialist

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

async def test_professional_team_creation():
    """
    Test the creation of a professional, product-oriented team using direct API calls.
    """
    logger.info("Starting professional team creation test...")
    
    # Define a project description
    project_description = """
    We're building a SaaS platform that helps small businesses manage their customer relationships,
    invoicing, and project tracking in a unified interface. The platform should have the following features:
    
    1. Customer Management:
       - Contact information storage and management
       - Communication history tracking
       - Customer segmentation and tagging
       - Customer portal for self-service
    
    2. Project Management:
       - Task creation and assignment
       - Project timeline visualization
       - Resource allocation
       - Time tracking
       - Client collaboration tools
    
    3. Invoicing and Billing:
       - Invoice generation linked to projects
       - Online payment processing
       - Subscription management
       - Expense tracking
       - Financial reporting
    
    4. Analytics and Reporting:
       - Business performance dashboards
       - Customer engagement metrics
       - Project profitability analysis
       - Team productivity insights
    
    The platform should be web-based with responsive design for mobile access,
    have modern UI/UX with intuitive workflows, support team collaboration,
    and include robust security features and data privacy controls.
    """
    
    try:
        # Create a professional team using the direct API
        logger.info("Creating professional team...")
        team_members = create_team(
            project_description=project_description,
            team_size=3,
            model="claude-3-7-sonnet-20250219",
            temperature=0.7
        )
        
        # Log the team creation results
        logger.info(f"Successfully created professional team with {len(team_members)} members")
        
        # Print details of each team member
        for i, member in enumerate(team_members):
            logger.info(f"\n=== Professional #{i+1}: {member.name} ===")
            logger.info(f"Role: {member.role}")
            logger.info(f"Objective: {member.objective}")
            
            logger.info("\nTechnical Skills:")
            for skill in member.technical_skills:
                logger.info(f"- {skill.name} (Proficiency: {skill.proficiency}/10, Experience: {skill.years_experience} years)")
            
            logger.info("\nTools & Technologies:")
            for tool in member.tools_and_technologies:
                logger.info(f"- {tool.name} (Expertise: {tool.expertise_level}/10)")
                logger.info(f"  Use Case: {tool.use_case}")
            
            logger.info("\nKey Professional Traits:")
            for trait in member.key_traits:
                logger.info(f"- {trait.trait}")
                logger.info(f"  Impact: {trait.impact}")
            
            logger.info("\nSpecializations:")
            for spec in member.specializations:
                logger.info(f"- {spec}")
            
            logger.info("\nProfessional Methodology:")
            logger.info(member.methodology)
            
            logger.info("\n-------------------\n")
        
        # Now test creating a single specialist
        role_description = """
        Senior UX/UI Designer with expertise in SaaS platforms who can create an 
        intuitive, efficient, and visually appealing interface for our business 
        management platform. This professional should have strong skills in user 
        research, information architecture, and creating design systems that scale.
        """
        
        logger.info("Creating a single specialist professional...")
        specialist = create_single_specialist(
            project_description=project_description,
            role_description=role_description,
            model="claude-3-7-sonnet-20250219",
            temperature=0.7
        )
        
        # Log the specialist creation results
        logger.info(f"\n=== Specialist Professional: {specialist.name} ===")
        logger.info(f"Role: {specialist.role}")
        logger.info(f"Objective: {specialist.objective}")
        
        logger.info("\nTechnical Skills:")
        for skill in specialist.technical_skills:
            logger.info(f"- {skill.name} (Proficiency: {skill.proficiency}/10, Experience: {skill.years_experience} years)")
        
        logger.info("\nTools & Technologies:")
        for tool in specialist.tools_and_technologies:
            logger.info(f"- {tool.name} (Expertise: {tool.expertise_level}/10)")
            logger.info(f"  Use Case: {tool.use_case}")
        
        logger.info("\nKey Professional Traits:")
        for trait in specialist.key_traits:
            logger.info(f"- {trait.trait}")
            logger.info(f"  Impact: {trait.impact}")
        
        logger.info("\nSpecializations:")
        for spec in specialist.specializations:
            logger.info(f"- {spec}")
        
        logger.info("\n-------------------\n")
        
        logger.info("Professional team creation test SUCCEEDED")
        return True
        
    except Exception as e:
        logger.error(f"Professional team creation test FAILED: {str(e)}")
        logger.exception(e)
        return False

if __name__ == "__main__":
    # Run the test
    asyncio.run(test_professional_team_creation()) 