import asyncio
import logging
from tribe.core.dynamic import DynamicCrew, SystemConfig, DynamicAgent

logging.basicConfig(level=logging.INFO)

async def test():
    # Create config
    config = SystemConfig(
        api_endpoint='https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/'
    )
    
    # Create crew
    crew = DynamicCrew(config=config)
    
    # Create some agents
    dev_agent = await crew.create_agent(
        role='Developer',
        name='Dev',
        backstory='Expert developer with years of experience',
        goal='Build great software'
    )
    
    designer_agent = await crew.create_agent(
        role='Designer',
        name='Designer',
        backstory='Creative designer with an eye for detail',
        goal='Create beautiful user interfaces'
    )
    
    # Create team
    team = await crew.create_team("Project Management System")
    
    print(f'Team created: {team}')
    
    return team

if __name__ == "__main__":
    asyncio.run(test()) 