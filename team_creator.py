import os
import json
import logging
from typing import List, Dict, Any, Optional
from crewai import Agent, Task, Crew, LLM
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize Claude LLM
claude_llm = LLM(
    model="anthropic/claude-3-7-sonnet-20250219",
    temperature=0.7
)

# Define models for structured output
class TechnicalSkill(BaseModel):
    name: str = Field(..., description="Name of the technical skill")
    proficiency: int = Field(..., description="Proficiency level from 1-10")
    years_experience: Optional[int] = Field(None, description="Years of experience with this skill")

class Tool(BaseModel):
    name: str = Field(..., description="Name of the tool or technology")
    expertise_level: int = Field(..., description="Expertise level from 1-10")
    use_case: str = Field(..., description="How the professional uses this tool")

class ProfessionalTrait(BaseModel):
    trait: str = Field(..., description="Professional trait or characteristic")
    description: str = Field(..., description="Detailed explanation of how this trait benefits the team and project")
    impact: str = Field(..., description="How this trait positively impacts the project's success")

class TeamMember(BaseModel):
    name: str = Field(..., description="Professional name for this team member")
    role: str = Field(..., description="Specific role title in the project")
    background: str = Field(..., description="Professional background and expertise")
    objective: str = Field(..., description="Primary objective and contribution to the project")
    technical_skills: List[TechnicalSkill] = Field(..., description="Technical skills and proficiencies")
    tools_and_technologies: List[Tool] = Field(..., description="Tools and technologies used")
    communication_approach: str = Field(..., description="Professional communication approach")
    methodology: str = Field(..., description="Work methodology and professional process")
    key_traits: List[ProfessionalTrait] = Field(..., description="Key professional traits and qualities")
    specializations: List[str] = Field(..., description="Areas of specialization that differentiate this professional")
    growth_areas: Optional[List[str]] = Field(None, description="Areas for continued professional development")

class Team(BaseModel):
    team: List[TeamMember] = Field(..., description="List of team members")

# Hardcoded Director of Engineering Agent
director_engineering = Agent(
    role="Director of Engineering",
    goal="Assemble and lead the optimal development team to deliver exceptional software products",
    backstory="""As a seasoned technology leader with 20+ years of experience across enterprise software, 
    fintech, and SaaS platforms, you excel at assembling high-performing technical teams. 
    
    Your expertise spans the entire software development lifecycle, with particular strength in 
    modern architectures, scalable systems, and engineering excellence. Your approach combines 
    technical precision with strategic vision, enabling you to identify the optimal team composition 
    for any project.
    
    Throughout your career, you've consistently delivered complex projects through thoughtful team 
    composition, balancing technical expertise with collaboration skills. You understand that 
    exceptional products require exceptional professionals working together effectively.
    
    Your leadership philosophy emphasizes clear communication, technical excellence, and outcome-focused 
    development practices. You're known for your ability to align engineering efforts with business 
    objectives and deliver high-quality solutions that exceed expectations.""",
    verbose=True,
    llm=claude_llm
)

def generate_professional_team(project_description: str, team_size: int = 3) -> List[TeamMember]:
    """
    Generate a team of high-quality professionals for a given project description using the Director of Engineering agent.
    
    Args:
        project_description: Detailed description of the project
        team_size: Number of team members to generate
        
    Returns:
        List of TeamMember objects
    """
    logger.info(f"Generating professional team for project: {project_description[:50]}...")
    
    # Create task for the Director of Engineering to design the team
    team_design_task = Task(
        description=f"""
        As the Director of Engineering, your task is to assemble the optimal team of software professionals 
        for the following project:
        
        PROJECT DESCRIPTION:
        {project_description}
        
        Assemble a team of {team_size} exceptional professionals who collectively possess all the skills and qualities 
        needed to deliver this project with excellence. For each team member, provide:
        
        1. A professional name
        2. A specific role in the project (be specific and detailed beyond generic titles)
        3. Professional background (100-150 words) detailing education, experience, and expertise
        4. Primary objective and contribution to the project
        5. 5-8 technical skills with proficiency levels (1-10) and years of experience
        6. 4-6 specific tools and technologies with expertise levels (1-10) and specific use cases
        7. Professional communication approach
        8. Work methodology and process
        9. 3-5 key professional traits and qualities, each with:
           - Description of the trait
           - Detailed explanation of how this trait benefits the team
           - Specific impact on the project's success
        10. 4-6 specialized areas that differentiate this professional
        11. Optional: 2-3 areas for continued professional growth, focusing on positive development
        
        Your response MUST strictly follow this JSON structure:
        {{
          "team": [
            {{
              "name": "Professional name",
              "role": "Specific role title",
              "background": "Professional background (100-150 words)",
              "objective": "Primary objective for this project",
              "technical_skills": [
                {{"name": "skill name", "proficiency": 9, "years_experience": 5}},
                ...5-8 skills
              ],
              "tools_and_technologies": [
                {{"name": "tool name", "expertise_level": 8, "use_case": "specific use case"}},
                ...4-6 tools
              ],
              "communication_approach": "Description of professional communication approach",
              "methodology": "Description of work methodology and process",
              "key_traits": [
                {{
                  "trait": "trait name",
                  "description": "detailed explanation of trait",
                  "impact": "specific impact on project success"
                }},
                ...3-5 traits
              ],
              "specializations": ["specialization1", "specialization2", ...4-6 specializations],
              "growth_areas": ["growth area1", "growth area2", ...optional 2-3 areas]
            }},
            ...{team_size} team members
          ]
        }}
        
        IMPORTANT GUIDELINES:
        - Focus on creating a professional, balanced team with complementary skills
        - Ensure diversity in expertise, specializations, and professional approaches
        - Highlight strengths and positive qualities - this is a product-focused team, not a game
        - Be specific about how each professional's skills and traits will contribute to project success
        - Emphasize quality, excellence, and professionalism in all aspects
        - Use realistic proficiency levels that reflect true expertise
        - Design the team to maximize product quality and efficiency
        
        Your team composition must be optimized specifically for this project's requirements.
        Respond ONLY with the JSON object - no additional text, explanations, or formatting.
        """,
        expected_output="A JSON object containing the optimal professional team composition for the project",
        agent=director_engineering
    )
    
    # Execute the task
    result = team_design_task.execute_sync()
    logger.info("Team design task completed")
    
    try:
        # Extract JSON from the response - handle potential formatting issues
        if "```json" in result:
            json_str = result.split("```json")[1].split("```")[0].strip()
        elif "```" in result:
            json_str = result.split("```")[1].strip()
        else:
            json_str = result.strip()
            
        # Parse the JSON
        team_data = json.loads(json_str)
        
        # Validate using Pydantic model
        validated_team = Team(**team_data)
        logger.info(f"Successfully generated and validated professional team with {len(validated_team.team)} members")
        
        return validated_team.team
        
    except Exception as e:
        logger.error(f"Error parsing team data: {str(e)}")
        logger.error(f"Raw response: {result[:500]}...")
        raise ValueError("Failed to parse team data from Director of Engineering response")

def create_professional_crew(project_description: str, team_size: int = 3) -> Crew:
    """
    Create a CrewAI Crew with the Director of Engineering and generated professional team members.
    
    Args:
        project_description: Detailed description of the project
        team_size: Number of team members to generate
        
    Returns:
        CrewAI Crew instance with all agents
    """
    # Generate the team members
    team_members = generate_professional_team(project_description, team_size)
    
    # Create Agent instances from team members
    agents = [
        Agent(
            role=member.role,
            goal=member.objective,
            backstory=member.background,
            verbose=True,
            llm=claude_llm
        )
        for member in team_members
    ]
    
    # Add Director of Engineering to the team
    agents.append(director_engineering)
    
    # Create the crew
    crew = Crew(
        agents=agents,
        tasks=[],  # Tasks would be defined separately based on the project
        verbose=True
    )
    
    return crew

def main():
    """
    Main function to demonstrate professional team creation.
    """
    # Example project description
    project_description = """
    We're building a web application for task management. The application should allow users 
    to create and manage tasks with deadlines, organize tasks into projects, collaborate with 
    team members, track progress and generate reports, and integrate with calendar and email services.
    
    The application needs to have a responsive and intuitive user interface, a robust backend for 
    data storage and business logic, and secure authentication. It should also provide real-time 
    updates, notifications, and integration with third-party services.
    
    Key features include:
    - User registration and authentication
    - Task creation, editing, and deletion
    - Task assignment to team members
    - Project organization and hierarchy
    - Due date tracking and reminders
    - Progress tracking and status updates
    - Real-time collaboration and commenting
    - File attachments and document sharing
    - Calendar integration and scheduling
    - Email notifications and digests
    - Reporting and analytics
    - Mobile-responsive design
    """
    
    # Create the professional team
    team_size = 3
    try:
        team_members = generate_professional_team(project_description, team_size)
        
        # Print the team members
        logger.info("\n==== Professional Team ====\n")
        for i, member in enumerate(team_members):
            logger.info(f"Member {i+1}: {member.name} - {member.role}")
            logger.info(f"Objective: {member.objective}")
            logger.info(f"Background: {member.background[:100]}...")
            logger.info(f"Technical Skills: {[skill.name for skill in member.technical_skills]}")
            logger.info(f"Specializations: {member.specializations}")
            logger.info(f"Key Traits: {[trait.trait for trait in member.key_traits]}")
            logger.info("---")
        
        # Create the crew
        crew = create_professional_crew(project_description, team_size)
        logger.info(f"Successfully created professional crew with {len(crew.agents)} agents")
        
    except Exception as e:
        logger.error(f"Error creating team: {str(e)}")

def list_improvable_prompts():
    """
    List other prompts in the app that could be improved for a professional, quality-focused approach.
    """
    logger.info("\n==== Prompts That Could Be Improved ====\n")
    
    improvable_prompts = [
        {
            "location": "extension.py - _create_additional_team_members function",
            "current_purpose": "Generates team members using Lambda API",
            "improvement": "Replace with direct API calls using CrewAI's LLM class and structured professional output model"
        },
        {
            "location": "tribe/core/foundation_model.py - query_model function",
            "current_purpose": "Generic model querying through Lambda API",
            "improvement": "Replace with direct provider-specific API calls that are optimized for professional-quality outputs"
        },
        {
            "location": "test_team_creation.py",
            "current_purpose": "Tests team creation process",
            "improvement": "Update to use new direct API approach with improved professional-focused prompting"
        },
        {
            "location": "tribe/core/reasoning.py - generate_reasoning",
            "current_purpose": "Generates reasoning for agent actions",
            "improvement": "Enhance prompt to focus on professional justifications and quality-oriented decision making"
        },
        {
            "location": "tribe/core/task_processing.py - process_task",
            "current_purpose": "Processes tasks for agents",
            "improvement": "Refine task prompts to emphasize professional standards, excellence, and quality outcomes"
        },
        {
            "location": "tribe/extension.py - initialize_project",
            "current_purpose": "Initializes a project with team data",
            "improvement": "Update prompts to focus on professional collaboration patterns and industry best practices"
        }
    ]
    
    for i, prompt in enumerate(improvable_prompts):
        logger.info(f"{i+1}. {prompt['location']}")
        logger.info(f"   Current purpose: {prompt['current_purpose']}")
        logger.info(f"   Improvement: {prompt['improvement']}")
        logger.info("---")
    
    return improvable_prompts

if __name__ == "__main__":
    logger.info("Starting professional team creation process...")
    main()
    list_improvable_prompts() 