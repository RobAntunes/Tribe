# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.
"""Implementation of tool support over LSP."""
from __future__ import annotations

import copy
import json
import os
import pathlib
import re
import sys
import sysconfig
import traceback
import time
from typing import Any, Optional, Sequence, Dict


# **********************************************************
# Update sys.path before importing any bundled libraries.
# **********************************************************
def update_sys_path(path_to_add: str, strategy: str) -> None:
    """Add given path to `sys.path`."""
    if path_to_add not in sys.path and os.path.isdir(path_to_add):
        if strategy == "useBundled":
            sys.path.insert(0, path_to_add)
        elif strategy == "fromEnvironment":
            sys.path.append(path_to_add)


# Ensure that we can import LSP libraries, and other bundled libraries.
update_sys_path(
    os.fspath(pathlib.Path(__file__).parent.parent / "libs"),
    os.getenv("LS_IMPORT_STRATEGY", "useBundled"),
)

# Add extension root (main directory containing the tribe folder)
tribe_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, tribe_path)

# Add the current directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# CRITICAL FIX: Add multiple potential tribe directory locations to sys.path
# This is the root cause - we need to add the tribe directory so we can import from it directly

# Add tribe directory from all possible locations
possible_tribe_paths = [
    os.path.join(tribe_path, 'tribe'),
    os.path.join(os.path.dirname(tribe_path), 'tribe'),
    os.path.join(os.path.dirname(os.path.dirname(tribe_path)), 'tribe'),
    os.path.join(os.path.dirname(current_dir), 'tribe'),
    # Current working directory might be different, so check there too
    os.path.join(os.getcwd(), 'tribe'),
    # Add more paths as needed
]

# Add each path if it exists
found_tribe_module = False
for tribe_module_path in possible_tribe_paths:
    if os.path.exists(tribe_module_path):
        # Add the tribe directory to sys.path
        if tribe_module_path not in sys.path:
            sys.path.insert(0, tribe_module_path)
            print(f"✅ Added tribe module to sys.path: {tribe_module_path}")
            found_tribe_module = True

if not found_tribe_module:
    print(f"❌ ERROR: Could not find tribe module in any of these paths:")
    for path in possible_tribe_paths:
        print(f"  - {path}")

# Also try all parent directories to find the tribe module
for parent_level in range(1, 4):  # Try up to 3 levels up
    parent_dir = tribe_path
    for _ in range(parent_level):
        parent_dir = os.path.dirname(parent_dir)
    
    potential_tribe_path = os.path.join(parent_dir, 'tribe')
    if os.path.exists(potential_tribe_path):
        sys.path.insert(0, potential_tribe_path)
        print(f"Added additional tribe path: {potential_tribe_path}")

# Print out first 10 directories in sys.path to avoid excessive output
print(f"Updated sys.path (first 10 entries): {sys.path[:10]}")
print(f"Current directory: {os.getcwd()}")

# Debug - list key directories to check existence
print(f"Checking key directories:")
for check_path in [
    os.path.join(tribe_path, 'tribe'),
    os.path.join(tribe_path, 'tribe', 'extension.py'),
    os.path.join(current_dir, 'tribe'),
]:
    print(f"  - {check_path}: {'exists' if os.path.exists(check_path) else 'NOT FOUND'}")

# Import tribe modules - with enhanced robustness
print("\n===== ENHANCED MODULE LOADING =====")
print(f"Python version: {sys.version}")
print(f"Current dir: {os.getcwd()}")
print(f"Executable: {sys.executable}")

# Make sure we can find the tribe module before attempting imports
has_tribe_module = False
for module_path in sys.path:
    if os.path.exists(os.path.join(module_path, 'tribe')):
        has_tribe_module = True
        print(f"✅ Found tribe module in: {module_path}")
        break

if not has_tribe_module:
    print("❌ tribe module not found in sys.path, adding more paths")
    # Try to find the tribe module in common locations
    for potential_path in [
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        os.path.join(os.path.expanduser("~"), "Documents", "MightyDev", "extensions", "tribe"),
    ]:
        if os.path.exists(os.path.join(potential_path, 'tribe')):
            print(f"✅ Found tribe module in: {potential_path}")
            sys.path.insert(0, potential_path)
            has_tribe_module = True
            break

# Import tribe modules

# Define variables at global scope first, before trying to assign to them
# These variables will be used by many functions throughout the file
tribe_server = None
_create_team_implementation = None

try:
    # There are two different things happening here:
    # 1. Importing linting/formatting for LSP functionality
    # 2. Importing tribe_server and _create_team_implementation for team creation
    
    # Try all possible import paths for extension module
    possible_extension_imports = [
        ("direct import", "from extension import tribe_server, _create_team_implementation"),
        ("tribe.extension", "from tribe.extension import tribe_server, _create_team_implementation"),
        ("extension module", "import extension; tribe_server = extension.tribe_server; _create_team_implementation = extension._create_team_implementation"),
        ("tribe extension module", "import tribe.extension as extension; tribe_server = extension.tribe_server; _create_team_implementation = extension._create_team_implementation"),
        ("absolute path import", "import importlib.util; spec = importlib.util.spec_from_file_location('extension', [p for p in sys.path if os.path.exists(os.path.join(p, 'tribe', 'extension.py'))][0] + '/tribe/extension.py'); extension = importlib.util.module_from_spec(spec); spec.loader.exec_module(extension); tribe_server = extension.tribe_server; _create_team_implementation = extension._create_team_implementation"),
    ]
    
    success = False
    for import_name, import_statement in possible_extension_imports:
        try:
            print(f"Trying {import_name}")
            exec(import_statement, globals())
            print(f"✅ SUCCESS: {import_name} succeeded")
            success = True
            break
        except Exception as e:
            print(f"❌ {import_name} failed: {str(e)}")
            continue
    
    if not success:
        print("⚠️ All extension import attempts failed, will create fallback implementation")
        
        # Create a minimal fallback implementation
        class TribeLanguageServer:
            def __init__(self):
                self.active_crews = {}
                self.active_agents = {}
                self.workspace_path = None
                self.ai_api_endpoint = os.environ.get("AI_API_ENDPOINT", "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/")
                
            def get_agent(self, agent_id):
                return self.active_agents.get(agent_id)
                
            def get_crew(self, crew_id):
                return self.active_crews.get(crew_id)
        
        # Create a global instance
        tribe_server = TribeLanguageServer()
        
        # Create a fallback implementation function that will be awaited
        async def _create_team_implementation(server, payload):
            print(f"Using fallback team implementation with payload: {payload}")
            return {
                "crew_id": f"fallback-{int(time.time())}",
                "team": {
                    "id": f"fallback-team-{int(time.time())}",
                    "description": payload.get("description", "Unknown project") if isinstance(payload, dict) else str(payload),
                    "agents": [
                        {
                            "id": f"fallback-vp-{int(time.time())}",
                            "name": "Tank",
                            "role": "VP of Engineering",
                            "description": "VP of Engineering in fallback mode",
                            "short_description": "Leads the engineering team in fallback mode",
                            "status": "active",
                            "initialization_complete": True,
                            "tools": []
                        },
                        {
                            "id": f"fallback-dev-{int(time.time())}",
                            "name": "Spark",
                            "role": "Lead Developer",
                            "description": "Lead Developer in fallback mode",
                            "short_description": "Implements core functionality in fallback mode",
                            "status": "active",
                            "initialization_complete": True,
                            "tools": []
                        }
                    ],
                    "vision": payload.get("description", "Fallback implementation")
                }
            }
    
    # Separately try to import linting/formatting for LSP functionality
    linting = formatting = None
    formatting_imports = [
        ("tribe.src.python.tools", "from tribe.src.python.tools import linting, formatting"),
        ("src.python.tools", "from src.python.tools import linting, formatting"),
        ("bundled.tool.tribe.src.python.tools", "from bundled.tool.tribe.src.python.tools import linting, formatting"),
    ]
    
    for import_name, import_statement in formatting_imports:
        try:
            print(f"Trying formatting import: {import_name}")
            exec(import_statement, globals())
            print(f"✅ Successfully imported formatting modules from {import_name}")
            break
        except ImportError as e:
            print(f"❌ Failed to import from {import_name}: {e}")
            continue
    
    # If all imports failed, use built-in implementation
    if 'linting' not in globals() or 'formatting' not in globals() or linting is None or formatting is None:
        print("⚠️ All formatting module imports failed, using built-in implementation")
        
        class linting:
            @staticmethod
            def lint_file(content):
                """Lint the given file content"""
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
        
        class formatting:
            @staticmethod
            def format_file(content):
                """Format the given file content"""
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
                formatted_content = '\n'.join(formatted_lines) + '\n'
                
                return formatted_content

except Exception as e:
    print(f"Error in module import setup: {e}")
    traceback.print_exc()

# Debug logging
print(f"Python executable: {sys.executable}")
print(f"sys.path: {sys.path}")

# **********************************************************
# Imports needed for the language server goes below this.
# **********************************************************
# pylint: disable=wrong-import-position,import-error
import lsp_jsonrpc as jsonrpc
import lsp_utils as utils
import lsprotocol.types as lsp
from pygls import server, uris, workspace

WORKSPACE_SETTINGS = {}
GLOBAL_SETTINGS = {}
RUNNER = pathlib.Path(__file__).parent / "lsp_runner.py"

MAX_WORKERS = 5
# TODO: Update the language server name and version.
LSP_SERVER = server.LanguageServer(
    name="Tribe Python Tools", version="0.1.0", max_workers=MAX_WORKERS
)


# **********************************************************
# Tool specific code goes below this.
# **********************************************************

# Reference:
#  LS Protocol:
#  https://microsoft.github.io/language-server-protocol/specifications/specification-3-16/
#
#  Sample implementations:
#  Pylint: https://github.com/microsoft/vscode-pylint/blob/main/bundled/tool
#  Black: https://github.com/microsoft/vscode-black-formatter/blob/main/bundled/tool
#  isort: https://github.com/microsoft/vscode-isort/blob/main/bundled/tool

# TODO: Update TOOL_MODULE with the module name for your tool.
# e.g, TOOL_MODULE = "pylint"
TOOL_MODULE = "tribe"

# TODO: Update TOOL_DISPLAY with a display name for your tool.
# e.g, TOOL_DISPLAY = "Pylint"
TOOL_DISPLAY = "Tribe Python Tools"

# TODO: Update TOOL_ARGS with default argument you have to pass to your tool in
# all scenarios.
TOOL_ARGS = []  # default arguments always passed to your tool.


# TODO: If your tool is a linter then update this section.
# Delete "Linting features" section if your tool is NOT a linter.
# **********************************************************
# Linting features start here
# **********************************************************

#  See `pylint` implementation for a full featured linter extension:
#  Pylint: https://github.com/microsoft/vscode-pylint/blob/main/bundled/tool


@LSP_SERVER.feature(lsp.TEXT_DOCUMENT_DID_OPEN)
def did_open(params: lsp.DidOpenTextDocumentParams) -> None:
    """LSP handler for textDocument/didOpen request."""
    document = LSP_SERVER.workspace.get_document(params.text_document.uri)
    diagnostics: list[lsp.Diagnostic] = _linting_helper(document)
    LSP_SERVER.publish_diagnostics(document.uri, diagnostics)


@LSP_SERVER.feature(lsp.TEXT_DOCUMENT_DID_SAVE)
def did_save(params: lsp.DidSaveTextDocumentParams) -> None:
    """LSP handler for textDocument/didSave request."""
    document = LSP_SERVER.workspace.get_document(params.text_document.uri)
    diagnostics: list[lsp.Diagnostic] = _linting_helper(document)
    LSP_SERVER.publish_diagnostics(document.uri, diagnostics)


@LSP_SERVER.feature(lsp.TEXT_DOCUMENT_DID_CLOSE)
def did_close(params: lsp.DidCloseTextDocumentParams) -> None:
    """LSP handler for textDocument/didClose request."""
    document = LSP_SERVER.workspace.get_document(params.text_document.uri)
    # Publishing empty diagnostics to clear the entries for this file.
    LSP_SERVER.publish_diagnostics(document.uri, [])


def _linting_helper(document: workspace.Document) -> list[lsp.Diagnostic]:
    # Use our custom linting module directly
    lint_results = linting.lint_file(document.source)
    
    # Convert the lint results to LSP diagnostics
    diagnostics = []
    for result in lint_results:
        position = lsp.Position(
            line=max([int(result["line"]) - 1, 0]),  # Convert to 0-based
            character=int(result["column"]) - 1,     # Convert to 0-based
        )
        diagnostic = lsp.Diagnostic(
            range=lsp.Range(
                start=position,
                end=position,
            ),
            message=result["message"],
            severity=_get_severity(result["code"], result["type"]),
            code=result["code"],
            source=TOOL_DISPLAY,
        )
        diagnostics.append(diagnostic)
    
    return diagnostics


# TODO: If your linter outputs in a known format like JSON, then parse
# accordingly. But incase you need to parse the output using RegEx here
# is a helper you can work with.
# flake8 example:
# If you use following format argument with flake8 you can use the regex below to parse it.
# TOOL_ARGS += ["--format='%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s'"]
# DIAGNOSTIC_RE =
#    r"(?P<line>\d+),(?P<column>-?\d+),(?P<type>\w+),(?P<code>\w+\d+):(?P<message>[^\r\n]*)"
DIAGNOSTIC_RE = re.compile(r"")


def _parse_output_using_regex(content: str) -> list[lsp.Diagnostic]:
    lines: list[str] = content.splitlines()
    diagnostics: list[lsp.Diagnostic] = []

    # TODO: Determine if your linter reports line numbers starting at 1 (True) or 0 (False).
    line_at_1 = True
    # TODO: Determine if your linter reports column numbers starting at 1 (True) or 0 (False).
    column_at_1 = True

    line_offset = 1 if line_at_1 else 0
    col_offset = 1 if column_at_1 else 0
    for line in lines:
        if line.startswith("'") and line.endswith("'"):
            line = line[1:-1]
        match = DIAGNOSTIC_RE.match(line)
        if match:
            data = match.groupdict()
            position = lsp.Position(
                line=max([int(data["line"]) - line_offset, 0]),
                character=int(data["column"]) - col_offset,
            )
            diagnostic = lsp.Diagnostic(
                range=lsp.Range(
                    start=position,
                    end=position,
                ),
                message=data.get("message"),
                severity=_get_severity(data["code"], data["type"]),
                code=data["code"],
                source=TOOL_MODULE,
            )
            diagnostics.append(diagnostic)

    return diagnostics


# TODO: if you want to handle setting specific severity for your linter
# in a user configurable way, then look at look at how it is implemented
# for `pylint` extension from our team.
# Pylint: https://github.com/microsoft/vscode-pylint
# Follow the flow of severity from the settings in package.json to the server.
def _get_severity(code: str, type_str: str) -> lsp.DiagnosticSeverity:
    """Convert the diagnostic type to LSP severity"""
    if type_str == "error":
        return lsp.DiagnosticSeverity.Error
    elif type_str == "warning":
        return lsp.DiagnosticSeverity.Warning
    elif type_str == "info":
        return lsp.DiagnosticSeverity.Information
    else:
        return lsp.DiagnosticSeverity.Hint


# **********************************************************
# Linting features end here
# **********************************************************

# TODO: If your tool is a formatter then update this section.
# Delete "Formatting features" section if your tool is NOT a
# formatter.
# **********************************************************
# Formatting features start here
# **********************************************************
#  Sample implementations:
#  Black: https://github.com/microsoft/vscode-black-formatter/blob/main/bundled/tool


@LSP_SERVER.feature(lsp.TEXT_DOCUMENT_FORMATTING)
def formatting(params: lsp.DocumentFormattingParams) -> list[lsp.TextEdit] | None:
    """LSP handler for textDocument/formatting request."""
    # If your tool is a formatter you can use this handler to provide
    # formatting support on save. You have to return an array of lsp.TextEdit
    # objects, to provide your formatted results.

    document = LSP_SERVER.workspace.get_document(params.text_document.uri)
    edits = _formatting_helper(document)
    if edits:
        return edits

    # NOTE: If you provide [] array, VS Code will clear the file of all contents.
    # To indicate no changes to file return None.
    return None


def _formatting_helper(document: workspace.Document) -> list[lsp.TextEdit] | None:
    # Use our custom formatting module directly
    formatted_content = formatting.format_file(document.source)
    
    # Only return edits if the content has changed
    if formatted_content != document.source:
        new_source = _match_line_endings(document, formatted_content)
        return [
            lsp.TextEdit(
                range=lsp.Range(
                    start=lsp.Position(line=0, character=0),
                    end=lsp.Position(line=len(document.lines), character=0),
                ),
                new_text=new_source,
            )
        ]
    return None


def _get_line_endings(lines: list[str]) -> str:
    """Returns line endings used in the text."""
    try:
        if lines[0][-2:] == "\r\n":
            return "\r\n"
        return "\n"
    except Exception:  # pylint: disable=broad-except
        return None


def _match_line_endings(document: workspace.Document, text: str) -> str:
    """Ensures that the edited text line endings matches the document line endings."""
    expected = _get_line_endings(document.source.splitlines(keepends=True))
    actual = _get_line_endings(text.splitlines(keepends=True))
    if actual == expected or actual is None or expected is None:
        return text
    return text.replace(actual, expected)


# **********************************************************
# Formatting features ends here
# **********************************************************


# Special import handling for tribe modules using the actual path structure
# Note: We already defined these at the top of the file
# Do not redefine them here to avoid SyntaxError

try:
    import os
    import sys
    import importlib.util
    from importlib import import_module
    
    print("=== EXTENSIVE DEBUGGING FOR MODULE IMPORTS ===")
    print(f"Current working directory: {os.getcwd()}")
    print(f"__file__: {__file__}")
    print(f"tribe_path: {tribe_path}")
    
    # Create a list of all possible tribe.extension locations
    possible_paths = [
        os.path.join(tribe_path, 'tribe', 'extension.py'),
        os.path.join(os.path.dirname(tribe_path), 'tribe', 'extension.py'),
        os.path.join(os.path.dirname(os.path.dirname(tribe_path)), 'tribe', 'extension.py')
    ]
    
    print(f"Searching for tribe extension module in these locations:")
    for p in possible_paths:
        exists = os.path.exists(p)
        print(f"  - {p}: {'EXISTS' if exists else 'NOT FOUND'}")
    
    # First try normal import paths
    try:
        # Add more paths to sys.path
        for path in [
            os.path.join(tribe_path, 'tribe'),
            os.path.dirname(tribe_path),
            os.path.dirname(os.path.dirname(tribe_path))
        ]:
            if path not in sys.path and os.path.exists(path):
                sys.path.insert(0, path)
                print(f"Added path to sys.path: {path}")
        
        # Try module imports with all possible combinations
        for module_name in ['tribe.extension', 'extension']:
            try:
                print(f"Trying to import {module_name}")
                module = import_module(module_name)
                print(f"Successfully imported {module_name}")
                
                # Check if the module has the needed components
                if hasattr(module, 'tribe_server') and hasattr(module, '_create_team_implementation'):
                    # Update module variables which are already defined at the top level
                    tribe_server = module.tribe_server
                    _create_team_implementation = module._create_team_implementation
                    print(f"✅ Found required components in {module_name}")
                    break
                else:
                    print(f"Module {module_name} exists but doesn't have required components")
            except ImportError as e:
                print(f"Import error: {e}")
                continue
    except Exception as e:
        print(f"Error during module import: {e}")
    
    # If we couldn't import normally, try direct file loading
    if tribe_server is None or _create_team_implementation is None:
        print("Normal imports failed, trying direct file loading")
        
        # Try loading from file
        for extension_path in possible_paths:
            if os.path.exists(extension_path):
                try:
                    print(f"Loading module from {extension_path}")
                    spec = importlib.util.spec_from_file_location("extension_module", extension_path)
                    extension_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(extension_module)
                    
                    if hasattr(extension_module, 'tribe_server') and hasattr(extension_module, '_create_team_implementation'):
                        # Update module variables which are already defined at the top level
                        tribe_server = extension_module.tribe_server
                        _create_team_implementation = extension_module._create_team_implementation
                        print(f"✅ Successfully loaded from file: {extension_path}")
                        break
                    else:
                        print(f"Module exists but doesn't have required components")
                except Exception as e:
                    print(f"Error loading file {extension_path}: {e}")
                    continue
    
    # If still not found, use a simple implementation
    if tribe_server is None or _create_team_implementation is None:
        print("⚠️ Could not find the needed components in any module, creating local implementation")
        
        # Define a minimal TribeLanguageServer class
        class TribeLanguageServer:
            def __init__(self):
                self.active_crews = {}
                self.active_agents = {}
                self.ai_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
        
        # Create a simple tribe_server
        # Update module variables which are already defined at the top level
        tribe_server = TribeLanguageServer()
        
        # Define a minimal _create_team_implementation function - MUST be async
        async def _create_team_implementation_minimal(server, payload):
            print(f"Using minimal implementation with payload: {payload}")
            description = payload.get('description', 'Unknown project') if isinstance(payload, dict) else str(payload)
            return {
                "crew_id": "minimal-crew",
                "team": {
                    "id": "minimal-team",
                    "description": description,
                    "agents": []
                }
            }
        
        # Assign to global
        _create_team_implementation = _create_team_implementation_minimal
        
        print("Created minimal implementation")
    
    # Final check
    if tribe_server is not None and _create_team_implementation is not None:
        print("⭐ Success: We have the required components")
    else:
        print("❌ Failed: Could not get required components")
        
        # Final fallback if something went wrong with setting the globals
        class TribeLanguageServer:
            def __init__(self):
                self.active_crews = {}
                self.active_agents = {}
        
        tribe_server = TribeLanguageServer()
        
        async def _create_team_implementation_fallback(server, payload):
            return {
                "team": {
                    "id": "fallback-team",
                    "description": "Fallback implementation",
                    "agents": []
                }
            }
        
        _create_team_implementation = _create_team_implementation_fallback

except Exception as e:
    import traceback
    print(f"Error during import setup: {e}")
    print(traceback.format_exc())
    
    # Make sure we have fallbacks if everything else fails
    class TribeLanguageServer:
        def __init__(self):
            self.active_crews = {}
            self.active_agents = {}
    
    tribe_server = TribeLanguageServer()
    
    async def _create_team_implementation_fallback(server, payload):
        return {
            "team": {
                "id": "exception-fallback",
                "description": "Error handler fallback",
                "agents": []
            }
        }
    
    _create_team_implementation = _create_team_implementation_fallback

# Register handlers for direct LSP requests from TypeScript
@LSP_SERVER.feature('tribe/createTeam')
async def handle_create_team_request(params: Any) -> Dict[str, Any]:
    """LSP handler for tribe/createTeam request from TypeScript.
    
    This avoids the infinite loop issue by bypassing the VS Code command system
    and directly calling the Python implementation.
    """
    try:
        log_to_output(f"Received direct tribe/createTeam request: {params}")
        
        # Define a minimal implementation for fallback
        async def minimal_create_team(server: Any, p: Any) -> Dict[str, Any]:
            """Simple implementation to handle team creation when imports fail"""
            log_to_output("Using minimal team creation implementation")
            
            description = ""
            if isinstance(p, dict):
                description = p.get("description", "")
            elif hasattr(p, "description"):
                description = getattr(p, "description", "")
            else:
                description = str(p)
                
            return {
                "team": {
                    "id": f"minimal-team-{int(time.time())}",
                    "description": description,
                    "agents": []
                }
            }
        
        # Just make sure params is a simple dictionary for passing to Python
        if not isinstance(params, dict):
            log_to_output(f"Input is not a dictionary: {type(params)}")
            # Create dict from params properties if object-like
            if hasattr(params, 'description'):
                log_to_output("Converting object to dict")
                params = {
                    "description": getattr(params, 'description', ''),
                    "name": getattr(params, 'name', 'Development Team'),
                    "requirements": getattr(params, 'requirements', '')
                }
            else:
                log_to_output("Using simple dict with description only")
                params = {"description": str(params)}
        
        # First try to use the global imported implementation if available
        global tribe_server, _create_team_implementation
        if tribe_server is not None and _create_team_implementation is not None:
            log_to_output("Using pre-imported tribe modules")
            
            try:
                # Create a new server instance
                server_instance = tribe_server.__class__()
                
                # Call the implementation directly
                result = await _create_team_implementation(server_instance, params)
                
                log_to_output(f"Team creation result: {result}")
                return result
            except Exception as e:
                log_error(f"Error using pre-imported modules: {str(e)}")
                # Fall through to other approaches
        
        # Last ditch - use our minimal implementation
        log_to_output("No working tribe modules, using minimal implementation")
        result = await minimal_create_team(None, params)
        log_to_output(f"Minimal implementation result: {result}")
        return result
    except Exception as e:
        import traceback
        log_error(f"Error creating team: {str(e)}\n{traceback.format_exc()}")
        
        # Return formatted error response
        description = ""
        if isinstance(params, dict):
            description = params.get("description", "")
        elif hasattr(params, "description"):
            description = getattr(params, "description", "")
        else:
            description = str(params)
            
        return {
            "error": f"Error creating team: {str(e)}",
            "team": {
                "id": f"team-exception-{int(time.time())}",
                "description": description,
                "agents": []
            }
        }

# **********************************************************
# Required Language Server Initialization and Exit handlers.
# **********************************************************
@LSP_SERVER.feature(lsp.INITIALIZE)
def initialize(params: lsp.InitializeParams) -> None:
    """LSP handler for initialize request."""
    log_to_output(f"CWD Server: {os.getcwd()}")

    paths = "\r\n   ".join(sys.path)
    log_to_output(f"sys.path used to run Server:\r\n   {paths}")

    GLOBAL_SETTINGS.update(**params.initialization_options.get("globalSettings", {}))

    settings = params.initialization_options["settings"]
    _update_workspace_settings(settings)
    log_to_output(
        f"Settings used to run Server:\r\n{json.dumps(settings, indent=4, ensure_ascii=False)}\r\n"
    )
    log_to_output(
        f"Global settings:\r\n{json.dumps(GLOBAL_SETTINGS, indent=4, ensure_ascii=False)}\r\n"
    )


@LSP_SERVER.feature(lsp.EXIT)
def on_exit(_params: Optional[Any] = None) -> None:
    """Handle clean up on exit."""
    jsonrpc.shutdown_json_rpc()


@LSP_SERVER.feature(lsp.SHUTDOWN)
def on_shutdown(_params: Optional[Any] = None) -> None:
    """Handle clean up on shutdown."""
    jsonrpc.shutdown_json_rpc()


def _get_global_defaults():
    return {
        "path": GLOBAL_SETTINGS.get("path", []),
        "interpreter": GLOBAL_SETTINGS.get("interpreter", [sys.executable]),
        "args": GLOBAL_SETTINGS.get("args", []),
        "importStrategy": GLOBAL_SETTINGS.get("importStrategy", "useBundled"),
        "showNotifications": GLOBAL_SETTINGS.get("showNotifications", "off"),
    }


def _update_workspace_settings(settings):
    if not settings:
        key = os.getcwd()
        WORKSPACE_SETTINGS[key] = {
            "cwd": key,
            "workspaceFS": key,
            "workspace": uris.from_fs_path(key),
            **_get_global_defaults(),
        }
        return

    for setting in settings:
        key = uris.to_fs_path(setting["workspace"])
        WORKSPACE_SETTINGS[key] = {
            "cwd": key,
            **setting,
            "workspaceFS": key,
        }


def _get_settings_by_path(file_path: pathlib.Path):
    workspaces = {s["workspaceFS"] for s in WORKSPACE_SETTINGS.values()}

    while file_path != file_path.parent:
        str_file_path = str(file_path)
        if str_file_path in workspaces:
            return WORKSPACE_SETTINGS[str_file_path]
        file_path = file_path.parent

    setting_values = list(WORKSPACE_SETTINGS.values())
    return setting_values[0]


def _get_document_key(document: workspace.Document):
    if WORKSPACE_SETTINGS:
        document_workspace = pathlib.Path(document.path)
        workspaces = {s["workspaceFS"] for s in WORKSPACE_SETTINGS.values()}

        # Find workspace settings for the given file.
        while document_workspace != document_workspace.parent:
            if str(document_workspace) in workspaces:
                return str(document_workspace)
            document_workspace = document_workspace.parent

    return None


def _get_settings_by_document(document: workspace.Document | None):
    if document is None or document.path is None:
        return list(WORKSPACE_SETTINGS.values())[0]

    key = _get_document_key(document)
    if key is None:
        # This is either a non-workspace file or there is no workspace.
        key = os.fspath(pathlib.Path(document.path).parent)
        return {
            "cwd": key,
            "workspaceFS": key,
            "workspace": uris.from_fs_path(key),
            **_get_global_defaults(),
        }

    return WORKSPACE_SETTINGS[str(key)]


# *****************************************************
# Internal execution APIs.
# *****************************************************
def _run_tool_on_document(
    document: workspace.Document,
    use_stdin: bool = False,
    extra_args: Optional[Sequence[str]] = None,
) -> utils.RunResult | None:
    """Runs tool on the given document.

    if use_stdin is true then contents of the document is passed to the
    tool via stdin.
    """
    if extra_args is None:
        extra_args = []
    if str(document.uri).startswith("vscode-notebook-cell"):
        # TODO: Decide on if you want to skip notebook cells.
        # Skip notebook cells
        return None

    if utils.is_stdlib_file(document.path):
        # TODO: Decide on if you want to skip standard library files.
        # Skip standard library python files.
        return None

    # deep copy here to prevent accidentally updating global settings.
    settings = copy.deepcopy(_get_settings_by_document(document))

    code_workspace = settings["workspaceFS"]
    cwd = settings["cwd"]

    use_path = False
    use_rpc = False
    if settings["path"]:
        # 'path' setting takes priority over everything.
        use_path = True
        argv = settings["path"]
    elif settings["interpreter"] and not utils.is_current_interpreter(
        settings["interpreter"][0]
    ):
        # If there is a different interpreter set use JSON-RPC to the subprocess
        # running under that interpreter.
        argv = [TOOL_MODULE]
        use_rpc = True
    else:
        # if the interpreter is same as the interpreter running this
        # process then run as module.
        argv = [TOOL_MODULE]

    argv += TOOL_ARGS + settings["args"] + extra_args

    if use_stdin:
        # TODO: update these to pass the appropriate arguments to provide document contents
        # to tool via stdin.
        # For example, for pylint args for stdin looks like this:
        #     pylint --from-stdin <path>
        # Here `--from-stdin` path is used by pylint to make decisions on the file contents
        # that are being processed. Like, applying exclusion rules.
        # It should look like this when you pass it:
        #     argv += ["--from-stdin", document.path]
        # Read up on how your tool handles contents via stdin. If stdin is not supported use
        # set use_stdin to False, or provide path, what ever is appropriate for your tool.
        argv += []
    else:
        argv += [document.path]

    if use_path:
        # This mode is used when running executables.
        log_to_output(" ".join(argv))
        log_to_output(f"CWD Server: {cwd}")
        result = utils.run_path(
            argv=argv,
            use_stdin=use_stdin,
            cwd=cwd,
            source=document.source.replace("\r\n", "\n"),
        )
        if result.stderr:
            log_to_output(result.stderr)
    elif use_rpc:
        # This mode is used if the interpreter running this server is different from
        # the interpreter used for running this server.
        log_to_output(" ".join(settings["interpreter"] + ["-m"] + argv))
        log_to_output(f"CWD Linter: {cwd}")

        result = jsonrpc.run_over_json_rpc(
            workspace=code_workspace,
            interpreter=settings["interpreter"],
            module=TOOL_MODULE,
            argv=argv,
            use_stdin=use_stdin,
            cwd=cwd,
            source=document.source,
        )
        if result.exception:
            log_error(result.exception)
            result = utils.RunResult(result.stdout, result.stderr)
        elif result.stderr:
            log_to_output(result.stderr)
    else:
        # In this mode the tool is run as a module in the same process as the language server.
        log_to_output(" ".join([sys.executable, "-m"] + argv))
        log_to_output(f"CWD Linter: {cwd}")
        # This is needed to preserve sys.path, in cases where the tool modifies
        # sys.path and that might not work for this scenario next time around.
        with utils.substitute_attr(sys, "path", sys.path[:]):
            try:
                # TODO: `utils.run_module` is equivalent to running `python -m <pytool-module>`.
                # If your tool supports a programmatic API then replace the function below
                # with code for your tool. You can also use `utils.run_api` helper, which
                # handles changing working directories, managing io streams, etc.
                # Also update `_run_tool` function and `utils.run_module` in `lsp_runner.py`.
                result = utils.run_module(
                    module=TOOL_MODULE,
                    argv=argv,
                    use_stdin=use_stdin,
                    cwd=cwd,
                    source=document.source,
                )
            except Exception:
                log_error(traceback.format_exc(chain=True))
                raise
        if result.stderr:
            log_to_output(result.stderr)

    log_to_output(f"{document.uri} :\r\n{result.stdout}")
    return result


def _run_tool(extra_args: Sequence[str]) -> utils.RunResult:
    """Runs tool."""
    # deep copy here to prevent accidentally updating global settings.
    settings = copy.deepcopy(_get_settings_by_document(None))

    code_workspace = settings["workspaceFS"]
    cwd = settings["workspaceFS"]

    use_path = False
    use_rpc = False
    if len(settings["path"]) > 0:
        # 'path' setting takes priority over everything.
        use_path = True
        argv = settings["path"]
    elif len(settings["interpreter"]) > 0 and not utils.is_current_interpreter(
        settings["interpreter"][0]
    ):
        # If there is a different interpreter set use JSON-RPC to the subprocess
        # running under that interpreter.
        argv = [TOOL_MODULE]
        use_rpc = True
    else:
        # if the interpreter is same as the interpreter running this
        # process then run as module.
        argv = [TOOL_MODULE]

    argv += extra_args

    if use_path:
        # This mode is used when running executables.
        log_to_output(" ".join(argv))
        log_to_output(f"CWD Server: {cwd}")
        result = utils.run_path(argv=argv, use_stdin=True, cwd=cwd)
        if result.stderr:
            log_to_output(result.stderr)
    elif use_rpc:
        # This mode is used if the interpreter running this server is different from
        # the interpreter used for running this server.
        log_to_output(" ".join(settings["interpreter"] + ["-m"] + argv))
        log_to_output(f"CWD Linter: {cwd}")
        result = jsonrpc.run_over_json_rpc(
            workspace=code_workspace,
            interpreter=settings["interpreter"],
            module=TOOL_MODULE,
            argv=argv,
            use_stdin=True,
            cwd=cwd,
        )
        if result.exception:
            log_error(result.exception)
            result = utils.RunResult(result.stdout, result.stderr)
        elif result.stderr:
            log_to_output(result.stderr)
    else:
        # In this mode the tool is run as a module in the same process as the language server.
        log_to_output(" ".join([sys.executable, "-m"] + argv))
        log_to_output(f"CWD Linter: {cwd}")
        # This is needed to preserve sys.path, in cases where the tool modifies
        # sys.path and that might not work for this scenario next time around.
        with utils.substitute_attr(sys, "path", sys.path[:]):
            try:
                # TODO: `utils.run_module` is equivalent to running `python -m <pytool-module>`.
                # If your tool supports a programmatic API then replace the function below
                # with code for your tool. You can also use `utils.run_api` helper, which
                # handles changing working directories, managing io streams, etc.
                # Also update `_run_tool_on_document` function and `utils.run_module` in `lsp_runner.py`.
                result = utils.run_module(
                    module=TOOL_MODULE, argv=argv, use_stdin=True, cwd=cwd
                )
            except Exception:
                log_error(traceback.format_exc(chain=True))
                raise
        if result.stderr:
            log_to_output(result.stderr)

    log_to_output(f"\r\n{result.stdout}\r\n")
    return result


# *****************************************************
# Logging and notification.
# *****************************************************
def log_to_output(
    message: str, msg_type: lsp.MessageType = lsp.MessageType.Log
) -> None:
    LSP_SERVER.show_message_log(message, msg_type)


def log_error(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Error)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onError", "onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Error)


def log_warning(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Warning)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["onWarning", "always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Warning)


def log_always(message: str) -> None:
    LSP_SERVER.show_message_log(message, lsp.MessageType.Info)
    if os.getenv("LS_SHOW_NOTIFICATION", "off") in ["always"]:
        LSP_SERVER.show_message(message, lsp.MessageType.Info)


# *****************************************************
# Start the server.
# *****************************************************
if __name__ == "__main__":
    LSP_SERVER.start_io()
