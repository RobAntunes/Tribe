import unittest
import sys
import os

# Add the parent directory to Python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import test modules
from tests.test_autonomous_crew import TestAutonomousCrew

def run_tests():
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestAutonomousCrew)
    
    # Run tests with verbosity
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Return 0 if tests passed, 1 if any failed
    return 0 if result.wasSuccessful() else 1

if __name__ == '__main__':
    sys.exit(run_tests())
