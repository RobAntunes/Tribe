"""
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
        if '	' in line[:indent_level]:
            spaces_indent = line[:indent_level].replace('	', '    ')
            line = spaces_indent + line[indent_level:]
        
        formatted_lines.append(line)
    
    # Ensure file ends with a single newline
    formatted_content = '\n'.join(formatted_lines) + '\n'
    
    return formatted_content
