import requests
import json
import time
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

def test_team_request():
    """Test if the Lambda API responds for a request similar to the actual team creation."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Team creation request - similar to the actual implementation but simplified
    team_request = {
        "messages": [
            {
                "role": "system", 
                "content": """You are a structured data extraction system specialized in team design and AI agent systems.
                Your task is to create a well-balanced team structure for a software development project.
                
                You are Tank, the VP of Engineering, responsible for creating an optimal set of
                AI agents based on the project description.
                
                Your response will be parsed by a machine learning system, so it's critical that your output follows these rules:
                1. Respond ONLY with a valid JSON object.
                2. Do not include any explanations, markdown formatting, or text outside the JSON.
                3. Do not use ```json code blocks or any other formatting.
                4. Ensure all JSON keys and values are properly quoted and formatted.
                5. Do not include any comments within the JSON.
                6. The JSON must be parseable by the standard json.loads() function."""
            },
            {
                "role": "user", 
                "content": """Create an optimal set of agents for this project:

                Project Description: We're building a web application for task management. The application should allow users to create and manage tasks with deadlines, organize tasks into projects, collaborate with team members, track progress and generate reports, and integrate with calendar and email services.

                CRITICAL REQUIREMENTS:
                1. Create a diverse team with 4-5 different specialized roles
                2. Give each agent a memorable character-like name (like "Spark", "Nova", "Cipher")
                3. Include a short description for each agent
                4. Define clear skills for each role
                5. Define specific collaboration patterns between agents

                Your response must follow this JSON structure:
                {
                  "required_roles": [
                    {
                      "role": "Role title",
                      "name": "Character name",
                      "description": "Description of this role",
                      "goal": "Primary objective for this role",
                      "required_skills": ["skill1", "skill2", "skill3"],
                      "collaboration_pattern": "How this agent collaborates"
                    }
                  ],
                  "team_structure": {
                    "hierarchy": "flat/hierarchical",
                    "communication": "Communication patterns between agents",
                    "coordination": "How agents coordinate work"
                  }
                }"""
            }
        ]
    }
    
    logger.info("Sending team creation request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=team_request,
            timeout=30  # 30 second timeout for team request
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        logger.info(f"Request completed in {duration:.2f} seconds")
        logger.info(f"Status code: {response.status_code}")
        
        if response.ok:
            try:
                response_json = response.json()
                logger.info(f"Response structure: {list(response_json.keys())}")
                
                # Check if body exists
                if "body" in response_json:
                    body = response_json["body"]
                    logger.info(f"Body type: {type(body)}")
                    logger.info(f"Body content preview: {body[:200]}...")
                    
                    # Try to parse the body as JSON if it's a string
                    if isinstance(body, str):
                        try:
                            parsed_json = json.loads(body)
                            logger.info(f"Successfully parsed body as JSON with keys: {list(parsed_json.keys())}")
                            return True
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse body as JSON: {str(e)}")
                            return False
                    elif isinstance(body, dict):
                        logger.info(f"Body is already a dictionary with keys: {list(body.keys())}")
                        return True
                    else:
                        logger.warning(f"Body is neither string nor dict: {type(body)}")
                        return False
                else:
                    logger.warning("No 'body' field in response")
                    logger.info(f"Full response: {response.text[:500]}")
                    return False
            except json.JSONDecodeError:
                logger.error("Failed to parse response as JSON")
                logger.info(f"Raw response: {response.text[:500]}")
                return False
        else:
            logger.error(f"Request failed with status code: {response.status_code}")
            logger.info(f"Response content: {response.text[:500]}")
            return False
            
    except requests.exceptions.Timeout:
        logger.error("Request timed out after 30 seconds")
        return False
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting team request test")
    result = test_team_request()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 