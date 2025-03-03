import asyncio
import logging
import json
import sys
from tribe.extension import _create_team_implementation
from pygls.server import LanguageServer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

class TestTribeLanguageServer(LanguageServer):
    def __init__(self):
        super().__init__(name="test-tribe-ls", version="1.0.0")
        self.workspace_path = "/tmp/test_workspace"
        self.ai_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
        self.active_crews = {}
        self.active_agents = {}

async def test_create_team_implementation():
    """Test the full team creation implementation with character-focused agents."""
    logger.info("Starting full team creation implementation test")
    
    # Create test LS instance
    ls = TestTribeLanguageServer()
    
    # Project description
    payload = {
        "description": """
        We are building a modern social media analytics platform with AI capabilities.
        The platform should analyze social media trends, provide personalized insights,
        and offer automated content recommendations. It should include a web dashboard,
        mobile app, and API integrations with major social networks.
        """
    }
    
    try:
        # Call the team creation implementation
        result = await _create_team_implementation(ls, payload)
        
        # Log the result
        if "error" in result:
            logger.error(f"Team creation failed: {result['error']}")
            return False
        
        if "agents" in result:
            logger.info(f"Team creation succeeded with {len(result['agents'])} agents")
            for agent in result["agents"]:
                if hasattr(agent, "name") and hasattr(agent, "role"):
                    logger.info(f"Agent: {agent.name} - {agent.role}")
                else:
                    logger.info(f"Agent: {agent}")
        else:
            logger.info(f"Team creation result: {result}")
        
        # Log crews
        if hasattr(ls, "active_crews") and ls.active_crews:
            logger.info(f"Created {len(ls.active_crews)} active crews")
            for crew_id, crew in ls.active_crews.items():
                logger.info(f"Crew ID: {crew_id}")
                if hasattr(crew, "get_active_agents"):
                    agents = crew.get_active_agents()
                    logger.info(f"Active agents: {len(agents)}")
                    for agent in agents:
                        if hasattr(agent, "name") and hasattr(agent, "role"):
                            logger.info(f"  - {agent.name} ({agent.role})")
                            # Log character attributes if available
                            if hasattr(agent, "_state") and "project_context" in agent._state:
                                ctx = agent._state["project_context"]
                                if "emoji" in ctx:
                                    logger.info(f"    Emoji: {ctx['emoji']}")
                                if "catchphrase" in ctx:
                                    logger.info(f"    Catchphrase: {ctx['catchphrase']}")
        
        logger.info("Team creation implementation test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Team creation implementation test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_create_team_implementation()) 