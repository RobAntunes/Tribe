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
        self.ai_api_endpoint = "https://api.example.com"  # Mock endpoint
        self.active_crews = {}
        self.active_agents = {}

async def test_complete_team_creation():
    """Test the complete team creation workflow."""
    logger.info("Starting complete team creation test")
    
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
        
        logger.info(f"Team creation succeeded with {len(result.get('agents', []))} agents")
        for agent in result.get("agents", []):
            logger.info(f"\nAgent: {agent.get('name')}")
            logger.info(f"Role: {agent.get('role')}")
            logger.info(f"Goal: {agent.get('goal')[:100]}...")
            
        return True
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_complete_team_creation()) 