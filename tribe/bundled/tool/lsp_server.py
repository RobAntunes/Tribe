"""LSP server implementation for Tribe."""

import os
import logging
from typing import Optional

# Set up logging
logger = logging.getLogger(__name__)

class TribeLSPServer:
    """LSP server for Tribe."""

    def __init__(self):
        """Initialize the LSP server."""
        # Use default model for CrewAI's LLM
        self.model = os.environ.get("TRIBE_MODEL", "anthropic/claude-3-7-sonnet-20250219")

    # ... existing code ... 