import asyncio
import logging
import json
import sys
import uuid
from tribe.extension import _create_additional_team_members
from tribe.core.dynamic import DynamicAgent
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

async def test_full_team_creation():
    """Test the complete team creation workflow with character-focused agents."""
    logger.info("Starting full team creation test with character-focused agents")
    
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
        # Create a VP of Engineering agent manually first
        vp = await DynamicAgent.create_vp_engineering(payload.get("description", ""))
        logger.info(f"Created VP of Engineering: {vp.name}")
        
        # Create additional team members using our new implementation
        additional_agents = await asyncio.wait_for(
            _create_additional_team_members(payload.get("description", "")),
            timeout=120  # 2 minute timeout for creating additional members
        )
        
        logger.info(f"Created {len(additional_agents)} additional team members")
        
        # Convert dictionary agents to DynamicAgent objects
        dynamic_additional_agents = []
        # Store character attributes separately for each agent
        agent_attributes = {}
        
        for agent_dict in additional_agents:
            # Create a DynamicAgent with the correct parameters
            dynamic_agent = DynamicAgent(
                role=agent_dict["role"],
                goal=agent_dict["goal"],
                backstory=agent_dict["description"],
                api_endpoint=None  # Use default API endpoint
            )
            
            # Set name and other attributes after initialization
            dynamic_agent.name = agent_dict["name"]
            dynamic_agent.short_description = agent_dict.get("description", "")[:100]
            
            # Store character attributes in a separate dictionary using agent's name as key
            agent_id = str(uuid.uuid4())
            agent_attributes[agent_id] = {
                "character": agent_dict.get("character", []),
                "communication_style": agent_dict.get("communication_style", ""),
                "working_style": agent_dict.get("working_style", ""),
                "emoji": agent_dict.get("emoji", "💡"),
                "visual_description": agent_dict.get("visual_description", ""),
                "catchphrase": agent_dict.get("catchphrase", "")
            }
            
            # Add to our list
            dynamic_additional_agents.append(dynamic_agent)
            
            # Log agent details
            logger.info(f"\nAdded agent: {dynamic_agent.name}")
            logger.info(f"Role: {dynamic_agent.role}")
            logger.info(f"Goal: {dynamic_agent.goal[:100]}...")
            
            # Log character attributes from our separate dictionary
            attrs = agent_attributes[agent_id]
            logger.info(f"Character traits: {attrs['character']}")
            logger.info(f"Communication style: {attrs['communication_style']}")
            logger.info(f"Emoji: {attrs['emoji']}")
            logger.info(f"Catchphrase: {attrs['catchphrase']}")
        
        # Combine VP with additional agents
        all_agents = [vp] + dynamic_additional_agents
        
        logger.info(f"\nFull team created with {len(all_agents)} agents:")
        for i, agent in enumerate(all_agents):
            logger.info(f"{i+1}. {agent.name} - {agent.role}")
        
        logger.info("\nFull team creation test succeeded!")
        return True
    except Exception as e:
        logger.error(f"Full team creation test failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    asyncio.run(test_full_team_creation()) 