"""Foundation Model interface module providing standardized AI model access."""

import os
import json
import logging
import asyncio
import requests
import re
from typing import Dict, List, Optional, Any, Union

# Set up logging
logger = logging.getLogger(__name__)

class FoundationModelInterface:
    """Standardized interface for interacting with foundation models."""
    
    def __init__(self, api_endpoint: Optional[str] = None, model: str = "default"):
        """
        Initialize the foundation model interface.
        
        Args:
            api_endpoint: The API endpoint for the foundation model
            model: The model name to use
        """
        self.api_endpoint = api_endpoint or os.getenv("AI_API_ENDPOINT", "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/")
        self.model = model
        self.cache = {}
        
    def query_model(self, prompt: str, temperature: float = 0.7, 
                   max_tokens: int = 1000, 
                   system_message: Optional[str] = None,
                   structured_output: bool = False) -> Union[str, Dict[str, Any]]:
        """
        Send a prompt to the foundation model and get a response.
        
        Args:
            prompt: The prompt to send
            temperature: Creativity parameter (0.0-1.0)
            max_tokens: Maximum response length
            system_message: System context message
            structured_output: Whether to enforce structured output (for crewai compatibility)
            
        Returns:
            Model response as a string or structured data
        """
        try:
            # Create cache key
            cache_key = f"{prompt[:100]}_{temperature}_{max_tokens}_{structured_output}"
            
            # Check cache
            if cache_key in self.cache:
                return self.cache[cache_key]
            
            # Prepare request with system message that enforces structured output if needed
            messages = []
            
            if system_message:
                messages.append({"role": "system", "content": system_message})
            elif structured_output:
                # Add a system message that emphasizes structured output for crewai compatibility
                messages.append({
                    "role": "system", 
                    "content": """You must respond in valid, parseable JSON format.
                    Do not include explanations or markdown formatting - ONLY pure JSON.
                    If you need to include code examples in the JSON, escape them properly.
                    This is CRITICAL for integration with an automated system.
                    Response MUST be a valid JSON object that can be parsed with json.loads()."""
                })
            
            # Add the main prompt
            messages.append({"role": "user", "content": prompt})
            
            # Add structured output format requirement if needed
            if structured_output:
                # For structured output requests, add an explicit format instruction
                format_instruction = {
                    "role": "user", 
                    "content": "IMPORTANT: Your response MUST be in valid JSON format with no explanations, comments, or markdown outside the JSON. Return ONLY the JSON object."
                }
                messages.append(format_instruction)
            
            # Make request with the correct format for Lambda
            logger.info(f"Sending request to foundation model API: {self.api_endpoint}")
            
            # Create payload with expected structure but only include required messages
            payload = {
                "messages": messages
            }
            
            # Only add optional parameters if they differ from defaults
            if temperature != 0.7:
                payload["temperature"] = temperature
            if max_tokens != 1000:
                payload["max_tokens"] = max_tokens
                
            response = requests.post(
                self.api_endpoint,
                json=payload
            )
            
            if not response.ok:
                logger.error(f"API request failed with status code: {response.status_code}")
                logger.error(f"Response content: {response.text[:500]}")
                raise ValueError(f"API request failed: {response.status_code}")
            
            # Parse the response
            try:
                logger.debug(f"Raw response text: {response.text[:500]}")
                
                # First, try to parse as JSON directly from the response
                try:
                    data = response.json()
                    # If we got here, it's a JSON object
                    if "choices" in data and len(data["choices"]) > 0:
                        result = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        logger.debug(f"Extracted content from choices: {result[:500] if isinstance(result, str) else str(result)[:500]}")
                    else:
                        # If it's JSON but not in the expected format, just use the response text
                        result = response.text
                        logger.debug(f"Using raw response text: {result[:500]}")
                except json.JSONDecodeError:
                    # Response is not a JSON object, might be just a string
                    result = response.text
                    logger.debug(f"Response is not JSON, using as string: {result[:500]}")
                    if result.startswith('"') and result.endswith('"'):
                        result = json.loads(result)  # This will unquote the string
            
                # If structured output is requested, make sure we extract valid JSON
                if structured_output or (isinstance(result, str) and (result.strip().startswith('{') or '```json' in result)):
                    logger.info("Processing response as structured data")
                    try:
                        # Try different extraction techniques
                        json_result = None
                        extraction_method = "none"
                        
                        # Method 1: Direct parsing if it starts with {
                        if isinstance(result, str) and result.strip().startswith('{'):
                            try:
                                json_result = json.loads(result)
                                extraction_method = "direct_parse"
                                logger.debug("Successfully parsed JSON directly")
                            except json.JSONDecodeError as e:
                                logger.debug(f"Direct JSON parsing failed: {str(e)}")
                                pass
                                
                        # Method 2: Extract from code blocks
                        if json_result is None and isinstance(result, str) and '```' in result:
                            json_match = re.search(r'```(?:json)?\n(.*?)\n```', result, re.DOTALL)
                            if json_match:
                                try:
                                    extracted_json = json_match.group(1)
                                    logger.debug(f"Extracted JSON from code block: {extracted_json[:500]}")
                                    json_result = json.loads(extracted_json)
                                    extraction_method = "code_block"
                                    logger.debug("Successfully parsed JSON from code block")
                                except json.JSONDecodeError as e:
                                    logger.debug(f"Code block JSON parsing failed: {str(e)}")
                                    pass
                        
                        # Method 3: Find any JSON-like structure
                        if json_result is None and isinstance(result, str):
                            json_match = re.search(r'\{[\s\S]*\}', result)
                            if json_match:
                                try:
                                    extracted_json = json_match.group(0)
                                    logger.debug(f"Extracted JSON-like structure: {extracted_json[:500]}")
                                    json_result = json.loads(extracted_json)
                                    extraction_method = "regex_match"
                                    logger.debug("Successfully parsed JSON from regex match")
                                except json.JSONDecodeError as e:
                                    logger.debug(f"Regex JSON parsing failed: {str(e)}")
                                    pass
                                    
                        # Method 4: Fix common JSON issues and try again
                        if json_result is None and isinstance(result, str):
                            try:
                                # Replace common JSON formatting errors
                                cleaned_json = result
                                # Remove any markdown backticks and language identifiers
                                cleaned_json = re.sub(r'```(?:json)?\n?', '', cleaned_json)
                                cleaned_json = re.sub(r'\n```', '', cleaned_json)
                                # Remove any explanatory text before or after the JSON
                                json_start = cleaned_json.find('{')
                                json_end = cleaned_json.rfind('}') + 1
                                if json_start >= 0 and json_end > json_start:
                                    cleaned_json = cleaned_json[json_start:json_end]
                                
                                logger.debug(f"Attempting to parse cleaned JSON: {cleaned_json[:500]}")
                                json_result = json.loads(cleaned_json)
                                extraction_method = "cleaned_json"
                                logger.debug("Successfully parsed cleaned JSON")
                            except (json.JSONDecodeError, ValueError) as e:
                                logger.debug(f"Cleaned JSON parsing failed: {str(e)}")
                                pass
                        
                        # If we successfully extracted JSON and structured output was requested,
                        # return the structured data
                        if json_result is not None:
                            logger.info(f"Successfully extracted structured data using method: {extraction_method}")
                            if structured_output:
                                result = json_result
                            else:
                                # For non-structured requests, keep the formatted result
                                # but also log that we found structured data
                                logger.info("Found structured data in non-structured request")
                        elif structured_output:
                            logger.error("Failed to extract structured data from response")
                            logger.error(f"Raw result: {result[:1000] if isinstance(result, str) else str(result)[:1000]}")
                    except Exception as e:
                        logger.error(f"Failed to parse structured content: {str(e)}")
                        if structured_output:
                            logger.error("Failed to extract required structured data")
                            if isinstance(result, str):
                                logger.error(f"Raw result: {result[:1000]}")
                
                # Cache result
                self.cache[cache_key] = result
                
                return result
            except Exception as e:
                logger.error(f"Error processing API response: {str(e)}")
                # Return raw text as fallback
                raw_result = response.text
                self.cache[cache_key] = raw_result
                return raw_result
            
        except Exception as e:
            logger.error(f"Error querying model: {str(e)}")
            raise
    
    async def query_model_async(self, prompt: str, temperature: float = 0.7, 
                              max_tokens: int = 1000, 
                              system_message: Optional[str] = None,
                              structured_output: bool = False) -> Union[str, Dict[str, Any]]:
        """
        Asynchronous version of query_model.
        
        Args:
            prompt: The prompt to send
            temperature: Creativity parameter (0.0-1.0)
            max_tokens: Maximum response length
            system_message: System context message
            structured_output: Whether to enforce structured output (for crewai compatibility)
            
        Returns:
            Model response as a string or structured data
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            lambda: self.query_model(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                system_message=system_message,
                structured_output=structured_output
            )
        )
    
    def generate_optimized_prompt(self, purpose: str, context: Dict[str, Any], 
                                constraints: Optional[List[str]] = None) -> str:
        """
        Generate an optimized prompt for a specific purpose.
        
        Args:
            purpose: The goal of the prompt
            context: Relevant information for the prompt
            constraints: Limitations or requirements
            
        Returns:
            Optimized prompt
        """
        try:
            # Format context as a string
            context_str = json.dumps(context, indent=2)
            
            # Format constraints as a string
            constraints_str = "\n".join([f"- {c}" for c in constraints]) if constraints else "None"
            
            # Create meta-prompt
            meta_prompt = f"""
            Generate an optimized prompt for the following purpose:
            
            Purpose: {purpose}
            
            Context:
            {context_str}
            
            Constraints:
            {constraints_str}
            
            The prompt should be clear, concise, and designed to elicit the best possible response from an AI model.
            """
            
            # Get optimized prompt
            result = self.query_model(meta_prompt)
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating optimized prompt: {str(e)}")
            raise
    
    def extract_structured_data(self, raw_text: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract structured data from raw text.
        
        Args:
            raw_text: The raw text to extract from
            schema: The schema for the structured data
            
        Returns:
            Extracted structured data
        """
        try:
            # Format schema as a string
            schema_str = json.dumps(schema, indent=2)
            
            # Create extraction prompt
            extraction_prompt = f"""
            Extract structured data from the following text according to this schema:
            
            {schema_str}
            
            Text:
            {raw_text}
            
            Return the extracted data as valid JSON.
            """
            
            # Get extraction result
            result = self.query_model(extraction_prompt)
            
            # Try to parse the result as JSON
            try:
                # Extract JSON from the result if it's wrapped in code blocks
                import re
                json_match = re.search(r'```(?:json)?\n(.*?)\n```', result, re.DOTALL)
                if json_match:
                    result = json_match.group(1)
                
                return json.loads(result)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse extracted data as JSON: {result}")
                # Attempt to extract using a different pattern
                try:
                    # Try to extract any JSON-like structure using a more lenient pattern
                    import re
                    json_match = re.search(r'\{[\s\S]*\}', result)
                    if json_match:
                        extracted_json = json_match.group(0)
                        return json.loads(extracted_json)
                except Exception as e:
                    logger.error(f"Second attempt to parse JSON failed: {str(e)}")
                return {}
            
        except Exception as e:
            logger.error(f"Error extracting structured data: {str(e)}")
            raise