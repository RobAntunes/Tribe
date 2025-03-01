#!/usr/bin/env python3
"""
Debug script to test the Tribe extension's linting and formatting functionality.
"""

import os
import sys
import importlib.util

# Add the extension's root directory to sys.path
extension_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, extension_root)

# Try to import the linting and formatting modules
try:
    # Try different import paths
    import_paths = [
        "tribe.src.python.tools.linting",
        "tribe.src.python.tools.formatting",
        "src.python.tools.linting",
        "src.python.tools.formatting",
        "bundled.tool.tribe.src.python.tools.linting",
        "bundled.tool.tribe.src.python.tools.formatting"
    ]
    
    linting_module = None
    formatting_module = None
    
    for path in import_paths:
        try:
            if "linting" in path and linting_module is None:
                linting_module = importlib.import_module(path)
                print(f"Successfully imported linting module from {path}")
            elif "formatting" in path and formatting_module is None:
                formatting_module = importlib.import_module(path)
                print(f"Successfully imported formatting module from {path}")
        except ImportError as e:
            print(f"Failed to import {path}: {e}")
    
    # Test the linting functionality
    if linting_module:
        print("\nTesting linting functionality:")
        with open("test_extension.py", "r") as f:
            content = f.read()
        
        diagnostics = linting_module.lint_file(content)
        print(f"Found {len(diagnostics)} issues:")
        for diag in diagnostics:
            print(f"Line {diag['line']}, Col {diag['column']}: {diag['message']} ({diag['code']})")
    else:
        print("Linting module could not be imported.")
    
    # Test the formatting functionality
    if formatting_module:
        print("\nTesting formatting functionality:")
        with open("test_extension.py", "r") as f:
            content = f.read()
        
        formatted_content = formatting_module.format_file(content)
        print("Original content length:", len(content))
        print("Formatted content length:", len(formatted_content))
        print("Content changed:", content != formatted_content)
        
        # Write the formatted content to a new file
        with open("test_extension_formatted.py", "w") as f:
            f.write(formatted_content)
        print("Formatted content written to test_extension_formatted.py")
    else:
        print("Formatting module could not be imported.")

except Exception as e:
    print(f"Error during testing: {e}")
    import traceback
    traceback.print_exc()

print("\nDebug information:")
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"sys.path: {sys.path}") 