import requests
import json
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def debug_lambda_api():
    """Debug the Lambda API by testing different request formats."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Test 1: Simple request to check basic functionality
    logger.info("=== TEST 1: Simple request ===")
    simple_request = {
        "messages": [
            {
                "role": "user",
                "content": "What is the capital of France?"
            }
        ]
    }
    
    logger.info(f"Request payload: {json.dumps(simple_request, indent=2)}")
    
    try:
        start_time = time.time()
        response = requests.post(
            lambda_api_endpoint,
            json=simple_request,
            timeout=30
        )
        elapsed_time = time.time() - start_time
        
        logger.info(f"Response received in {elapsed_time:.2f} seconds")
        logger.info(f"Status code: {response.status_code}")
        
        if response.ok:
            try:
                response_json = response.json()
                logger.info(f"Response structure: {list(response_json.keys())}")
                
                if "body" in response_json:
                    body = response_json["body"]
                    logger.info(f"Body type: {type(body)}")
                    logger.info(f"Body content: {body}")
                    
                    # Check if body is a string that can be parsed as JSON
                    if isinstance(body, str):
                        try:
                            # Try to parse as JSON (for single wrapped string)
                            parsed_body = json.loads(body)
                            logger.info(f"Parsed body type: {type(parsed_body)}")
                            logger.info(f"Parsed body: {parsed_body}")
                        except json.JSONDecodeError:
                            logger.info("Body is not a JSON string")
                else:
                    logger.warning("No 'body' field in response")
                    logger.info(f"Full response: {json.dumps(response_json, indent=2)}")
            except json.JSONDecodeError:
                logger.error("Response is not valid JSON")
                logger.info(f"Raw response: {response.text[:500]}")
        else:
            logger.error(f"Request failed with status code {response.status_code}")
            logger.info(f"Response: {response.text[:500]}")
    except Exception as e:
        logger.error(f"Error in Test 1: {str(e)}")
    
    # Test 2: Structured output request
    logger.info("\n=== TEST 2: Structured output request ===")
    structured_request = {
        "messages": [
            {
                "role": "system",
                "content": "You are a structured data extraction system. Your response must be a valid JSON object with keys 'name' and 'capital'."
            },
            {
                "role": "user",
                "content": "Provide information about France."
            }
        ]
    }
    
    logger.info(f"Request payload: {json.dumps(structured_request, indent=2)}")
    
    try:
        start_time = time.time()
        response = requests.post(
            lambda_api_endpoint,
            json=structured_request,
            timeout=30
        )
        elapsed_time = time.time() - start_time
        
        logger.info(f"Response received in {elapsed_time:.2f} seconds")
        logger.info(f"Status code: {response.status_code}")
        
        if response.ok:
            try:
                response_json = response.json()
                logger.info(f"Response structure: {list(response_json.keys())}")
                
                if "body" in response_json:
                    body = response_json["body"]
                    logger.info(f"Body type: {type(body)}")
                    logger.info(f"Body content: {body}")
                    
                    # Check if body is a string that can be parsed as JSON
                    if isinstance(body, str):
                        try:
                            # Try to parse as JSON (for single wrapped string)
                            parsed_body = json.loads(body)
                            logger.info(f"Parsed body type: {type(parsed_body)}")
                            logger.info(f"Parsed body: {parsed_body}")
                        except json.JSONDecodeError:
                            logger.info("Body is not a JSON string")
                else:
                    logger.warning("No 'body' field in response")
                    logger.info(f"Full response: {json.dumps(response_json, indent=2)}")
            except json.JSONDecodeError:
                logger.error("Response is not valid JSON")
                logger.info(f"Raw response: {response.text[:500]}")
        else:
            logger.error(f"Request failed with status code {response.status_code}")
            logger.info(f"Response: {response.text[:500]}")
    except Exception as e:
        logger.error(f"Error in Test 2: {str(e)}")
    
    # Test 3: Minimal team creation request
    logger.info("\n=== TEST 3: Minimal team creation request ===")
    team_request = {
        "messages": [
            {
                "role": "system",
                "content": "You are a structured data extraction system. Your response must be a valid JSON object with a 'team' array containing team members with 'name' and 'role'."
            },
            {
                "role": "user",
                "content": "Create a small team for a web development project with 2 members."
            }
        ],
        "max_tokens": 500
    }
    
    logger.info(f"Request payload: {json.dumps(team_request, indent=2)}")
    
    try:
        start_time = time.time()
        response = requests.post(
            lambda_api_endpoint,
            json=team_request,
            timeout=45
        )
        elapsed_time = time.time() - start_time
        
        logger.info(f"Response received in {elapsed_time:.2f} seconds")
        logger.info(f"Status code: {response.status_code}")
        
        if response.ok:
            try:
                response_json = response.json()
                logger.info(f"Response structure: {list(response_json.keys())}")
                
                if "body" in response_json:
                    body = response_json["body"]
                    logger.info(f"Body type: {type(body)}")
                    logger.info(f"Body preview: {body[:200]}...")
                    
                    # Check if body is a string that can be parsed as JSON
                    if isinstance(body, str):
                        try:
                            # Try to parse as JSON (for single wrapped string)
                            parsed_body = json.loads(body)
                            logger.info(f"Parsed body type: {type(parsed_body)}")
                            logger.info(f"Parsed body keys: {list(parsed_body.keys()) if isinstance(parsed_body, dict) else 'Not a dict'}")
                        except json.JSONDecodeError as e:
                            logger.info(f"Body is not a JSON string: {str(e)}")
                            
                            # Check if it contains markdown code blocks
                            if "```" in body:
                                logger.info("Body contains markdown code blocks, trying to extract JSON")
                                import re
                                json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', body, re.DOTALL)
                                if json_match:
                                    extracted_json = json_match.group(1)
                                    logger.info(f"Extracted from code block: {extracted_json[:200]}...")
                                    try:
                                        parsed_json = json.loads(extracted_json)
                                        logger.info(f"Successfully parsed JSON from code block with keys: {list(parsed_json.keys()) if isinstance(parsed_json, dict) else 'Not a dict'}")
                                    except json.JSONDecodeError as e2:
                                        logger.info(f"Failed to parse extracted JSON: {str(e2)}")
                else:
                    logger.warning("No 'body' field in response")
                    logger.info(f"Full response: {json.dumps(response_json, indent=2)}")
            except json.JSONDecodeError:
                logger.error("Response is not valid JSON")
                logger.info(f"Raw response: {response.text[:500]}")
        else:
            logger.error(f"Request failed with status code {response.status_code}")
            logger.info(f"Response: {response.text[:500]}")
    except Exception as e:
        logger.error(f"Error in Test 3: {str(e)}")
    
    # Test 4: Actual team creation request (simplified)
    logger.info("\n=== TEST 4: Actual team creation request (simplified) ===")
    actual_team_request = {
        "messages": [
            {
                "role": "system",
                "content": """You are a structured data extraction system specialized in team design.
                Your response will be parsed by a machine learning system, so it's critical that your output follows these rules:
                1. Respond ONLY with a valid JSON object.
                2. Do not include any explanations, markdown formatting, or text outside the JSON.
                3. Do not use ```json code blocks or any other formatting.
                4. Ensure all JSON keys and values are properly quoted and formatted.
                5. The JSON must be parseable by the standard json.loads() function."""
            },
            {
                "role": "user",
                "content": """Create a team for a simple web app project.
                
                Your response must follow this JSON structure:
                {
                  "required_roles": [
                    {
                      "role": "Role title",
                      "name": "Character name",
                      "description": "Brief description",
                      "goal": "Primary objective",
                      "required_skills": ["skill1", "skill2"],
                      "collaboration_pattern": "How this agent collaborates"
                    }
                  ],
                  "team_structure": {
                    "hierarchy": "flat/hierarchical",
                    "communication": "Communication patterns",
                    "coordination": "How agents coordinate work"
                  }
                }
                
                Include 3 team members only."""
            }
        ],
        "max_tokens": 1000
    }
    
    logger.info(f"Request payload structure: {json.dumps({k: '...' for k in actual_team_request.keys()}, indent=2)}")
    
    try:
        start_time = time.time()
        response = requests.post(
            lambda_api_endpoint,
            json=actual_team_request,
            timeout=30
        )
        elapsed_time = time.time() - start_time
        
        logger.info(f"Response received in {elapsed_time:.2f} seconds")
        logger.info(f"Status code: {response.status_code}")
        
        if response.ok:
            try:
                response_json = response.json()
                logger.info(f"Response structure: {list(response_json.keys())}")
                
                if "body" in response_json:
                    body = response_json["body"]
                    logger.info(f"Body type: {type(body)}")
                    logger.info(f"Body length: {len(body) if isinstance(body, str) else 'Not a string'}")
                    logger.info(f"Body preview: {body[:200] if isinstance(body, str) else body}...")
                    
                    # Check if body is a string that can be parsed as JSON
                    if isinstance(body, str):
                        try:
                            # Try to parse as JSON (for single wrapped string)
                            parsed_body = json.loads(body)
                            logger.info(f"Parsed body type: {type(parsed_body)}")
                            logger.info(f"Parsed body keys: {list(parsed_body.keys()) if isinstance(parsed_body, dict) else 'Not a dict'}")
                            
                            if isinstance(parsed_body, dict) and "required_roles" in parsed_body:
                                roles = parsed_body["required_roles"]
                                logger.info(f"Number of roles: {len(roles)}")
                                logger.info(f"First role: {json.dumps(roles[0], indent=2)}")
                        except json.JSONDecodeError as e:
                            logger.info(f"Body is not a JSON string: {str(e)}")
                            
                            # Check if it contains markdown code blocks
                            if "```" in body:
                                logger.info("Body contains markdown code blocks, trying to extract JSON")
                                import re
                                json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', body, re.DOTALL)
                                if json_match:
                                    extracted_json = json_match.group(1)
                                    logger.info(f"Extracted from code block: {extracted_json[:200]}...")
                                    try:
                                        parsed_json = json.loads(extracted_json)
                                        logger.info(f"Successfully parsed JSON from code block with keys: {list(parsed_json.keys()) if isinstance(parsed_json, dict) else 'Not a dict'}")
                                        
                                        if isinstance(parsed_json, dict) and "required_roles" in parsed_json:
                                            roles = parsed_json["required_roles"]
                                            logger.info(f"Number of roles: {len(roles)}")
                                            logger.info(f"First role: {json.dumps(roles[0], indent=2)}")
                                    except json.JSONDecodeError as e2:
                                        logger.info(f"Failed to parse extracted JSON: {str(e2)}")
                else:
                    logger.warning("No 'body' field in response")
                    logger.info(f"Full response: {json.dumps(response_json, indent=2)}")
            except json.JSONDecodeError:
                logger.error("Response is not valid JSON")
                logger.info(f"Raw response: {response.text[:500]}")
        else:
            logger.error(f"Request failed with status code {response.status_code}")
            logger.info(f"Response: {response.text[:500]}")
    except Exception as e:
        logger.error(f"Error in Test 4: {str(e)}")

if __name__ == "__main__":
    debug_lambda_api() 