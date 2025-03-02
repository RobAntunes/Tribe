import re

# Read the file
with open("tribe/extension.py", "r") as file:
    content = file.read()

# Define the old prompt pattern with proper escaping for regex
old_prompt_pattern = r'''user_prompt = f"""Create an optimal set of agents for this project:
        
        Project Description: \{project_description\}
        
        CRITICAL REQUIREMENTS \(MUST FOLLOW EXACTLY\):
        1\. Create a diverse team with 5-8 different specialized roles
        2\. Give each agent a memorable character-like name \(like "Spark", "Nova", "Cipher"\)
        3\. Include detailed backstory/description for each agent
        4\. Define clear skills and responsibilities for each role
        5\. Ensure the team can handle all aspects of software development
        6\. Define specific collaboration patterns between agents
        
        For each agent, provide:
        1\. A character-like name \(e\.g\. Sparks, Nova, Cipher, etc\.\) that reflects their personality or function
        2\. A clear role definition
        3\. A detailed backstory
        4\. Their primary goals
        5\. A set of initial tasks
        
        Your response MUST be formatted as valid JSON that matches this structure exactly:
        \{
          "required_roles": \[
            \{
              "role": "Role title",
              "name": "Character name - Role",
              "description": "Detailed description and backstory",
              "goal": "Primary objective for this role",
              "required_skills": \["skill1", "skill2", "skill3"\],
              "collaboration_pattern": "How this agent collaborates"
            \}
          \],
          "team_structure": \{
            "hierarchy": "flat/hierarchical",
            "communication": "Communication patterns between agents",
            "coordination": "How agents coordinate work"
          \}
        \}
        
        Remember, each agent should have a distinctive character-like name, not just their role \(e\.g\., "Nova" not just "Designer"\)\.
        
        IMPORTANT: 
        - Include a VP of Engineering or similar leadership role
        - Your response MUST be pure, valid JSON with NO text outside the JSON structure
        - No explanations, comments, or markdown formatting allowed
        - This JSON will be parsed automatically by a machine, so it must be perfectly formatted
        - Do not include any text like "```json" or "```" around your JSON'''

# Define the new prompt
new_prompt = '''user_prompt = f"""Create an optimal set of agents for this project:
        
        Project Description: {project_description}
        
        CRITICAL REQUIREMENTS (MUST FOLLOW EXACTLY):
        1. Create a diverse team with 5-8 different specialized roles
        2. Give each agent a memorable character-like name (like "Spark", "Nova", "Cipher")
        3. Include detailed backstory/description for each agent
        4. Define clear skills and responsibilities for each role
        5. Ensure the team can handle all aspects of software development
        6. Define specific collaboration patterns between agents
        
        For each agent, provide:
        1. A character-like name (e.g. Sparks, Nova, Cipher, etc.) that reflects their personality or function
        2. A clear role definition
        3. A detailed backstory
        4. Their primary goals
        5. A set of initial tasks
        
        Your response MUST match this Pydantic model structure exactly:
        
        ```python
        class RoleRequirement(BaseModel):
            role: str  # Role title 
            name: str  # Character name - Role
            description: str  # Detailed description and backstory
            goal: str  # Primary objective for this role
            required_skills: List[str]  # List of skills this role requires
            collaboration_pattern: str  # How this agent collaborates

        class TeamStructure(BaseModel):
            hierarchy: str  # flat/hierarchical
            communication: str  # Communication patterns between agents
            coordination: str  # How agents coordinate work

        class TeamCompositionResponse(BaseModel):
            required_roles: List[RoleRequirement]
            team_structure: TeamStructure
        ```
        
        Remember, each agent should have a distinctive character-like name, not just their role (e.g., "Nova" not just "Designer").
        
        IMPORTANT: 
        - Include a VP of Engineering or similar leadership role
        - Your response will be validated using Pydantic, so the structure must match exactly
        - Return valid JSON that will be parsed automatically
        - Include all required fields for each model'''

# Update content using regex with proper consideration for line breaks and spacing
updated_content = re.sub(old_prompt_pattern, new_prompt, content)

# Write the updated content
with open("tribe/extension.py", "w") as file:
    file.write(updated_content)

print("Updated the user prompt in extension.py")
