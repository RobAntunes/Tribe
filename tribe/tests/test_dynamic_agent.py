"""
Test script to verify that the DynamicAgent class has the name and short_description fields.
"""

import sys
import os
import logging

# Add the parent directory to the path so we can import the tribe module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tribe.core.dynamic import DynamicAgent

def test_dynamic_agent_fields():
    """Test that the DynamicAgent class has the name and short_description fields."""
    try:
        # Create a DynamicAgent instance
        agent = DynamicAgent(role="Test Agent")
        
        # Check if the name field exists and is initialized
        print(f"Agent name: {agent.name}")
        
        # Check if the short_description field exists and is initialized
        print(f"Agent short_description: {agent.short_description}")
        
        # Test setting the name and short_description fields
        agent.name = "New Name"
        agent.short_description = "New Description"
        
        # Check if the fields were updated
        print(f"Updated agent name: {agent.name}")
        print(f"Updated agent short_description: {agent.short_description}")
        
        print("Test passed: DynamicAgent has name and short_description fields.")
        return True
    except Exception as e:
        print(f"Test failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    # Run the test
    test_dynamic_agent_fields() 