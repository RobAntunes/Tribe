#!/usr/bin/env python3
"""
Script to fix the Tribe extension by creating the necessary files
"""

import os
import sys
import shutil
from pathlib import Path

def create_directory(path):
    """Create a directory if it doesn't exist"""
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"Created directory: {path}")
    else:
        print(f"Directory already exists: {path}")

def create_file(path, content):
    """Create a file with the given content"""
    with open(path, 'w') as f:
        f.write(content)
    print(f"Created file: {path}")

def main():
    """Main function"""
    # Get the extension root directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    extension_root = os.path.dirname(os.path.dirname(script_dir))
    print(f"Extension root: {extension_root}")
    
    # Create the necessary directories
    tribe_dir = os.path.join(extension_root, "tribe")
    src_dir = os.path.join(tribe_dir, "src")
    python_dir = os.path.join(src_dir, "python")
    tools_dir = os.path.join(python_dir, "tools")
    
    create_directory(tribe_dir)
    create_directory(src_dir)
    create_directory(python_dir)
    create_directory(tools_dir)
    
    # Create the necessary files
    create_file(os.path.join(tribe_dir, "__init__.py"), '''"""
Tribe extension for VS Code
"""

__version__ = "0.1.0"
''')
    
    create_file(os.path.join(src_dir, "__init__.py"), '''"""
Tribe extension source code
"""
''')
    
    create_file(os.path.join(python_dir, "__init__.py"), '''"""
Python source code for Tribe extension
"""
''')
    
    create_file(os.path.join(tools_dir, "__init__.py"), '''"""
Tools for Tribe extension
"""

# Import modules to make them available when importing the package
from .linting import lint_file
from .formatting import format_file

# Define what's available when using "from tribe.src.python.tools import *"
__all__ = [
    'lint_file',
    'format_file',
]
''')
    
    create_file(os.path.join(tools_dir, "linting.py"), '''"""
Linting functionality for Tribe extension
"""
import re
from typing import List, Dict, Any

def lint_file(content: str) -> List[Dict[str, Any]]:
    """Lint the given file content
    
    Returns a list of diagnostic objects with the following structure:
    {
        "line": int,       # 1-based line number
        "column": int,     # 1-based column number
        "type": str,       # "error", "warning", or "info"
        "message": str,    # The diagnostic message
        "code": str        # A code for the diagnostic
    }
    """
    diagnostics = []
    
    # Split content into lines for analysis
    lines = content.splitlines()
    
    # Check for lines that are too long (> 100 characters)
    for i, line in enumerate(lines):
        if len(line) > 100:
            diagnostics.append({
                "line": i + 1,  # 1-based line number
                "column": 101,  # Position where the line becomes too long
                "type": "warning",
                "message": f"Line too long ({len(line)} > 100 characters)",
                "code": "E501"
            })
    
    # Check for trailing whitespace
    for i, line in enumerate(lines):
        if line and line[-1] == ' ':
            diagnostics.append({
                "line": i + 1,
                "column": len(line),
                "type": "warning",
                "message": "Trailing whitespace",
                "code": "W291"
            })
    
    return diagnostics
''')
    
    create_file(os.path.join(tools_dir, "formatting.py"), '''"""
Formatting functionality for Tribe extension
"""
import re
from typing import List

def format_file(content: str) -> str:
    """Format the given file content
    
    This formatter performs the following operations:
    1. Ensures consistent indentation (4 spaces)
    2. Removes trailing whitespace
    3. Ensures files end with a single newline
    
    Returns:
        The formatted content as a string
    """
    # Split content into lines for processing
    lines = content.splitlines()
    formatted_lines = []
    
    for line in lines:
        # Skip empty lines
        if not line.strip():
            formatted_lines.append("")
            continue
        
        # Remove trailing whitespace
        line = line.rstrip()
        
        # Standardize indentation (convert tabs to 4 spaces)
        indent_level = len(line) - len(line.lstrip())
        if '\t' in line[:indent_level]:
            spaces_indent = line[:indent_level].replace('\t', '    ')
            line = spaces_indent + line[indent_level:]
        
        formatted_lines.append(line)
    
    # Ensure file ends with a single newline
    formatted_content = '\\n'.join(formatted_lines) + '\\n'
    
    return formatted_content
''')
    
    # Also create the same structure in bundled/tool/tribe
    bundled_tribe_dir = os.path.join(script_dir, "tribe")
    bundled_src_dir = os.path.join(bundled_tribe_dir, "src")
    bundled_python_dir = os.path.join(bundled_src_dir, "python")
    bundled_tools_dir = os.path.join(bundled_python_dir, "tools")
    
    create_directory(bundled_tribe_dir)
    create_directory(bundled_src_dir)
    create_directory(bundled_python_dir)
    create_directory(bundled_tools_dir)
    
    # Copy the files to the bundled directory
    shutil.copy(os.path.join(tribe_dir, "__init__.py"), os.path.join(bundled_tribe_dir, "__init__.py"))
    shutil.copy(os.path.join(src_dir, "__init__.py"), os.path.join(bundled_src_dir, "__init__.py"))
    shutil.copy(os.path.join(python_dir, "__init__.py"), os.path.join(bundled_python_dir, "__init__.py"))
    shutil.copy(os.path.join(tools_dir, "__init__.py"), os.path.join(bundled_tools_dir, "__init__.py"))
    shutil.copy(os.path.join(tools_dir, "linting.py"), os.path.join(bundled_tools_dir, "linting.py"))
    shutil.copy(os.path.join(tools_dir, "formatting.py"), os.path.join(bundled_tools_dir, "formatting.py"))
    
    print("Successfully created all necessary files")

if __name__ == "__main__":
    main() 