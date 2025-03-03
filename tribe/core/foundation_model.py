"""Foundation Model interface module providing standardized AI model access."""

import json
import logging
import asyncio
import re
from typing import Dict, List, Optional, Any, Union
from crewai import LLM
from .config import config

# Set up logging
logger = logging.getLogger(__name__)


class FoundationModelInterface:
    """Standardized interface for interacting with foundation models."""

    def __init__(self, api_endpoint: Optional[str] = None, model: str = "anthropic/claude-3-7-sonnet-20250219"):
        """
        Initialize the foundation model interface.

        Args:
            api_endpoint: Not used, kept for compatibility
            model: The model name to use
        """
        self.model = model
        self.cache = {}
        self._llm = None

    @property
    def llm(self):
        """
        Get or create the LLM instance.
        
        Returns:
            LLM: The CrewAI LLM instance
        """
        if self._llm is None:
            self._llm = LLM(
                model=self.model,
                temperature=0.7
            )
        return self._llm

    def query_model(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        system_message: Optional[str] = None,
        structured_output: bool = False,
    ) -> Union[str, Dict[str, Any]]:
        """
        Send a prompt to the foundation model and get a response.

        Args:
            prompt: The prompt to send
            temperature: Creativity parameter (0.0-1.0)
            max_tokens: Maximum response length
            system_message: System context message
            structured_output: Whether to enforce structured output

        Returns:
            Model response as a string or structured data
        """
        try:
            # Create cache key
            cache_key = f"{prompt[:100]}_{temperature}_{max_tokens}_{structured_output}"

            # Check cache
            if cache_key in self.cache:
                return self.cache[cache_key]

            # Prepare messages
            messages = []
            
            # Add system message if provided
            if system_message:
                messages.append({"role": "system", "content": system_message})
            elif structured_output:
                messages.append({
                    "role": "system", 
                    "content": "You are a structured data extraction system. Respond only with valid JSON."
                })

            # Add the main prompt
            messages.append({"role": "user", "content": prompt})

            logger.info(f"Sending request to foundation model using CrewAI")
            logger.debug(f"Request messages: {json.dumps(messages)}")

            # Configure LLM for this request
            if temperature != 0.7:
                self.llm.temperature = temperature
                
            # Set structured output format if needed
            response_format = {"type": "json_object"} if structured_output else None
            if structured_output:
                self.llm.response_format = response_format

            # Make the request
            response = self.llm.call(messages=messages)

            # Process the response
            if structured_output:
                try:
                    if isinstance(response, str):
                        # Extract JSON from the result if it's wrapped in code blocks
                        json_match = re.search(r"```(?:json)?\n(.*?)\n```", response, re.DOTALL)
                        if json_match:
                            response = json_match.group(1)
                        result = json.loads(response)
                    else:
                        result = response
                    
                    # Cache result
                    self.cache[cache_key] = result
                    return result
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse structured data as JSON: {response}")
                    return response
            else:
                # Cache result
                self.cache[cache_key] = response
                return response

        except Exception as e:
            logger.error(f"Error querying model: {str(e)}")
            raise

    async def query_model_async(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        system_message: Optional[str] = None,
        structured_output: bool = False,
    ) -> Union[str, Dict[str, Any]]:
        """
        Asynchronous version of query_model.

        Args:
            prompt: The prompt to send
            temperature: Creativity parameter (0.0-1.0)
            max_tokens: Maximum response length
            system_message: System context message
            structured_output: Whether to enforce structured output

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
                structured_output=structured_output,
            ),
        )

    def generate_optimized_prompt(
        self,
        purpose: str,
        context: Dict[str, Any],
        constraints: Optional[List[str]] = None,
    ) -> str:
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
            constraints_str = (
                "\n".join([f"- {c}" for c in constraints]) if constraints else "None"
            )

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

    def extract_structured_data(
        self, raw_text: str, schema: Dict[str, Any]
    ) -> Dict[str, Any]:
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
            result = self.query_model(extraction_prompt, structured_output=True)

            # If result is already parsed JSON (dict)
            if isinstance(result, dict):
                return result
                
            # Try to parse the result as JSON if it's a string
            try:
                # Extract JSON from the result if it's wrapped in code blocks
                json_match = re.search(r"```(?:json)?\n(.*?)\n```", result, re.DOTALL)
                if json_match:
                    result = json_match.group(1)

                return json.loads(result)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse extracted data as JSON: {result}")
                # Attempt to extract using a different pattern
                try:
                    # Try to extract any JSON-like structure using a more lenient pattern
                    json_match = re.search(r"\{[\s\S]*\}", result)
                    if json_match:
                        extracted_json = json_match.group(0)
                        return json.loads(extracted_json)
                except Exception as e:
                    logger.error(f"Second attempt to parse JSON failed: {str(e)}")
                return {}

        except Exception as e:
            logger.error(f"Error extracting structured data: {str(e)}")
            raise
