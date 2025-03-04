"""Configuration management for the Tribe extension."""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Central configuration management."""
    
    def __init__(self):
        """Initialize configuration from environment variables."""
        # Load API keys - try to get from environment but don't require it
        # The CrewAI library will handle getting API keys from various sources
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
            
        # Optional configurations with defaults
        self.max_rpm = int(os.getenv("TRIBE_MAX_RPM", "60"))
        self.verbose = os.getenv("TRIBE_VERBOSE", "true").lower() == "true"
        
        # CrewAI agent configuration defaults
        self.agent_defaults = {
            "allow_delegation": os.getenv("TRIBE_ALLOW_DELEGATION", "true").lower() == "true",
            "allow_code_execution": os.getenv("TRIBE_ALLOW_CODE_EXECUTION", "false").lower() == "true",
            "memory": True,
            "memory_config": {
                "type": os.getenv("TRIBE_MEMORY_TYPE", "buffer"),
                "max_tokens": int(os.getenv("TRIBE_MEMORY_MAX_TOKENS", "10000"))
            },
            "verbose": self.verbose
        }
        
        # System configuration
        self.system = {
            "default_model": os.getenv("TRIBE_MODEL", "anthropic/claude-3-7-sonnet-20250219"),
            "collaboration_mode": os.getenv("TRIBE_COLLABORATION_MODE", "HYBRID"),
            "process_type": os.getenv("TRIBE_PROCESS_TYPE", "hierarchical")
        }
        
    @classmethod
    def get_instance(cls) -> 'Config':
        """Get or create the singleton configuration instance."""
        if not hasattr(cls, '_instance'):
            cls._instance = cls()
        return cls._instance

# Create a singleton instance
config = Config.get_instance() 