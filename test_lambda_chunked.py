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

def create_team_member(lambda_api_endpoint, role, index):
    """Create a single team member with the specified role."""
    
    # Single team member request
    member_request = {
        "messages": [
            {
                "role": "system", 
                "content": """You are a structured data extraction system specialized in AI agent design.
                Your task is to create a single AI agent for a software development project.
                
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
                "content": f"""Create a single AI agent for a software development project who will serve as the {role}.

                Project Description: We're building a web application for task management. The application should allow users to create and manage tasks with deadlines, organize tasks into projects, collaborate with team members, track progress and generate reports, and integrate with calendar and email services.

                Your response must follow this JSON structure:
                {{
                  "team_member": {{
                    "name": "Character name",
                    "role": "{role}",
                    "backstory": "Detailed backstory (at least 100 words)",
                    "expertise": "Brief description of expertise",
                    "responsibilities": ["responsibility1", "responsibility2", "responsibility3"],
                    "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
                    "tools": ["tool1", "tool2", "tool3", "tool4"],
                    "communication_style": "Description of communication style",
                    "work_approach": "Description of work approach"
                  }}
                }}"""
            }
        ]
    }
    
    logger.info(f"Sending request for team member {index} ({role})...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=member_request,
            timeout=30  # 30 second timeout for each member request
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        logger.info(f"Request for {role} completed in {duration:.2f} seconds")
        logger.info(f"Status code: {response.status_code}")
        
        if response.ok:
            try:
                response_json = response.json()
                
                # Check if body exists
                if "body" in response_json:
                    body = response_json["body"]
                    
                    # Try to parse the body as JSON if it's a string
                    if isinstance(body, str):
                        try:
                            parsed_json = json.loads(body)
                            logger.info(f"Successfully parsed {role} response as JSON")
                            
                            # Check if the team_member key exists
                            if "team_member" in parsed_json:
                                member = parsed_json["team_member"]
                                logger.info(f"Member name: {member.get('name')}")
                                logger.info(f"Member role: {member.get('role')}")
                                logger.info(f"Backstory length: {len(member.get('backstory', ''))}")
                                return member
                            else:
                                logger.warning(f"No 'team_member' field in {role} response")
                                return None
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse {role} response as JSON: {str(e)}")
                            return None
                    elif isinstance(body, dict) and "team_member" in body:
                        member = body["team_member"]
                        logger.info(f"Member name: {member.get('name')}")
                        logger.info(f"Member role: {member.get('role')}")
                        logger.info(f"Backstory length: {len(member.get('backstory', ''))}")
                        return member
                    else:
                        logger.warning(f"Body for {role} is not in expected format")
                        return None
                else:
                    logger.warning(f"No 'body' field in {role} response")
                    return None
            except json.JSONDecodeError:
                logger.error(f"Failed to parse {role} response as JSON")
                return None
        else:
            logger.error(f"Request for {role} failed with status code: {response.status_code}")
            return None
            
    except requests.exceptions.Timeout:
        logger.error(f"Request for {role} timed out after 30 seconds")
        return None
    except Exception as e:
        logger.error(f"Error during {role} request: {str(e)}")
        return None

def test_lambda_chunked():
    """Test if the Lambda API can handle team creation by breaking it into smaller chunks."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Define the roles for the team
    roles = [
        "Frontend Developer",
        "Backend Developer",
        "Project Manager"
    ]
    
    # Create each team member separately
    team = []
    for i, role in enumerate(roles):
        member = create_team_member(lambda_api_endpoint, role, i+1)
        if member:
            team.append(member)
        else:
            logger.error(f"Failed to create team member for role: {role}")
    
    # Check if we have all team members
    if len(team) == len(roles):
        logger.info("Successfully created all team members")
        
        # Combine the team members into a single team object
        team_json = {"team": team}
        logger.info(f"Final team structure: {json.dumps(team_json, indent=2)[:200]}...")
        
        return True
    else:
        logger.error(f"Only created {len(team)} out of {len(roles)} team members")
        return False

if __name__ == "__main__":
    logger.info("Starting Lambda chunked team test")
    result = test_lambda_chunked()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 