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

def test_simple_team():
    """Test if the Lambda API responds for a simple team creation request without structured output requirements."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Simple team request without structured output requirements
    simple_team_request = {
        "messages": [
            {
                "role": "system", 
                "content": "You are a helpful assistant that can create teams of AI agents for software development projects."
            },
            {
                "role": "user", 
                "content": """Create a team of 3 AI agents for a software development project.

                Project Description: We're building a web application for task management. The application should allow users to create and manage tasks with deadlines, organize tasks into projects, collaborate with team members, track progress and generate reports, and integrate with calendar and email services.

                For each team member, provide:
                1. A name
                2. Their role
                3. A brief description of their expertise
                4. Their main responsibilities

                Keep your response conversational and avoid using structured JSON format."""
            }
        ]
    }
    
    logger.info("Sending simple team request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=simple_team_request,
            timeout=45  # 45 second timeout for team request
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
                    logger.info(f"Body content preview: {body[:500]}...")
                    return True
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
    logger.info("Starting simple team test")
    result = test_simple_team()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 