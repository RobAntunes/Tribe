import asyncio
import logging
from tribe.crew import Tribe

logging.basicConfig(level=logging.INFO)

async def test():
    # Create Tribe instance
    tribe = await Tribe.create(api_endpoint='https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/')
    
    print(f'Tribe created: {tribe}')
    
    # Create team
    team = await tribe.create_team_from_spec({
        "name": "Project Management System",
        "description": "A system for managing projects and tasks",
        "roles": [
            {
                "role": "Developer",
                "name": "Dev",
                "backstory": "Expert developer with years of experience",
                "goal": "Build great software"
            },
            {
                "role": "Designer",
                "name": "Designer",
                "backstory": "Creative designer with an eye for detail",
                "goal": "Create beautiful user interfaces"
            }
        ]
    })
    
    print(f'Team created: {team}')
    
    return tribe

if __name__ == "__main__":
    asyncio.run(test()) 