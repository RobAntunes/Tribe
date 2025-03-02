from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# Create a Pydantic model that matches the expected Lambda API response
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

# Create example input for testing
example_input = {
    "required_roles": [
        {
            "role": "VP of Engineering",
            "name": "Tank - VP of Engineering",
            "description": "A strategic technical leader with vision",
            "goal": "Direct overall development effort",
            "required_skills": ["leadership", "architecture", "planning"],
            "collaboration_pattern": "Directing"
        }
    ],
    "team_structure": {
        "hierarchy": "hierarchical", 
        "communication": "regular meetings",
        "coordination": "task assignments"
    }
}

# Test validation
test = TeamCompositionResponse(**example_input)
print("Model validation successful\!")
print(f"Number of roles: {len(test.required_roles)}")
print(f"First role name: {test.required_roles[0].name}")
