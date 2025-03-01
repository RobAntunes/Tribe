import os
import sys
import pytest
from unittest.mock import MagicMock

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Mock dependencies
sys.modules['src.python.tools.dynamic_flow_analyzer'] = MagicMock()
sys.modules['src.python.tools.code_analyzer'] = MagicMock()
sys.modules['src.python.tools.requirement_analyzer'] = MagicMock()

# Set asyncio fixture scope
def pytest_configure(config):
    config.option.asyncio_mode = "strict"
    config.option.asyncio_default_fixture_loop_scope = "function"

@pytest.fixture
def mock_flow_analyzer():
    return MagicMock()
