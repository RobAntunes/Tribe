import requests
import json
import time
import logging
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

def test_structured_team():
    """Test if the Lambda API responds for a team request with structured output but simplified."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Structured team request
    structured_team_request = {
        "messages": [
            {
                "role": "system", 
                "content": """You are a structured data extraction system specialized in AI agent design.
                Your task is to create a team of AI agents for a software development project.
                
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
                "content": """Create a team of 3 AI agents for a software development project.

                Project Description: We're building a web application for task management. The application should allow users to create and manage tasks with deadlines, organize tasks into projects, collaborate with team members, track progress and generate reports, and integrate with calendar and email services.

                Your response must follow this JSON structure:
                {
                  "team": [
                    {
                      "name": "Character name",
                      "role": "Role title",
                      "expertise": "Brief description of expertise",
                      "responsibilities": ["responsibility1", "responsibility2"],
                      "skills": ["skill1", "skill2", "skill3"],
                      "tools": ["tool1", "tool2"]
                    },
                    {
                      "name": "Character name",
                      "role": "Role title",
                      "expertise": "Brief description of expertise",
                      "responsibilities": ["responsibility1", "responsibility2"],
                      "skills": ["skill1", "skill2", "skill3"],
                      "tools": ["tool1", "tool2"]
                    },
                    {
                      "name": "Character name",
                      "role": "Role title",
                      "expertise": "Brief description of expertise",
                      "responsibilities": ["responsibility1", "responsibility2"],
                      "skills": ["skill1", "skill2", "skill3"],
                      "tools": ["tool1", "tool2"]
                    }
                  ]
                }"""
            }
        ]
    }
    
    logger.info("Sending structured team request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=structured_team_request,
            timeout=45  # 45 second timeout for structured team request
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
                        # Check if the body is wrapped in a code block
                        code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', body)
                        if code_block_match:
                            # Extract JSON from code block
                            json_str = code_block_match.group(1)
                            logger.info(f"Extracted JSON from code block preview: {json_str[:200]}...")
                            try:
                                parsed_json = json.loads(json_str)
                                logger.info(f"Successfully parsed extracted JSON with keys: {list(parsed_json.keys())}")
                                
                                # Check if the team key exists and log some basic info
                                if "team" in parsed_json:
                                    team = parsed_json["team"]
                                    logger.info(f"Number of team members: {len(team)}")
                                    for i, member in enumerate(team):
                                        logger.info(f"Member {i+1} name: {member.get('name')}")
                                        logger.info(f"Member {i+1} role: {member.get('role')}")
                                
                                return True
                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse extracted JSON: {str(e)}")
                                return False
                        else:
                            # Try to parse directly
                            try:
                                parsed_json = json.loads(body)
                                logger.info(f"Successfully parsed body as JSON with keys: {list(parsed_json.keys())}")
                                
                                # Check if the team key exists and log some basic info
                                if "team" in parsed_json:
                                    team = parsed_json["team"]
                                    logger.info(f"Number of team members: {len(team)}")
                                    for i, member in enumerate(team):
                                        logger.info(f"Member {i+1} name: {member.get('name')}")
                                        logger.info(f"Member {i+1} role: {member.get('role')}")
                                
                                return True
                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse body as JSON: {str(e)}")
                                return False
                    elif isinstance(body, dict):
                        logger.info(f"Body is already a dictionary with keys: {list(body.keys())}")
                        
                        # Check if the team key exists and log some basic info
                        if "team" in body:
                            team = body["team"]
                            logger.info(f"Number of team members: {len(team)}")
                            for i, member in enumerate(team):
                                logger.info(f"Member {i+1} name: {member.get('name')}")
                                logger.info(f"Member {i+1} role: {member.get('role')}")
                        
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
        logger.error("Request timed out after 45 seconds")
        return False
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting structured team test")
    result = test_structured_team()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 