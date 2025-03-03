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

def test_medium_complexity():
    """Test if the Lambda API responds for a medium complexity request."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Medium complexity request
    medium_request = {
        "messages": [
            {
                "role": "system", 
                "content": "You are a helpful assistant that can provide information about software development teams."
            },
            {
                "role": "user", 
                "content": """Describe a team of 3 developers for a web application project.

                For each developer, include:
                - Their name
                - Their role (frontend, backend, etc.)
                - 3 key skills they have
                - 2 tools they use regularly

                Format your response as a bulleted list for each developer.
                Keep descriptions brief but informative."""
            }
        ]
    }
    
    logger.info("Sending medium complexity request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=medium_request,
            timeout=30  # 30 second timeout for medium complexity request
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
        logger.error("Request timed out after 30 seconds")
        return False
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting medium complexity test")
    result = test_medium_complexity()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 