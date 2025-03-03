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

def test_complex_request():
    """Test if the Lambda API responds quickly for a more complex structured request."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Complex structured request - asking for a simpler team structure
    complex_request = {
        "messages": [
            {
                "role": "system", 
                "content": """You are a structured data extraction system.
                Your responses will be parsed by a machine learning system, so it's critical that your output follows these rules:
                1. Respond ONLY with a valid JSON object.
                2. Do not include any explanations, markdown formatting, or text outside the JSON.
                3. Do not use ```json code blocks or any other formatting.
                4. Ensure all JSON keys and values are properly quoted and formatted.
                5. Do not include any comments within the JSON.
                6. The JSON must be parseable by the standard json.loads() function."""
            },
            {
                "role": "user", 
                "content": """Create a simple team of 3 software developers with different specialties.
                
                For each team member, provide:
                1. A name
                2. A role
                3. A short description of their skills
                
                Your response must follow this JSON structure:
                {
                  "team_members": [
                    {
                      "name": "Name of person",
                      "role": "Their role",
                      "skills": ["skill1", "skill2", "skill3"]
                    }
                  ]
                }"""
            }
        ]
    }
    
    logger.info("Sending complex request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=complex_request,
            timeout=20  # 20 second timeout for complex request
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
                    logger.info(f"Body content: {body[:200]}...")
                    
                    # Try to parse the body as JSON if it's a string
                    if isinstance(body, str):
                        try:
                            parsed_json = json.loads(body)
                            logger.info(f"Successfully parsed body as JSON: {json.dumps(parsed_json, indent=2)}")
                            return True
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse body as JSON: {str(e)}")
                            return False
                    elif isinstance(body, dict):
                        logger.info(f"Body is already a dictionary: {json.dumps(body, indent=2)}")
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
        logger.error("Request timed out after 20 seconds")
        return False
    except Exception as e:
        logger.error(f"Error during request: {str(e)}")
        return False

if __name__ == "__main__":
    logger.info("Starting complex request test")
    result = test_complex_request()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 