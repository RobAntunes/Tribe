"""VS Code extension entry point for Tribe."""
import os
import json
import asyncio
import requests
import uuid
import logging
import difflib
from pygls.server import LanguageServer
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

class TribeLanguageServer(LanguageServer):
    def __init__(self):
        super().__init__()
        self.workspace_path = None
        self.ai_api_endpoint = os.getenv("AI_API_ENDPOINT", "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/")
        if not self.ai_api_endpoint:
            self.ai_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"

tribe_server = TribeLanguageServer()

@tribe_server.command('tribe.initialize')
def initialize_tribe(ls: TribeLanguageServer, workspace_path: str) -> None:
    """Initialize Tribe with the workspace path."""
    ls.workspace_path = workspace_path

@tribe_server.command('tribe.createTeam')
async def create_team(ls: TribeLanguageServer, payload: dict) -> dict:
    """Create a new team using the DynamicAgent through Tribe."""
    try:
        from tribe import Tribe
        
        # Initialize Tribe with minimal configuration
        tribe = await Tribe.create(config={
            'api_endpoint': ls.ai_api_endpoint
        })
        
        # Get the team structure from the initialized crew
        result = {
            "team": {
                "id": str(uuid.uuid4()),
                "description": "Initial Tribe Team",
                "agents": [
                    {
                        "id": str(uuid.uuid4()),
                        "role": agent.role,
                        "status": "active"
                    }
                    for agent in tribe.crew.get_active_agents()
                ]
            }
        }
        
        return result
        
    except Exception as e:
        logging.error(f"Error creating team: {str(e)}")
        return {"error": f"Error creating team: {str(e)}"}

@tribe_server.command('tribe.initializeProject')
def initialize_project(ls: TribeLanguageServer, payload: dict) -> dict:
    """Initialize a project with the created team data."""
    try:
        response = requests.post(
            ls.ai_api_endpoint,
            json={
                "messages": [
                    {
                        "role": "system",
                        "content": "You are the VP of Engineering, responsible for analyzing project requirements and creating the optimal team of AI agents, describing the initial set of tools, assigning tasks to the team, and creating initial workflow."
                    },
                    {
                        "role": "user",
                        "content": payload.get("description", "")
                    }
                ]
            }
        )
        data = response.json()
        return {
            "id": str(int(asyncio.get_event_loop().time() * 1000)),
            "vision": payload.get("description", ""),
            "response": data.get("choices", [{}])[0].get("message", {}).get("content", "")
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.createAgent')
def create_agent(ls: TribeLanguageServer, spec: dict) -> dict:
    """Create a new agent."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/agent/create",
            json={
                "name": spec.get("name"),
                "role": spec.get("role"),
                "backstory": spec.get("backstory")
            }
        )
        data = response.json()
        return data.get("agent") or {
            "id": "",
            "name": spec.get("name"),
            "role": spec.get("role"),
            "status": "error",
            "backstory": spec.get("backstory")
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.getAgents')
def get_agents(ls: TribeLanguageServer) -> list:
    """Get all agents for current project."""
    try:
        response = requests.get(f"{ls.ai_api_endpoint}/agents")
        data = response.json()
        return data.get("agents", [])
    except Exception as e:
        return []

@tribe_server.command('tribe.sendAgentMessage')
async def send_agent_message(ls: TribeLanguageServer, payload: dict) -> dict:
    """Send a message to a specific agent."""
    try:
        logging.info(f"Sending message to agent. Payload: {json.dumps(payload)}")
        
        # Determine if this is a self-referential query
        is_self_referential = any(keyword in payload.get("message", "").lower() 
                                for keyword in ["your role", "your capabilities", "what can you do", "who are you",
                                              "access", "system", "learning", "project management"])
        
        # Get agent's role context
        agent_id = payload.get("agentId")
        agent = ls.get_agent(agent_id)
        role_context = agent.get_role_context() if agent else {}
        
        # If this is a system access query, verify current access status using tools
        if is_self_referential and agent:
            # Get access status using the agent's tools
            access_status = {}
            for system in ["learning_system", "project_management", "collaboration_tools"]:
                access_status[system] = await agent.verify_system_access(system)
            role_context["system_access_status"] = access_status
        
        # Format the request with the correct Lambda message structure
        request_payload = {
            "messages": [
                {
                    "role": "system",
                    "content": f"""You are an AI agent with the role of {payload.get('agentId')}. 
                    Your responses should be based on your actual system access and capabilities.
                    You have access to the following tools:
                    {', '.join(tool.name for tool in agent.tools) if agent else 'No tools available'}
                    
                    When discussing system access, only claim access to systems that are verified through your tools."""
                },
                {
                    "role": "user",
                    "content": payload.get("message")
                }
            ],
            "roleContext": role_context,
            "isSelfReferential": is_self_referential
        }
        
        # If self-referential, use specialized handling
        if is_self_referential and agent:
            response_content = await agent.handle_self_referential_query(payload.get("message"))
        else:
            response = requests.post(
                ls.ai_api_endpoint,
                json=request_payload
            )
            if not response.ok:
                logging.error(f"API request failed: {response.status_code}")
                return {
                    "type": "ERROR",
                    "payload": f"API request failed: {response.status_code}"
                }
            response_content = response.text.strip('"')
            
        message_response = {
            "type": "MESSAGE_RESPONSE",
            "payload": {
                "id": str(uuid.uuid4()),
                "sender": payload.get("agentId", "Unknown Agent"),
                "content": response_content,
                "timestamp": datetime.now().isoformat(),
                "type": "agent",
                "targetAgent": payload.get("agentId"),
                "isVPResponse": payload.get("isVPMessage", False),
                "isManagerResponse": payload.get("isTeamMessage", False),
                "isSelfReferential": is_self_referential,
                "systemAccessVerified": True if agent and is_self_referential else False,
                "availableTools": [tool.name for tool in agent.tools] if agent else []
            }
        }
        
        logging.info(f"Sending message response: {json.dumps(message_response)}")
        return message_response
        
    except requests.RequestException as e:
        error_msg = f"Network error while sending message: {str(e)}"
        logging.error(error_msg)
        return {"type": "ERROR", "payload": error_msg}
    except Exception as e:
        error_msg = f"Unexpected error while sending message: {str(e)}"
        logging.error(error_msg)
        return {"type": "ERROR", "payload": error_msg}

@tribe_server.command('tribe.sendCrewMessage')
def send_crew_message(ls: TribeLanguageServer, payload: dict) -> dict:
    """Send a message to the entire team."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/team/message",
            json={"message": payload.get("message")}
        )
        data = response.json()
        if "error" in data:
            return {"error": data["error"]}
        
        # Process responses from all agents
        messages = []
        for agent_response in data.get("responses", []):
            messages.append({
                "id": str(uuid.uuid4()),
                "sender": agent_response.get("agentId", "Unknown Agent"),
                "content": agent_response.get("response", "No response"),
                "timestamp": agent_response.get("timestamp", datetime.now().isoformat()),
                "type": "agent"
            })
        
        return {
            "type": "MESSAGE_RESPONSE",
            "payload": messages
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.analyzeRequirements')
def analyze_requirements(ls: TribeLanguageServer, payload: dict) -> str:
    """Analyze requirements and create/update agents."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/requirements/analyze",
            json={
                "requirements": payload.get("requirements")
            }
        )
        data = response.json()
        return data.get("analysis") or f"Analysis failed for requirements:\n{payload.get('requirements')}\n\nPlease try again with more detailed requirements."
    except Exception as e:
        return str(e)

@tribe_server.command('tribe.createTask')
def create_task(ls: TribeLanguageServer, payload: dict) -> dict:
    """Create a new task."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/task/create",
            json={
                "type": "create_task",
                "description": payload.get("description"),
                "assigned_to": payload.get("assignedTo"),
                "name": payload.get("name")
            }
        )
        data = response.json()
        return data.get("task") or {
            "id": "",
            "name": payload.get("name"),
            "status": "error",
            "assignedTo": payload.get("assignedTo"),
            "description": payload.get("description")
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.recordFeedback')
def record_feedback(ls: TribeLanguageServer, payload: dict) -> dict:
    """Record agent feedback."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/feedback/record",
            json={
                "type": "record_feedback",
                "agent_id": payload.get("agentId"),
                "action_type": payload.get("actionType"),
                "feedback": payload.get("feedback"),
                "context": payload.get("context"),
                "accepted": payload.get("accepted")
            }
        )
        data = response.json()
        return {"result": data} or {
            "status": "error",
            "message": "Failed to record feedback"
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.setAutonomyLevel')
def set_autonomy_level(ls: TribeLanguageServer, payload: dict) -> dict:
    """Set agent autonomy level."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/autonomy/set",
            json={
                "type": "set_autonomy",
                "agent_id": payload.get("agentId"),
                "task_type": payload.get("taskType"),
                "autonomy_level": payload.get("autonomyLevel"),
                "supervision_requirements": payload.get("supervisionRequirements")
            }
        )
        data = response.json()
        return {"result": data} or {
            "status": "error",
            "message": "Failed to set autonomy level",
            "agent_id": payload.get("agentId"),
            "autonomy_level": payload.get("autonomyLevel")
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.analyzeFlows')
def analyze_flows(ls: TribeLanguageServer) -> dict:
    """Analyze workflow flows."""
    try:
        response = requests.get(f"{ls.ai_api_endpoint}/flows/analyze")
        data = response.json()
        return {"suggestions": data.get("suggestions", [])} or {
            "suggestions": [],
            "status": "error",
            "message": "Failed to analyze flows"
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.generateFlow')
def generate_flow(ls: TribeLanguageServer, payload: dict) -> dict:
    """Generate new workflow flow."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/flow/generate",
            json={
                "requirements": payload.get("requirements"),
                "context": payload.get("context")
            }
        )
        data = response.json()
        flow_id = data.get("flow_id")
        steps = data.get("steps", [])
        return {
            "flow_id": flow_id,
            "steps": steps,
            "requirements": payload.get("requirements"),
            "context": payload.get("context")
        } or {
            "flow_id": "",
            "steps": [],
            "requirements": payload.get("requirements"),
            "context": payload.get("context"),
            "status": "error",
            "message": "Failed to generate flow"
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.executeFlow')
def execute_flow(ls: TribeLanguageServer, payload: dict) -> dict:
    """Execute workflow flow."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/flow/execute",
            json={
                "flow_id": payload.get("flowId"),
                "initial_state": payload.get("initialState")
            }
        )
        data = response.json()
        return {
            "result": data.get("result"),
            "state": data.get("state", {}),
            "visualizations": data.get("visualizations", []),
            "proposed_changes": {
                "files_to_modify": data.get("files_to_modify", []),
                "files_to_create": data.get("files_to_create", []),
                "files_to_delete": data.get("files_to_delete", [])
            }
        } or {
            "result": None,
            "state": payload.get("initialState"),
            "visualizations": [],
            "proposed_changes": {
                "files_to_modify": [],
                "files_to_create": [],
                "files_to_delete": []
            },
            "status": "error",
            "message": "Failed to execute flow"
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.createWorkflow')
def create_workflow(ls: TribeLanguageServer, payload: dict) -> dict:
    """Create new workflow."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/workflow/create",
            json={
                "name": payload.get("name"),
                "description": payload.get("description"),
                "steps": payload.get("steps"),
                "checkpoints": payload.get("checkpoints"),
                "required_approvals": payload.get("requiredApprovals")
            }
        )
        data = response.json()
        return {"workflow": data} or {
            "id": "",
            "name": payload.get("name"),
            "description": payload.get("description"),
            "steps": payload.get("steps"),
            "checkpoints": payload.get("checkpoints"),
            "required_approvals": payload.get("requiredApprovals"),
            "status": "error",
            "message": "Failed to create workflow"
        }
    except Exception as e:
        return {"error": str(e)}

@tribe_server.command('tribe.generateCode')
def generate_code(ls: TribeLanguageServer, payload: dict) -> str:
    """Generate code based on requirements."""
    try:
        response = requests.post(
            f"{ls.ai_api_endpoint}/code/generate",
            json={
                "task_type": "code_generation",
                "requirements": payload.get("requirements"),
                "language": payload.get("language"),
                "framework": payload.get("framework", ""),
                "output_file": payload.get("outputFile")
            }
        )
        data = response.json()
        if data.get("result") and data["result"].get("code"):
            return data["result"]["code"]
        return f"// Failed to generate code for requirements:\n// {payload.get('requirements')}\n// Language: {payload.get('language')}\n// Framework: {payload.get('framework', 'none')}"
    except Exception as e:
        return str(e)

# Enhanced diff and code management commands

@tribe_server.command('tribe.calculateDetailedDiff')
def calculate_detailed_diff(ls: TribeLanguageServer, payload: dict) -> dict:
    """Calculate a detailed diff between two content versions using Myers diff algorithm."""
    try:
        old_content = payload.get("oldContent", "")
        new_content = payload.get("newContent", "")
        file_path = payload.get("filePath", "")
        
        # Split content into lines
        old_lines = old_content.splitlines()
        new_lines = new_content.splitlines()
        
        # Use Python's difflib for diff calculation (similar to Myers algorithm)
        differ = difflib.SequenceMatcher(None, old_lines, new_lines)
        
        # Generate hunks from the diff
        hunks = []
        for tag, i1, i2, j1, j2 in differ.get_opcodes():
            if tag != 'equal':
                hunk = {
                    "startLine": i1 + 1,  # Convert to 1-indexed
                    "endLine": i2,
                    "content": "\n".join(new_lines[j1:j2]),
                    "originalContent": "\n".join(old_lines[i1:i2]),
                    "semanticGroup": "default"  # Default group, would be enhanced in a real implementation
                }
                hunks.append(hunk)
        
        # Create file change object
        file_change = {
            "path": file_path,
            "content": new_content,
            "originalContent": old_content,
            "timestamp": datetime.now().isoformat(),
            "hunks": hunks
        }
        
        return {
            "fileChange": file_change,
            "success": True
        }
    except Exception as e:
        logging.error(f"Error calculating detailed diff: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.detectConflicts')
def detect_conflicts(ls: TribeLanguageServer, payload: dict) -> dict:
    """Detect conflicts in changes from multiple agents."""
    try:
        changes = payload.get("changes", [])
        conflicts = []
        
        # Group changes by file path
        file_changes = {}
        
        # Collect all file modifications
        for change in changes:
            agent_id = change.get("agentId", "unknown")
            agent_name = change.get("agentName", "Unknown Agent")
            
            for file in change.get("files", {}).get("modify", []):
                path = file.get("path", "")
                if not path:
                    continue
                    
                if path not in file_changes:
                    file_changes[path] = []
                
                file_changes[path].append({
                    "agentId": agent_id,
                    "agentName": agent_name,
                    "content": file.get("content", ""),
                    "originalContent": file.get("originalContent", "")
                })
        
        # Detect conflicts in file modifications
        for file_path, changes in file_changes.items():
            if len(changes) > 1:
                # Check if the changes are identical
                first_content = changes[0].get("content", "")
                has_conflict = any(change.get("content", "") != first_content for change in changes)
                
                if has_conflict:
                    # Create a conflict
                    conflict_id = f"conflict-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:8]}"
                    conflicting_changes = {}
                    
                    for change in changes:
                        agent_id = change.get("agentId", "unknown")
                        if agent_id not in conflicting_changes:
                            conflicting_changes[agent_id] = []
                        
                        conflicting_changes[agent_id].append({
                            "path": file_path,
                            "content": change.get("content", ""),
                            "originalContent": change.get("originalContent", ""),
                            "timestamp": datetime.now().isoformat()
                        })
                    
                    conflict = {
                        "id": conflict_id,
                        "type": "merge",
                        "description": f"Multiple agents modified {file_path}",
                        "status": "pending",
                        "files": [file_path],
                        "conflictingChanges": conflicting_changes
                    }
                    
                    conflicts.append(conflict)
                    
                    # In a real implementation, we would save the conflict to storage here
        
        return {
            "conflicts": conflicts,
            "success": True
        }
    except Exception as e:
        logging.error(f"Error detecting conflicts: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.resolveConflict')
def resolve_conflict(ls: TribeLanguageServer, payload: dict) -> dict:
    """Resolve a conflict either automatically or manually."""
    try:
        conflict_id = payload.get("conflictId", "")
        resolution = payload.get("resolution", "auto")
        manual_resolution = payload.get("manualResolution", [])
        
        if not conflict_id:
            return {
                "error": "Missing conflict ID",
                "success": False
            }
        
        # In a real implementation, we would retrieve the conflict from storage
        # For this example, we'll simulate the resolution
        
        if resolution == "auto":
            # Simulate automatic conflict resolution
            # In a real implementation, we would use a more sophisticated algorithm
            resolved_changes = []
            
            # For demonstration purposes, we'll just return a success response
            return {
                "resolvedChanges": resolved_changes,
                "success": True
            }
        elif resolution == "manual" and manual_resolution:
            # Apply the manual resolution
            resolved_changes = []
            
            for file in manual_resolution:
                resolved_changes.append({
                    "path": file.get("path", ""),
                    "content": file.get("content", ""),
                    "timestamp": datetime.now().isoformat()
                })
            
            return {
                "resolvedChanges": resolved_changes,
                "success": True
            }
        else:
            return {
                "error": "Invalid resolution strategy or missing manual resolution",
                "success": False
            }
    except Exception as e:
        logging.error(f"Error resolving conflict: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.createCheckpoint')
def create_checkpoint(ls: TribeLanguageServer, payload: dict) -> dict:
    """Create a checkpoint of the current workspace state."""
    try:
        description = payload.get("description", "Checkpoint")
        change_groups = payload.get("changeGroups", [])
        
        # In a real implementation, we would create a snapshot of the workspace
        # For this example, we'll simulate the checkpoint creation
        
        checkpoint_id = f"checkpoint-{int(datetime.now().timestamp())}"
        checkpoint = {
            "id": checkpoint_id,
            "timestamp": datetime.now().isoformat(),
            "description": description,
            "changes": {
                "modified": 0,
                "created": 0,
                "deleted": 0
            },
            "snapshotPath": f"/tmp/{checkpoint_id}.json",
            "changeGroups": change_groups
        }
        
        return {
            "checkpoint": checkpoint,
            "success": True
        }
    except Exception as e:
        logging.error(f"Error creating checkpoint: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.createSubCheckpoint')
def create_sub_checkpoint(ls: TribeLanguageServer, payload: dict) -> dict:
    """Create a sub-checkpoint within a parent checkpoint."""
    try:
        parent_checkpoint_id = payload.get("parentCheckpointId", "")
        description = payload.get("description", "Sub-checkpoint")
        changes = payload.get("changes", {})
        
        if not parent_checkpoint_id:
            return {
                "error": "Missing parent checkpoint ID",
                "success": False
            }
        
        # In a real implementation, we would verify the parent checkpoint exists
        # and create the sub-checkpoint
        
        sub_checkpoint = {
            "id": f"sub-{int(datetime.now().timestamp())}",
            "timestamp": datetime.now().isoformat(),
            "description": description,
            "parentCheckpointId": parent_checkpoint_id,
            "changes": changes
        }
        
        return {
            "subCheckpoint": sub_checkpoint,
            "success": True
        }
    except Exception as e:
        logging.error(f"Error creating sub-checkpoint: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.revertToSubCheckpoint')
def revert_to_sub_checkpoint(ls: TribeLanguageServer, payload: dict) -> dict:
    """Revert to a specific sub-checkpoint."""
    try:
        parent_checkpoint_id = payload.get("parentCheckpointId", "")
        sub_checkpoint_id = payload.get("subCheckpointId", "")
        
        if not parent_checkpoint_id or not sub_checkpoint_id:
            return {
                "error": "Missing parent checkpoint ID or sub-checkpoint ID",
                "success": False
            }
        
        # In a real implementation, we would retrieve the sub-checkpoint
        # and apply the changes to revert to that state
        
        return {
            "success": True
        }
    except Exception as e:
        logging.error(f"Error reverting to sub-checkpoint: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.getChangeHistory')
def get_change_history(ls: TribeLanguageServer) -> dict:
    """Get the change history."""
    try:
        # In a real implementation, we would retrieve the change history from storage
        # For this example, we'll return an empty history
        
        return {
            "history": [],
            "success": True
        }
    except Exception as e:
        logging.error(f"Error getting change history: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }

@tribe_server.command('tribe.groupChangesByFeature')
def group_changes_by_feature(ls: TribeLanguageServer, payload: dict) -> dict:
    """Group file changes by semantic features."""
    try:
        file_changes = payload.get("fileChanges", [])
        
        # Group by file extension as a simple heuristic
        grouped_changes = {}
        
        for change in file_changes:
            path = change.get("path", "")
            if not path:
                continue
                
            # Extract file extension
            _, ext = os.path.splitext(path)
            ext = ext[1:] if ext else "other"  # Remove the dot
            
            if ext not in grouped_changes:
                grouped_changes[ext] = []
                
            grouped_changes[ext].append(change)
        
        # If we have hunks with semantic groups, use those for more detailed grouping
        semantic_groups = {}
        
        for change in file_changes:
            hunks = change.get("hunks", [])
            for hunk in hunks:
                semantic_group = hunk.get("semanticGroup")
                if semantic_group:
                    if semantic_group not in semantic_groups:
                        semantic_groups[semantic_group] = []
                    
                    # Check if we already have this file change in this group
                    path = change.get("path", "")
                    existing_change = next((c for c in semantic_groups[semantic_group] if c.get("path") == path), None)
                    
                    if existing_change:
                        # Add the hunk to the existing change
                        if "hunks" not in existing_change:
                            existing_change["hunks"] = []
                        existing_change["hunks"].append(hunk)
                    else:
                        # Create a new file change with just this hunk
                        semantic_groups[semantic_group].append({
                            "path": path,
                            "content": change.get("content", ""),
                            "originalContent": change.get("originalContent", ""),
                            "hunks": [hunk]
                        })
        
        # Merge the extension-based groups and semantic groups
        result = {**grouped_changes, **semantic_groups}
        
        # If we have no groups, add an "Uncategorized" group with all changes
        if not result:
            result["Uncategorized"] = file_changes
        
        return {
            "groupedChanges": result,
            "success": True
        }
    except Exception as e:
        logging.error(f"Error grouping changes by feature: {str(e)}")
        return {
            "error": str(e),
            "success": False
        }
