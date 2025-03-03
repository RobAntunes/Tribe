import logging
import json
import sys
import os
from pydantic import BaseModel, Field
from typing import List, Optional
from crewai import LLM

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

# Set API key from environment or use the one from direct_api
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "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")
os.environ["ANTHROPIC_API_KEY"] = ANTHROPIC_API_KEY

class Skill(BaseModel):
    name: str = Field(..., description="Name of the skill")
    level: int = Field(..., description="Proficiency level from 1-10")

class Developer(BaseModel):
    name: str = Field(..., description="Developer's name")
    role: str = Field(..., description="Developer's role")
    skills: List[Skill] = Field(..., description="Developer's skills")
    years_experience: int = Field(..., description="Years of experience")

def test_simple_model():
    """Test creating a simple Developer model with structured output."""
    logger.info("Starting simple model test")
    
    # Example instructions for the model
    prompt = """Create a profile for a software developer with the following information:
    - A professional name
    - Their role (e.g., Frontend Developer, Backend Developer)
    - A list of their technical skills (at least 3) with proficiency levels
    - Their years of experience
    
    The developer should be specialized in mobile development."""
    
    messages = [
        {"role": "system", "content": "You are a professional team composition expert."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        logger.info("Querying model with structured output")
        
        # Format schema for the model
        schema_str = json.dumps(Developer.schema(), indent=2)
        
        # Update system message with schema requirements
        messages[0]["content"] += f"""
        
YOUR RESPONSE MUST BE VALID JSON CONFORMING TO THIS SCHEMA:
{schema_str}

Return ONLY the JSON with no additional text."""
        
        # Create LLM with response_format for JSON
        llm = LLM(
            model="anthropic/claude-3-7-sonnet-20250219",
            temperature=0.7,
            response_format=Developer
        )
        
        # Make the call
        logger.info("Calling LLM with formatted messages")
        response = llm.call(messages=messages)
        logger.info(f"Received response of type {type(response)}")
        logger.info(f"Response preview: {response[:500]}")
        
        # Parse the JSON response
        parsed_data = json.loads(response)
        logger.info("Successfully parsed JSON response")
        
        # Validate with the Pydantic model
        developer = Developer.parse_obj(parsed_data)
        logger.info("Successfully validated Developer model")
        
        # Log the details
        logger.info(f"Developer: {developer.name}")
        logger.info(f"Role: {developer.role}")
        logger.info(f"Years of experience: {developer.years_experience}")
        logger.info("Skills:")
        for skill in developer.skills:
            logger.info(f"  - {skill.name}: Level {skill.level}")
        
        logger.info("Test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    test_simple_model() 