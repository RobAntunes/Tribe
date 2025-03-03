"""Entry point for the Tribe language server."""

import traceback
import sys
import os
import logging

# Configure root logger to ensure we see all logs
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(os.path.expanduser("~/tribe-main.log")),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("tribe.__main__")

def setup_python_path():
    """Ensure all possible import paths are available."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    
    # Add all possible paths
    paths_to_add = [
        current_dir,                              # /path/to/tribe 
        parent_dir,                               # /path/to
        os.path.join(parent_dir, 'tribe'),        # /path/to/tribe
        os.path.join(parent_dir, 'bundled'),      # /path/to/bundled
        os.path.join(parent_dir, 'bundled', 'tool'), # /path/to/bundled/tool
    ]
    
    for p in paths_to_add:
        if p not in sys.path:
            sys.path.insert(0, p)
            logger.debug(f"Added path to sys.path: {p}")
    
    logger.debug(f"Final sys.path: {sys.path}")
    
    # Show where Python is looking for modules
    logger.debug(f"Python executable: {sys.executable}")
    logger.debug(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")

if __name__ == "__main__":
    try:
        logger.debug("Starting Tribe language server entry point...")
        
        # Set up Python path first to ensure imports work
        setup_python_path()
        
        # Try multiple import strategies
        strategies = [
            # Strategy 1: Direct absolute import (most common case)
            lambda: __import__('tribe.server').server.start_server,
            
            # Strategy 2: Relative import
            lambda: __import__('server').start_server,
            
            # Strategy 3: Direct import with sys.path modification
            lambda: __import__('server').start_server,
        ]
        
        # Try each strategy
        for i, strategy in enumerate(strategies):
            try:
                logger.debug(f"Trying import strategy {i+1}...")
                start_server = strategy()
                logger.debug(f"Import strategy {i+1} succeeded")
                
                # Start the server
                logger.debug("Starting Tribe language server...")
                start_server()
                
                # If we get here, the server started successfully
                break
            except ImportError as e:
                logger.warning(f"Import strategy {i+1} failed: {e}")
                
                # Continue to next strategy
                continue
            except Exception as e:
                # For non-import errors, we should stop trying
                logger.error(f"Error in strategy {i+1}: {e}")
                raise
        else:
            # If we exhaust all strategies
            logger.critical("All import strategies failed, last resort direct attempt")
            
            # Last resort direct import
            from tribe.server import start_server
            logger.debug("Direct import succeeded in last resort")
            start_server()
            
    except Exception as e:
        logger.critical(f"Fatal error starting server: {e}")
        logger.critical(traceback.format_exc())
        print(f"ERROR: Failed to start Tribe server: {e}")
        sys.exit(1)