import os
from crewai import Agent, Task, Crew, LLM
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Claude LLM
claude_llm = LLM(
    model="anthropic/claude-3-7-sonnet-20250219",
    temperature=0.7
)

# Create agents with specific roles
frontend_dev = Agent(
    role="Frontend Developer",
    goal="Design and implement the user interface of the task management web application",
    backstory="You are an experienced frontend developer with expertise in creating intuitive and responsive user interfaces. You have a strong background in modern JavaScript frameworks and CSS.",
    verbose=True,
    llm=claude_llm
)

backend_dev = Agent(
    role="Backend Developer",
    goal="Develop the server-side logic and database architecture for the task management application",
    backstory="You are a skilled backend developer with expertise in building scalable and secure APIs. You have extensive experience with database design and server-side technologies.",
    verbose=True,
    llm=claude_llm
)

project_manager = Agent(
    role="Project Manager",
    goal="Coordinate the development process and ensure the project meets all requirements",
    backstory="You are an experienced project manager with a track record of successfully delivering web applications. You excel at coordinating team efforts and ensuring projects stay on schedule.",
    verbose=True,
    llm=claude_llm
)

# Define tasks for each agent
frontend_task = Task(
    description="""
    Design the user interface for a task management web application with the following features:
    1. Task creation and management interface
    2. Project organization view
    3. Team collaboration features
    4. Progress tracking and reporting dashboard
    5. Calendar and email integration
    
    Provide a detailed description of the UI components, layout, and user flow.
    """,
    expected_output="A detailed UI design document for the task management web application",
    agent=frontend_dev
)

backend_task = Task(
    description="""
    Design the backend architecture for a task management web application with the following requirements:
    1. User authentication and authorization
    2. Task and project data models
    3. API endpoints for task and project management
    4. Integration with calendar and email services
    5. Data storage and retrieval optimization
    
    Provide a detailed description of the database schema, API endpoints, and server-side logic.
    """,
    expected_output="A comprehensive backend architecture document for the task management web application",
    agent=backend_dev
)

integration_task = Task(
    description="""
    Create a comprehensive project plan that integrates the frontend and backend components of the task management web application.
    Include:
    1. Project timeline and milestones
    2. Resource allocation
    3. Integration points between frontend and backend
    4. Testing strategy
    5. Deployment plan
    
    Use the outputs from the frontend and backend design tasks to create a cohesive plan.
    """,
    expected_output="A detailed project plan that integrates frontend and backend components",
    agent=project_manager,
    dependencies=[frontend_task, backend_task]
)

# Create the crew
task_management_crew = Crew(
    agents=[frontend_dev, backend_dev, project_manager],
    tasks=[frontend_task, backend_task, integration_task],
    verbose=True
)

# Run the crew
result = task_management_crew.kickoff()

print("\n==== Final Result ====\n")
print(result) 