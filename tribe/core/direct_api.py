import os
import json
import logging
from typing import Dict, Any, Optional, List, Union
from pydantic import BaseModel, Field, validator
from crewai import LLM

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Let CrewAI handle the API key automatically
# Initialize the LLM with a proper model name
try:
    claude_llm = LLM(
        model="claude-3-7-sonnet-20250219",
        temperature=0.7
    )
except Exception as e:
    logger.warning(f"Error initializing default LLM: {e}")
    claude_llm = None  # We'll create it when needed

# Pydantic models for team creation
class TechnicalSkill(BaseModel):
    name: str = Field(..., description="Name of the technical skill")
    proficiency: int = Field(..., description="Proficiency level from 1-10")
    years_experience: Optional[int] = Field(None, description="Years of experience with this skill")
    description: Optional[str] = Field(None, description="Brief description of how this skill applies to the project")
    
    @validator('proficiency')
    def validate_proficiency(cls, v):
        if not 1 <= v <= 10:
            raise ValueError('Proficiency must be between 1 and 10')
        return v

class Tool(BaseModel):
    name: str = Field(..., description="Name of the tool or technology")
    expertise_level: int = Field(..., description="Expertise level from 1-10")
    use_case: str = Field(..., description="How the professional uses this tool")
    efficiency_impact: Optional[str] = Field(None, description="How this tool enhances efficiency in the project")
    
    @validator('expertise_level')
    def validate_expertise_level(cls, v):
        if not 1 <= v <= 10:
            raise ValueError('Expertise level must be between 1 and 10')
        return v

class ProfessionalTrait(BaseModel):
    trait: str = Field(..., description="Professional trait or characteristic")
    description: str = Field(..., description="Detailed explanation of how this trait benefits the team and project")
    impact: str = Field(..., description="How this trait positively impacts the project's success")
    application: Optional[str] = Field(None, description="Specific examples of how this trait is applied in practice")

class ProjectContribution(BaseModel):
    area: str = Field(..., description="Area of contribution to the project")
    details: str = Field(..., description="Detailed explanation of the contribution")
    metrics: Optional[str] = Field(None, description="How the contribution can be measured or evaluated")

class CommunicationStyle(BaseModel):
    style: str = Field(..., description="Communication style (e.g., Direct, Nurturing, Analytical)")
    tone: str = Field(..., description="Tone of communication (e.g., Enthusiastic, Calm, Serious)")
    description: str = Field(..., description="Detailed explanation of the communication approach")

class CharacterTrait(BaseModel):
    trait: str = Field(..., description="Character trait or personality characteristic")
    description: str = Field(..., description="Detailed explanation of how this trait manifests")

class WorkingStyle(BaseModel):
    style: str = Field(..., description="Working or learning style")
    description: str = Field(..., description="How this style impacts collaboration and work output")

class TeamMember(BaseModel):
    name: str = Field(..., description="Character-like name for this team member")
    role: str = Field(..., description="Specific role title in the project")
    background: str = Field(..., description="Professional background and expertise")
    objective: str = Field(..., description="Primary objective and contribution to the project")
    character_traits: List[CharacterTrait] = Field(..., description="Key character traits and personality")
    communication_style: CommunicationStyle = Field(..., description="Communication style and tone")
    working_style: WorkingStyle = Field(..., description="Working and learning style")
    specializations: List[str] = Field(..., description="Areas of specialization that differentiate this professional")
    emoji: Optional[str] = Field(None, description="Emoji that represents this team member's personality")
    visual_description: Optional[str] = Field(None, description="Brief visual description of how this team member might look")
    catchphrase: Optional[str] = Field(None, description="A memorable catchphrase or saying this team member uses")

class Team(BaseModel):
    team: List[TeamMember] = Field(..., description="List of team members")

def extract_json_from_text(text: str) -> str:
    """
    Extract and clean JSON from text that may contain markdown or other formatting.
    
    Args:
        text: Text that may contain JSON possibly wrapped in markdown code blocks
        
    Returns:
        Cleaned JSON string
    """
    logger.info("Attempting to extract JSON from response text")
    
    # Try to extract JSON from markdown code blocks
    if "```json" in text:
        parts = text.split("```json")
        if len(parts) > 1:
            json_block = parts[1].split("```")[0].strip()
            logger.info("Extracted JSON from ```json code block")
            return json_block
    elif "```" in text:
        parts = text.split("```")
        if len(parts) > 1:
            json_block = parts[1].strip()
            logger.info("Extracted JSON from ``` code block")
            return json_block
    
    # Try to find JSON structure by looking for opening and closing braces
    try:
        if text.strip().startswith("{") and "}" in text:
            # Find the outermost matching braces
            stack = []
            start_idx = text.find("{")
            
            for i in range(start_idx, len(text)):
                if text[i] == "{":
                    stack.append("{")
                elif text[i] == "}":
                    stack.pop()
                    if not stack:  # If stack is empty, we found the matching end brace
                        json_block = text[start_idx:i+1]
                        logger.info("Extracted JSON by finding matching braces")
                        return json_block
    except Exception as e:
        logger.warning(f"Error extracting JSON by braces: {str(e)}")
    
    # Last resort: Try to clean the text by replacing common issues
    logger.warning("Using fallback JSON cleaning method")
    cleaned_text = text.strip()
    
    # Replace any unescaped quotes inside strings
    # This is a simplistic approach and might not work for all cases
    try:
        # Replace escaped quotes with a temporary placeholder
        temp_placeholder = "###ESCAPED_QUOTE###"
        cleaned_text = cleaned_text.replace('\\"', temp_placeholder)
        
        # Find string boundaries
        in_string = False
        i = 0
        while i < len(cleaned_text):
            if cleaned_text[i] == '"' and (i == 0 or cleaned_text[i-1] != '\\'):
                in_string = not in_string
            if in_string and cleaned_text[i] == '"' and cleaned_text[i-1] != '\\':
                # Replace unescaped quotes inside strings
                cleaned_text = cleaned_text[:i] + '\\"' + cleaned_text[i+1:]
                i += 1  # Skip the added backslash
            i += 1
            
        # Restore escaped quotes
        cleaned_text = cleaned_text.replace(temp_placeholder, '\\"')
    except Exception as e:
        logger.warning(f"Error during quote escaping: {str(e)}")
    
    # If no JSON found, return the cleaned text as is (assuming it's clean JSON)
    return cleaned_text

def query_model(
    messages: List[Dict[str, str]], 
    model: str = "claude-3-7-sonnet-20250219",
    temperature: float = 0.7,
    structured_output: Optional[BaseModel] = None
) -> Any:
    """
    Query the model directly using CrewAI's LLM class with structured output.
    
    Args:
        messages: List of message dictionaries with 'role' and 'content'
        model: Model name to use
        temperature: Temperature for generation
        structured_output: Optional Pydantic model to validate the response against
        
    Returns:
        Response content or validated Pydantic model instance
    """
    logger.info(f"Querying model {model} with {len(messages)} messages")
    
    try:
        # If structured output is requested, modify the system message
        if structured_output:
            logger.info(f"Using structured output for {structured_output.__name__}")
            
            # Add schema info to system message
            has_system = False
            new_messages = []
            schema_str = json.dumps(structured_output.schema(), indent=2)
            
            system_content = f"""You are a professional team composition expert.
            
YOUR RESPONSE MUST BE VALID JSON CONFORMING TO THIS SCHEMA:
{schema_str}

Return ONLY the JSON with no additional text or explanations."""
            
            for msg in messages:
                if msg.get("role") == "system":
                    has_system = True
                    new_messages.append({"role": "system", "content": system_content + "\n\n" + msg["content"]})
                else:
                    new_messages.append(msg)
            
            if not has_system:
                new_messages = [{"role": "system", "content": system_content}] + new_messages
                
            # Use the updated messages
            messages = new_messages
        
        # Format messages for CrewAI's LLM
        formatted_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
        ]
        
        # Configure LLM with proper settings - don't add 'anthropic/' prefix
        # Don't use response_format as it's not supported for Claude models in OpenAI provider
        llm = LLM(
            model=model,
            temperature=temperature
        )
        
        logger.info("Calling LLM with formatted messages")
        response = llm.call(messages=formatted_messages)
        logger.info("Received response from LLM")
        
        return response
            
    except Exception as e:
        logger.error(f"Error querying model: {str(e)}")
        raise ValueError(f"Failed to query model: {str(e)}")

def create_team(
    project_description: str,
    team_size: Optional[int] = None,
    model: str = "claude-3-7-sonnet-20250219",
    temperature: float = 0.7
) -> List[TeamMember]:
    """
    Create a team of professionals for a project with optimal team size.
    
    Args:
        project_description: Description of the project
        team_size: Optional number of team members to create. If None, optimal size will be determined.
        model: Model to use
        temperature: Temperature for generation
    
    Returns:
        List of TeamMember objects
    """
    logger.info(f"Creating a team of professionals with optimal structure")
    
    # Format the system message to allow for optimal team size if not specified
    team_size_instruction = f"exactly {team_size}" if team_size else "the OPTIMAL number of"
    
    system_message = f"""You are an expert team builder who creates detailed professional profiles for project teams.
    
For the given project description, create {team_size_instruction} professionals with complementary roles and distinct personalities.

If determining the optimal team size, consider:
1. The complexity and scope of the project
2. The different technical domains required 
3. Minimal viable team structure (no redundant roles)
4. Cross-functional capabilities of team members

For each team member, provide:
- A distinctive character-like name (e.g., "Nexus", "Echo", "Cipher")
- A specific role that clearly indicates their function
- Detailed background that explains their expertise
- Primary objective that defines their contribution
- Character traits and personality
- Communication style
- Working style
- Areas of specialization
- Optional: emoji, visual description, and catchphrase

Create a team where each member has complementary skills and personalities that work well together.
The team should collectively cover all aspects needed for the project."""

    messages = [
        {"role": "system", "content": system_message},
        {"role": "user", "content": project_description}
    ]
    
    try:
        # Use the Team model for structured output
        response = query_model(
            messages=messages,
            model=model, 
            temperature=temperature,
            structured_output=Team
        )
        
        return response.team
        
    except Exception as e:
        logger.error(f"Error creating team: {str(e)}")
        # Fall back to a minimal team structure
        logger.info("Falling back to minimal team structure")
        
        # Create a fallback team with generic roles
        fallback_team = [
            TeamMember(
                name="Nexus - Lead Engineer",
                role="Lead Engineer",
                background="Experienced software architect with expertise in system design.",
                objective="Coordinate technical implementation and ensure architectural integrity",
                character_traits=[
                    CharacterTrait(trait="Analytical", description="Carefully examines all aspects of a problem")
                ],
                communication_style=CommunicationStyle(
                    style="Direct", tone="Professional", description="Clear and concise communication focused on technical details"
                ),
                working_style=WorkingStyle(
                    style="Methodical", description="Approaches problems systematically with thorough planning"
                ),
                specializations=["System Architecture", "Technical Leadership"],
                emoji="💻"
            )
        ]
        
        # If team_size is specified, add more generic members
        if team_size and team_size > 1:
            fallback_team.append(
                TeamMember(
                    name="Echo - Designer",
                    role="Designer",
                    background="Creative designer with UX/UI expertise.",
                    objective="Create intuitive and appealing user interfaces",
                    character_traits=[
                        CharacterTrait(trait="Creative", description="Thinks outside the box for innovative solutions")
                    ],
                    communication_style=CommunicationStyle(
                        style="Visual", tone="Enthusiastic", description="Communicates ideas through visual examples and metaphors"
                    ),
                    working_style=WorkingStyle(
                        style="Iterative", description="Builds on ideas through rapid prototyping and feedback"
                    ),
                    specializations=["UI Design", "User Experience"],
                    emoji="🎨"
                )
            )
        
        return fallback_team

def create_single_specialist(
    project_description: str,
    role_description: str,
    model: str = "claude-3-7-sonnet-20250219",
    temperature: float = 0.7
) -> TeamMember:
    """
    Create a single professional specialist for a project.
    
    Args:
        project_description: Description of the project
        role_description: Description of the role
        model: Model to use
        temperature: Temperature for generation
        
    Returns:
        A professional specialist as a TeamMember
    """
    logger.info(f"Creating specialist for role: {role_description}")
    
    # System message to guide the model
    system_message = {
        "role": "system",
        "content": """You are a professional team composition expert focused on creating high-quality, character-rich team members.
        
Create a single professional team member with the following characteristics:
- Memorable character-like personality 
- Distinct communication style and tone
- Unique working and learning approach
- Professional background aligned with their role
- Clear objective that contributes to the project

IMPORTANT: The team member should have a memorable, character-like name (e.g., "Sparks", "Echo", "Flux") 
rather than a standard professional name. This name should be distinctive, short, and memorable.

Focus on creating a distinct, memorable personality while maintaining high-quality professional capabilities."""
    }
    
    # User message with the request
    user_message = {
        "role": "user",
        "content": f"""I need a professional specialist for the following project:

PROJECT DESCRIPTION:
{project_description}

ROLE DESCRIPTION:
{role_description}

Create a specialist with a distinct personality for this role in this project.
Make sure they have:
- A memorable, character-like name (like "Sparks", "Echo", or "Flux") instead of a standard name
- Professional background and expertise that fits their role
- A clear objective that explains their contribution
- 3-5 character traits with detailed descriptions of how they manifest
- A distinctive communication style and tone (analytical, enthusiastic, direct, etc.)
- A working/learning style that influences how they collaborate
- Areas of specialization relevant to their role
- An emoji that represents their personality
- A brief visual description that captures their essence
- A memorable catchphrase they might use"""
    }
    
    # Compose messages
    messages = [system_message, user_message]
    
    try:
        # Query the model
        response = query_model(
            messages=messages,
            model=model,
            temperature=temperature,
            structured_output=TeamMember
        )
        
        # The response will be a string with Claude
        if isinstance(response, str):
            logger.info("Received string response, parsing as JSON")
            try:
                # Try to extract JSON from markdown or text
                clean_json_str = extract_json_from_text(response)
                logger.info(f"Extracted JSON: {clean_json_str[:100]}...")
                
                parsed_data = json.loads(clean_json_str)
                result = TeamMember.parse_obj(parsed_data)
                logger.info(f"Successfully parsed response into TeamMember object")
            except Exception as e:
                logger.error(f"Failed to parse response: {str(e)}")
                logger.error(f"Raw response: {response[:500]}...")
                raise ValueError(f"Failed to parse response: {str(e)}")
        else:
            # Already a TeamMember object
            result = response
        
        logger.info(f"Created specialist: {result.name}, {result.role}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to create specialist: {str(e)}")
        raise ValueError(f"Failed to create specialist: {str(e)}")

# Example usage function
def example_usage():
    """
    Example of how to use the direct API functions.
    """
    project_description = """
    We're building a web application for task management. The application should allow users 
    to create and manage tasks with deadlines, organize tasks into projects, collaborate with 
    team members, track progress and generate reports, and integrate with calendar and email services.
    
    Key features include:
    - Task creation, editing, and assignment
    - Project organization
    - Team collaboration
    - Progress tracking
    - Calendar integration
    """
    
    try:
        # Create a team of professionals
        team = create_team(
            project_description=project_description,
            team_size=3
        )
        
        # Print the team members
        print("\n==== Professional Team ====\n")
        for i, member in enumerate(team):
            print(f"Member {i+1}: {member.name} - {member.role}")
            print(f"Objective: {member.objective}")
            print(f"Background: {member.background[:100]}...")
            print(f"Character Traits: {[trait.trait for trait in member.character_traits]}")
            print(f"Communication Style: {member.communication_style.style} - {member.communication_style.tone}")
            print(f"Working Style: {member.working_style.style}")
            print(f"Specializations: {member.specializations}")
            print(f"Emoji: {member.emoji}")
            print(f"Visual Description: {member.visual_description}")
            print(f"Catchphrase: {member.catchphrase}")
            print("---")
            
    except Exception as e:
        logger.error(f"Error in example usage: {str(e)}")

if __name__ == "__main__":
    # Run the example if this module is executed directly
    example_usage() 