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

def test_simple_json():
    """Test if the Lambda API responds for a simple JSON request without complex agent structure."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Simple JSON request
    json_request = {
        "messages": [
            {
                "role": "system", 
                "content": """You are a helpful assistant that provides information in JSON format.
                Respond with valid JSON only. Do not include any markdown formatting or code blocks."""
            },
            {
                "role": "user", 
                "content": """Provide information about a software developer named Alex in JSON format.
                Include only these fields:
                - name
                - role
                - skills (array of 3 skills)
                - tools (array of 2 tools)
                
                Keep all responses very brief. Do not use markdown code blocks."""
            }
        ]
    }
    
    logger.info("Sending simple JSON request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=json_request,
            timeout=15  # 15 second timeout for simple JSON request
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
                    
                    # Try to parse the body as JSON if it's a string
                    if isinstance(body, str):
                        # Check if the body is wrapped in a code block
                        code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', body)
                        if code_block_match:
                            # Extract JSON from code block
                            json_str = code_block_match.group(1)
                            logger.info(f"Extracted JSON from code block: {json_str}")
                            try:
                                parsed_json = json.loads(json_str)
                                logger.info(f"Successfully parsed extracted JSON: {json.dumps(parsed_json, indent=2)}")
                                return True
                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse extracted JSON: {str(e)}")
                                return False
                        else:
                            # Try to parse directly
                            try:
                                parsed_json = json.loads(body)
                                logger.info(f"Successfully parsed body as JSON: {json.dumps(parsed_json, indent=2)}")
                                return True
                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse body as JSON: {str(e)}")
                                return False
                    else:
                        logger.warning(f"Body is not a string: {type(body)}")
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
        logger.error("Request timed out after 15 seconds")
        return False
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting simple JSON test")
    result = test_simple_json()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 