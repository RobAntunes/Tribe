import asyncio
import logging
from tribe.core.dynamic import DynamicCrew, SystemConfig

logging.basicConfig(level=logging.INFO)

async def test():
    # Create config
    config = SystemConfig(
        api_endpoint='https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/'
    )
    
    # Create crew
    crew = DynamicCrew(config=config)
    
    # Create agent
    agent = await crew.create_agent(
        role='Developer',
        name='Dev',
        backstory='Expert developer with years of experience',
        goal='Build great software'
    )
    
    print(f'Agent created: {agent.name}')
    
    return agent

if __name__ == "__main__":
    asyncio.run(test()) 