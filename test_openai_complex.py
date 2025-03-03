import requests
import json
import time
import logging
import os
import openai
from openai import OpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

def test_openai_complex():
    """Test if OpenAI's API can handle the complex team creation request."""
    
    # Check if OPENAI_API_KEY is set
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable is not set")
        return False
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)
    
    # Complex team request
    system_message = """You are a structured data extraction system specialized in AI agent design.
    Your task is to create a team of AI agents for a software development project.
    
    Your response will be parsed by a machine learning system, so it's critical that your output follows these rules:
    1. Respond ONLY with a valid JSON object.
    2. Do not include any explanations, markdown formatting, or text outside the JSON.
    3. Do not use ```json code blocks or any other formatting.
    4. Ensure all JSON keys and values are properly quoted and formatted.
    5. Do not include any comments within the JSON.
    6. The JSON must be parseable by the standard json.loads() function."""
    
    user_message = """Create a team of 3 AI agents for a software development project.

    Project Description: We're building a web application for task management. The application should allow users to create and manage tasks with deadlines, organize tasks into projects, collaborate with team members, track progress and generate reports, and integrate with calendar and email services.

    Your response must follow this JSON structure:
    {
      "team": [
        {
          "name": "Character name",
          "role": "Role title",
          "backstory": "Detailed backstory (at least 100 words)",
          "expertise": "Brief description of expertise",
          "responsibilities": ["responsibility1", "responsibility2", "responsibility3"],
          "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
          "tools": ["tool1", "tool2", "tool3", "tool4"],
          "communication_style": "Description of communication style",
          "work_approach": "Description of work approach"
        },
        {
          "name": "Character name",
          "role": "Role title",
          "backstory": "Detailed backstory (at least 100 words)",
          "expertise": "Brief description of expertise",
          "responsibilities": ["responsibility1", "responsibility2", "responsibility3"],
          "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
          "tools": ["tool1", "tool2", "tool3", "tool4"],
          "communication_style": "Description of communication style",
          "work_approach": "Description of work approach"
        },
        {
          "name": "Character name",
          "role": "Role title",
          "backstory": "Detailed backstory (at least 100 words)",
          "expertise": "Brief description of expertise",
          "responsibilities": ["responsibility1", "responsibility2", "responsibility3"],
          "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
          "tools": ["tool1", "tool2", "tool3", "tool4"],
          "communication_style": "Description of communication style",
          "work_approach": "Description of work approach"
        }
      ]
    }"""
    
    logger.info("Sending complex team request to OpenAI API...")
    start_time = time.time()
    
    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",  # Using GPT-4 Turbo for best results
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        logger.info(f"Request completed in {duration:.2f} seconds")
        
        if response and response.choices:
            content = response.choices[0].message.content
            logger.info(f"Response content preview: {content[:200]}...")
            
            try:
                parsed_json = json.loads(content)
                logger.info(f"Successfully parsed response as JSON with keys: {list(parsed_json.keys())}")
                
                # Check if the team key exists and log some basic info
                if "team" in parsed_json:
                    team = parsed_json["team"]
                    logger.info(f"Number of team members: {len(team)}")
                    for i, member in enumerate(team):
                        logger.info(f"Member {i+1} name: {member.get('name')}")
                        logger.info(f"Member {i+1} role: {member.get('role')}")
                        logger.info(f"Member {i+1} backstory length: {len(member.get('backstory', ''))}")
                
                return True
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse response as JSON: {str(e)}")
                return False
        else:
            logger.error("No response or choices from OpenAI API")
            return False
            
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting OpenAI complex team test")
    result = test_openai_complex()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 