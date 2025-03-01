#!/usr/bin/env python3
"""
Debug script to test imports for the Tribe extension
"""

import os
import sys
import importlib
import traceback

def print_separator():
    print("\n" + "=" * 80 + "\n")

def check_directory(path):
    """Check if a directory exists and list its contents"""
    print(f"Checking directory: {path}")
    if os.path.exists(path):
        print(f"Directory exists: {path}")
        print("Contents:")
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            if os.path.isdir(item_path):
                print(f"  DIR: {item}")
            else:
                print(f"  FILE: {item}")
    else:
        print(f"Directory does not exist: {path}")

def try_import(module_name):
    """Try to import a module and print the result"""
    print(f"Trying to import: {module_name}")
    try:
        module = importlib.import_module(module_name)
        print(f"Successfully imported {module_name}")
        print(f"Module file: {module.__file__}")
        return True
    except ImportError as e:
        print(f"Failed to import {module_name}: {e}")
        traceback.print_exc()
        return False

# Print current working directory
print(f"Current working directory: {os.getcwd()}")
print_separator()

# Print Python version
print(f"Python version: {sys.version}")
print_separator()

# Print sys.path
print("sys.path:")
for i, path in enumerate(sys.path):
    print(f"{i}: {path}")
print_separator()

# Check key directories
script_dir = os.path.dirname(os.path.abspath(__file__))
print(f"Script directory: {script_dir}")
print_separator()

# Check tribe directory
tribe_dir = os.path.join(script_dir, "tribe")
check_directory(tribe_dir)
print_separator()

# Check tribe/src directory
tribe_src_dir = os.path.join(tribe_dir, "src")
check_directory(tribe_src_dir)
print_separator()

# Check tribe/src/python directory
tribe_python_dir = os.path.join(tribe_src_dir, "python")
check_directory(tribe_python_dir)
print_separator()

# Check tribe/src/python/tools directory
tribe_tools_dir = os.path.join(tribe_python_dir, "tools")
check_directory(tribe_tools_dir)
print_separator()

# Try different import approaches
print("Trying different import approaches:")

# Add script directory to sys.path
sys.path.insert(0, script_dir)
print(f"Added {script_dir} to sys.path")

# Try direct import
try_import("tribe.src.python.tools.linting")
print_separator()

# Try with bundled.tool prefix
try_import("bundled.tool.tribe.src.python.tools.linting")
print_separator()

# Try with just the module name
try_import("linting")
print_separator()

# Try with tribe directory in sys.path
sys.path.insert(0, tribe_dir)
print(f"Added {tribe_dir} to sys.path")
try_import("src.python.tools.linting")
print_separator()

print("Debug complete") 