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

def test_three_members():
    """Test if the Lambda API responds for a three team members request with minimal details."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Three team members request
    three_members_request = {
        "messages": [
            {
                "role": "system", 
                "content": "You are a helpful assistant."
            },
            {
                "role": "user", 
                "content": """Create three team members for a software development project.

                Project: Web application for task management.

                For each member, provide:
                1. A name
                2. Their role
                3. A brief description of their expertise (1-2 sentences)
                4. Their main responsibilities (1-2 sentences)

                Keep your response very brief."""
            }
        ]
    }
    
    logger.info("Sending three team members request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=three_members_request,
            timeout=30  # 30 second timeout for three members request
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
                    logger.info(f"Body content: {body}")
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
        logger.error("Request timed out after 30 seconds")
        return False
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting three team members test")
    result = test_three_members()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 