"""
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
