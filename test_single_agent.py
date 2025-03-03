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

def test_single_complex_agent():
    """Test if the Lambda API responds for a single complex agent request."""
    
    # Lambda API endpoint
    lambda_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Single complex agent request
    agent_request = {
        "messages": [
            {
                "role": "system", 
                "content": """You are a structured data extraction system specialized in AI agent design.
                Your task is to create a single, highly detailed AI agent for a software development project.
                
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
                "content": """Create a single, highly detailed AI agent for a software development project.

                Project Description: We're building a web application for task management. The application should allow users to create and manage tasks with deadlines, organize tasks into projects, collaborate with team members, track progress and generate reports, and integrate with calendar and email services.

                CRITICAL REQUIREMENTS:
                1. Give the agent a memorable character-like name (like "Spark", "Nova", "Cipher")
                2. Include a detailed backstory (at least 300 words) that explains their expertise, personality, and approach to software development
                3. Define at least 15 specific technical skills with proficiency levels
                4. Create a detailed work methodology with at least 5 specific steps they follow
                5. Define their communication style and preferences
                6. List at least 10 specific tools and technologies they're proficient with
                7. Describe their problem-solving approach with examples
                8. Define their learning style and how they stay updated with technology
                9. Describe their collaboration patterns with other team members
                10. Include their strengths and weaknesses

                Your response must follow this JSON structure:
                {
                  "agent": {
                    "name": "Character name",
                    "role": "Role title",
                    "backstory": "Detailed backstory (300+ words)",
                    "goal": "Primary objective for this role",
                    "technical_skills": [
                      {"skill": "skill name", "proficiency": "level (1-10)", "years_experience": number},
                      ...at least 15 skills
                    ],
                    "work_methodology": {
                      "approach": "Overall approach description",
                      "steps": [
                        {"step": "step name", "description": "detailed description"},
                        ...at least 5 steps
                      ]
                    },
                    "communication_style": {
                      "preferred_channels": ["channel1", "channel2"],
                      "style": "description of communication style",
                      "frequency": "how often they communicate"
                    },
                    "tools_and_technologies": [
                      {"name": "tool name", "expertise_level": "level (1-10)", "use_case": "how they use it"},
                      ...at least 10 tools
                    ],
                    "problem_solving": {
                      "approach": "overall approach",
                      "examples": [
                        {"problem": "problem description", "solution": "solution description"},
                        ...at least 3 examples
                      ]
                    },
                    "learning_style": {
                      "approach": "how they learn",
                      "resources": ["resource1", "resource2"],
                      "frequency": "how often they learn new things"
                    },
                    "collaboration_pattern": "How this agent collaborates with others",
                    "strengths": ["strength1", "strength2", ...at least 5],
                    "weaknesses": ["weakness1", "weakness2", ...at least 3]
                  }
                }"""
            }
        ]
    }
    
    logger.info("Sending single complex agent request to Lambda API...")
    start_time = time.time()
    
    try:
        response = requests.post(
            lambda_api_endpoint,
            json=agent_request,
            timeout=45  # 45 second timeout for complex agent request
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
                            
                            # Check if the agent key exists and log some basic info
                            if "agent" in parsed_json:
                                agent = parsed_json["agent"]
                                logger.info(f"Agent name: {agent.get('name')}")
                                logger.info(f"Agent role: {agent.get('role')}")
                                logger.info(f"Backstory length: {len(agent.get('backstory', ''))}")
                                logger.info(f"Number of technical skills: {len(agent.get('technical_skills', []))}")
                                logger.info(f"Number of tools: {len(agent.get('tools_and_technologies', []))}")
                            
                            return True
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse body as JSON: {str(e)}")
                            return False
                    elif isinstance(body, dict):
                        logger.info(f"Body is already a dictionary with keys: {list(body.keys())}")
                        
                        # Check if the agent key exists and log some basic info
                        if "agent" in body:
                            agent = body["agent"]
                            logger.info(f"Agent name: {agent.get('name')}")
                            logger.info(f"Agent role: {agent.get('role')}")
                            logger.info(f"Backstory length: {len(agent.get('backstory', ''))}")
                            logger.info(f"Number of technical skills: {len(agent.get('technical_skills', []))}")
                            logger.info(f"Number of tools: {len(agent.get('tools_and_technologies', []))}")
                        
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
    logger.info("Starting single complex agent test")
    result = test_single_complex_agent()
    logger.info(f"Test {'succeeded' if result else 'failed'}") 