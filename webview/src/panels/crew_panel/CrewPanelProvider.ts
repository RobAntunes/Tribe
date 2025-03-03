/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { getNonce } from '../../utils/getNonce';
import { getUri } from '../../utils/getUri';

// Project-related interfaces for TypeScript
interface ProjectAgent {
    id: string;
    name: string;
    role: string;
    description: string;
    short_description?: string;
    status: string;
    backstory?: string;
    initialization_complete?: boolean;
    tools?: string[];
    autonomy_level?: number;
    supervision_needed?: boolean;
}

interface ProjectTeam {
    id: string;
    description: string;
    name: string;
    agents: ProjectAgent[];
    vision?: string;
    created_at?: string;
}

interface ProjectData {
    id: string;
    name: string;
    description: string;
    initialized: boolean;
    team: ProjectTeam;
    created_at?: string;
    updated_at?: string;
}

// Message types for agent management
interface AgentMessage {
    type: string;
    payload: any;
}

interface Agent {
    id: string;
    name?: string;
    role: string;
    status: string;
    description?: string;
}

interface TeamData {
    id: string;
    description: string;
    vision?: string;
    agents: Agent[];
}

interface TeamResult {
    team?: TeamData;
    project?: {
        team: TeamData;
        id: string;
        name: string;
        description: string;
        initialized: boolean;
    };
}

interface ProjectInitPayload {
    team: TeamData;
    vision: string;
}

interface ProjectInitResult {
    id: string;
    [key: string]: unknown;
}

interface MessageResponse {
    type: string;
    payload: {
        id: string;
        sender: string;
        content: string;
        timestamp: string;
        teamId?: string;
        isVPResponse?: boolean;
        isManagerResponse?: boolean;
        isTeamMessage?: boolean;
        targetAgent?: string;
        isLoading?: boolean;
        isError?: boolean;
    };
}

interface FileChange {
    path: string;
    content: string;
    originalContent?: string;
    explanation?: string;
    hunks?: Array<{
        startLine: number;
        endLine: number;
        content: string;
        originalContent?: string;
    }>;
}

interface ChangeGroup {
    id: string;
    title: string;
    description: string;
    agentId: string;
    agentName: string;
    timestamp: string;
    files: {
        modify: FileChange[];
        create: FileChange[];
        delete: string[];
    };
}

interface Implementation {
    id: string;
    title: string;
    description: string;
    tradeoffs: {
        pros: string[];
        cons: string[];
    };
    files: {
        modify: FileChange[];
        create: FileChange[];
        delete: string[];
    };
}

interface Conflict {
    id: string;
    type: 'merge' | 'dependency' | 'logic' | 'other';
    description: string;
    status: 'pending' | 'resolving' | 'resolved' | 'failed';
    files: string[];
    agentId?: string;
    agentName?: string;
}

interface Annotation {
    id: string;
    content: string;
    author: {
        id: string;
        name: string;
        type: 'human' | 'agent';
    };
    timestamp: string;
    filePath?: string;
    lineStart?: number;
    lineEnd?: number;
    codeSnippet?: string;
    replies: Annotation[];
}

interface Checkpoint {
    id: string;
    timestamp: string;
    description: string;
    changes: {
        modified: number;
        created: number;
        deleted: number;
    };
}

// CrewPanelProvider.ts
export class CrewPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'tribe.crewPanel';
    private _view?: vscode.WebviewView;
    private _currentAgents: Agent[] = [];
    private _changeGroups: ChangeGroup[] = [];
    private _alternativeImplementations: Implementation[] = [];
    private _conflicts: Conflict[] = [];
    private _annotations: Annotation[] = [];
    private _checkpoints: Checkpoint[] = [];
    private _isResolvingConflicts: boolean = false;
    private _currentUser: { id: string; name: string } = { id: 'user', name: 'You' };
    private _agents: Array<{ id: string; name: string }> = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _extensionContext: vscode.ExtensionContext,
    ) {
        // Command is registered in extension.ts, no need to register it here
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'out'),
                vscode.Uri.joinPath(this._extensionUri, 'out', 'webview'),
                vscode.Uri.joinPath(this._extensionUri, 'webview'),
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'media'),
            ],
        };

        // Setup message handler for this webview
        webviewView.webview.onDidReceiveMessage(this._handleMessage.bind(this));

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Load initial state
        this._loadInitialState();
    }

    private async _handleMessage(message: AgentMessage) {
        console.log('Extension received message:', message);
        switch (message.type) {
            case 'RESET_TRIBE':
                await this._resetTribe();
                break;
            case 'CREATE_AGENT':
                await this._createAgent(message.payload);
                break;
            case 'GET_AGENTS':
                await this._getAgents();
                break;
            case 'SEND_MESSAGE':
                await this._sendAgentMessage(message.payload);
                break;
            case 'SEND_AGENT_MESSAGE':
                await this._sendAgentMessage(message.payload);
                break;
            case 'CREATE_TASK':
                await this._createTask(message.payload);
                break;
            case 'ANALYZE_REQUIREMENTS':
                await this._analyzeRequirements(message.payload);
                break;
            case 'createTeam':
                console.log('Handling createTeam message');
                await this._createTeam(message.payload);
                break;
            case 'APPLY_CHANGES':
                await this._applyChanges(message.payload);
                break;
            case 'REJECT_CHANGES':
                await this._rejectChanges(message.payload);
                break;
            case 'acceptGroup':
                await this._acceptGroup(message.payload.groupId);
                break;
            case 'rejectGroup':
                await this._rejectGroup(message.payload.groupId);
                break;
            case 'acceptFile':
                await this._acceptFile(message.payload.groupId, message.payload.filePath, message.payload.fileType);
                break;
            case 'rejectFile':
                await this._rejectFile(message.payload.groupId, message.payload.filePath, message.payload.fileType);
                break;
            case 'modifyChange':
                await this._modifyChange(message.payload.groupId, message.payload.filePath, message.payload.newContent);
                break;
            case 'requestExplanation':
                await this._requestExplanation(message.payload.groupId, message.payload.filePath);
                break;
            case 'selectImplementation':
                await this._selectImplementation(message.payload.implementationId);
                break;
            case 'dismissImplementations':
                this._dismissImplementations();
                break;
            case 'addAnnotation':
                await this._addAnnotation(message.payload.annotation);
                break;
            case 'editAnnotation':
                await this._editAnnotation(message.payload.id, message.payload.content);
                break;
            case 'deleteAnnotation':
                await this._deleteAnnotation(message.payload.id);
                break;
            case 'replyToAnnotation':
                await this._replyToAnnotation(message.payload.parentId, message.payload.reply);
                break;
            case 'restoreCheckpoint':
                await this._restoreCheckpoint(message.payload.checkpointId);
                break;
            case 'deleteCheckpoint':
                await this._deleteCheckpoint(message.payload.checkpointId);
                break;
            case 'viewCheckpointDiff':
                await this._viewCheckpointDiff(message.payload.checkpointId);
                break;
            case 'createCheckpoint':
                await this._createCheckpoint(message.payload.description);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    private async _createAgent(payload: any) {
        try {
            const result = await vscode.commands.executeCommand('tribe.createAgent', payload);
            if (result) {
                this._currentAgents.push(result as Agent);
                this._view?.webview.postMessage({ type: 'AGENT_CREATED', payload: result });
                this._view?.webview.postMessage({ type: 'AGENTS_LOADED', payload: this._currentAgents });
            }
        } catch (error) {
            console.error('Error creating agent:', error);
            this._view?.webview.postMessage({ type: 'ERROR', payload: error });
        }
    }

    private async _getAgents() {
        try {
            const result = await vscode.commands.executeCommand('tribe.getAgents') as any;
            console.log('Get agents result:', result);
            
            // Extract agents from the response - could be array directly or inside agents property
            let agents: Agent[] = [];
            if (Array.isArray(result)) {
                agents = result;
            } else if (result && result.agents && Array.isArray(result.agents)) {
                agents = result.agents;
            }
            
            if (agents.length > 0) {
                console.log('Loaded agents:', agents);
                this._currentAgents = agents;
                
                // Update the UI with the agents
                this._view?.webview.postMessage({ 
                    type: 'AGENTS_LOADED', 
                    payload: agents 
                });
                
                // Also send a project state update to make sure the UI updates
                this._view?.webview.postMessage({
                    type: 'PROJECT_STATE',
                    payload: {
                        agents: agents,
                        activeAgents: agents
                    }
                });
            }
        } catch (error) {
            console.error('Error getting agents:', error);
            // Don't overwrite existing agents on error
        }
    }

    private async _sendAgentMessage(payload: any) {
        try {
            // The command will return immediately with a loading state
            const response = (await vscode.commands.executeCommand(
                'tribe.sendAgentMessage',
                payload,
            )) as MessageResponse;

            // Determine if this is a VP or team message
            const isVPMessage = payload.isVPMessage === true;
            const isTeamMessage = payload.isTeamMessage === true;
            const messageId = Date.now().toString();

            // Send the initial loading state to the webview
            this._view?.webview.postMessage({
                type: 'MESSAGE_UPDATE',
                payload: {
                    ...response.payload,
                    id: messageId,
                    sender: payload.agentId,
                    type: 'agent',
                    targetAgent: payload.agentId,
                    status: 'loading',
                    timestamp: new Date().toISOString(),
                    isVPResponse: isVPMessage,
                    isTeamMessage: isTeamMessage,
                    teamId: isTeamMessage ? 'root' : undefined,
                },
            });
        } catch (error) {
            // Handle any errors that occur during message sending
            this._view?.webview.postMessage({
                type: 'MESSAGE_UPDATE',
                payload: {
                    id: Date.now().toString(),
                    sender: payload.agentId,
                    content: String(error),
                    timestamp: new Date().toISOString(),
                    type: 'agent',
                    targetAgent: payload.agentId,
                    status: 'error',
                    isVPResponse: payload.isVPMessage === true,
                    isTeamMessage: payload.isTeamMessage === true,
                    teamId: payload.isTeamMessage === true ? 'root' : undefined,
                },
            });
        }
    }

    public async _handleMessageUpdate(response: MessageResponse) {
        // Preserve the message properties from the original response
        const isVPResponse = response.payload.isVPResponse;
        const isTeamMessage = response.payload.isTeamMessage;
        const teamId = response.payload.teamId;
        const targetAgent = response.payload.targetAgent;

        // Update the message in the webview with consistent status
        this._view?.webview.postMessage({
            type: 'MESSAGE_UPDATE',
            payload: {
                ...response.payload,
                status: response.payload.isLoading ? 'loading' : response.payload.isError ? 'error' : 'complete',
                // Preserve chain of command properties
                isVPResponse: isVPResponse,
                isTeamMessage: isTeamMessage,
                teamId: teamId || (isTeamMessage ? 'root' : undefined),
                targetAgent: targetAgent,
                // Remove legacy status flags
                isLoading: undefined,
                isError: undefined,
            },
        });
    }
    
    /**
     * Updates message status in the UI
     * @param message Message with status information
     */
    public updateMessageStatus(message: any): void {
        // Forward the message to the webview
        this._view?.webview.postMessage({
            type: 'MESSAGE_UPDATE',
            payload: {
                id: message.id || Date.now().toString(),
                sender: message.agentId || 'system',
                content: message.error || message.content || '',
                timestamp: message.timestamp || new Date().toISOString(),
                status: message.status || 'complete',
                targetAgent: message.agentId,
                error: message.error
            },
        });
    }

    private async _createTask(payload: any) {
        try {
            const task = await vscode.commands.executeCommand('tribe.createTask', payload);
            this._view?.webview.postMessage({ type: 'TASK_CREATED', payload: task });
        } catch (error) {
            this._view?.webview.postMessage({ type: 'ERROR', payload: error });
        }
    }

    private async _createTeam(payload: any) {
        try {
            console.log('Creating team with description:', payload.description);
            
            // Make sure we're passing the full payload to the backend
            // This ensures the Python backend gets all the information it needs
            // to create a team using the foundation model
            const teamSpec = {
                description: payload.description,
                name: payload.name || "Development Team",
                requirements: payload.requirements || payload.description,
                useFallback: false // Never use fallback unless absolutely necessary
            };

            const result = (await vscode.commands.executeCommand('tribe.createTeam', teamSpec)) as TeamResult;

            console.log('Team creation response:', result);
            
            // Support both response formats: either {team: {...}} or {project: {team: {...}}}
            let teamData;
            if (result?.team) {
                // Direct team format
                teamData = result.team;
            } else if (result?.project?.team) {
                // Nested project.team format (from Python server)
                teamData = result.project.team;
            } else {
                throw new Error('Failed to create team: Invalid response format');
            }
            const agents = teamData.agents || [];

            // Update current agents and ensure VP of Engineering is always present
            this._currentAgents = agents;
            
            // Save agents and team to persistence layer
            try {
                console.log('Saving agents and team to persistence layer');
                await vscode.commands.executeCommand('tribe.saveTeamData', {
                    team: teamData,
                    agents: agents
                });
            } catch (err) {
                console.error('Error saving team data:', err);
                // Continue even if saving fails
            }

            // Find if we have a VP of Engineering
            const vpAgent = this._currentAgents.find(agent => 
                agent.role.toLowerCase().includes('vp') || 
                agent.role.toLowerCase().includes('engineering') ||
                (agent.name && agent.name.toLowerCase().includes('vp'))
            );

            // Update the UI with all agents, including the VP if found
            const agentsToDisplay = this._currentAgents.map(agent => ({
                ...agent,
                // Ensure name is always populated (fallback to role if not defined)
                name: agent.name || agent.role,
                // Ensure short descriptions exist
                short_description: agent.description || `${agent.role} agent supporting the project`
            }));

            // Send team creation event
            this._view?.webview.postMessage({
                type: 'teamCreated',
                payload: {
                    id: teamData.id,
                    description: teamData.description,
                    agents: agentsToDisplay,
                    vision: teamData.vision || payload.description,
                    vpAgent: vpAgent
                },
            });

            // Update agents list if we have agents - send multiple message types for redundancy
            if (this._currentAgents.length > 0) {
                console.log('Updating agents list with:', agentsToDisplay);
                
                // Send AGENTS_LOADED for backward compatibility
                this._view?.webview.postMessage({
                    type: 'AGENTS_LOADED',
                    payload: agentsToDisplay,
                });
                
                // Send PROJECT_STATE update with agents
                this._view?.webview.postMessage({
                    type: 'PROJECT_STATE',
                    payload: {
                        agents: agentsToDisplay,
                        activeAgents: agentsToDisplay,
                        initialized: true,
                        current: true
                    },
                });
                
                // Send direct agent update message
                this._view?.webview.postMessage({
                    type: 'AGENT_ROSTER_UPDATED',
                    payload: agentsToDisplay,
                });
            }

            // Initialize project
            console.log('Initializing project with team data');
            const initPayload: ProjectInitPayload = {
                team: teamData,
                vision: teamData.vision || payload.description,
            };
            await this._initializeProject(initPayload);
        } catch (error) {
            console.error('Error creating team:', error);
            this._view?.webview.postMessage({
                type: 'error',
                payload: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async _initializeProject(payload: ProjectInitPayload) {
        try {
            // Try to call the initialization command
            try {
                const result = (await vscode.commands.executeCommand(
                    'tribe.initializeProject',
                    payload,
                )) as ProjectInitResult;
                
                // Send project initialization with current agents to ensure UI has latest state
                const agentsToSend = this._currentAgents.length > 0 ? this._currentAgents : payload.team.agents || [];
                console.log('Project initialized, sending agents:', agentsToSend);
                
                this._view?.webview.postMessage({
                    type: 'PROJECT_INITIALIZED',
                    payload: {
                        ...result,
                        agents: agentsToSend,
                        activeAgents: agentsToSend,
                        team: payload.team,
                        vision: payload.vision,
                        currentPhase: 'Planning'
                    },
                });
            } catch (commandError) {
                // If command is not found, just proceed with UI updates
                console.warn('Could not call initialization command, using fallback:', commandError);
                
                // Generate a project ID
                const projectId = `project-${Date.now()}`;
                
                // Just update the UI directly
                const agentsToSend = this._currentAgents.length > 0 ? this._currentAgents : payload.team.agents || [];
                console.log('Using fallback project initialization, sending agents:', agentsToSend);
                
                this._view?.webview.postMessage({
                    type: 'PROJECT_INITIALIZED',
                    payload: {
                        id: projectId,
                        initialized: true,
                        status: 'active',
                        agents: agentsToSend,
                        activeAgents: agentsToSend,
                        team: payload.team,
                        vision: payload.vision,
                        currentPhase: 'Planning'
                    },
                });
            }
        } catch (error) {
            console.error('Error initializing project:', error);
            this._view?.webview.postMessage({
                type: 'error',
                payload: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async _analyzeRequirements(payload: any) {
        try {
            const result = await vscode.commands.executeCommand('tribe.analyzeRequirements', payload);
            this._view?.webview.postMessage({ type: 'REQUIREMENTS_ANALYZED', payload: result });
        } catch (error) {
            this._view?.webview.postMessage({ type: 'ERROR', payload: error });
        }
    }

    private async _applyChanges(payload: any) {
        try {
            console.log('Applying changes:', payload);

            // Normalize the payload to match the expected format
            const normalizedPayload = {
                filesToModify: payload.filesToModify || [],
                filesToCreate: payload.filesToCreate || [],
                filesToDelete: payload.filesToDelete || [],
            };

            // Call the command to apply changes
            const result = await vscode.commands.executeCommand('tribe.applyChanges', normalizedPayload);

            // Send the result back to the webview
            this._view?.webview.postMessage({
                type: 'CHANGES_APPLIED',
                payload: {
                    success: result,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (error) {
            console.error('Error applying changes:', error);
            this._view?.webview.postMessage({
                type: 'ERROR',
                payload: {
                    message: `Failed to apply changes: ${error}`,
                    context: 'applyChanges',
                },
            });
        }
    }

    private async _rejectChanges(payload: any) {
        console.log('Rejecting changes:', payload);
        // Simply notify the webview that changes were rejected
        this._view?.webview.postMessage({
            type: 'CHANGES_REJECTED',
            payload: {
                timestamp: new Date().toISOString(),
            },
        });
    }

    private async _acceptGroup(groupId: string) {
        await vscode.commands.executeCommand('tribe.acceptChangeGroup', groupId);
        // Remove the group from the list after accepting
        this._changeGroups = this._changeGroups.filter((group) => group.id !== groupId);
        this._updateWebview();
    }

    private async _rejectGroup(groupId: string) {
        await vscode.commands.executeCommand('tribe.rejectChangeGroup', groupId);
        // Remove the group from the list after rejecting
        this._changeGroups = this._changeGroups.filter((group) => group.id !== groupId);
        this._updateWebview();
    }

    private async _acceptFile(groupId: string, filePath: string, fileType: 'modify' | 'create' | 'delete') {
        await vscode.commands.executeCommand('tribe.acceptFile', groupId, filePath, fileType);

        // Update the local state to reflect the accepted file
        const groupIndex = this._changeGroups.findIndex((group) => group.id === groupId);
        if (groupIndex !== -1) {
            const group = this._changeGroups[groupIndex];

            // Remove the file from the appropriate list
            if (fileType === 'modify') {
                group.files.modify = group.files.modify.filter((file) => file.path !== filePath);
            } else if (fileType === 'create') {
                group.files.create = group.files.create.filter((file) => file.path !== filePath);
            } else if (fileType === 'delete') {
                group.files.delete = group.files.delete.filter((path) => path !== filePath);
            }

            // If the group has no more files, remove it
            if (group.files.modify.length === 0 && group.files.create.length === 0 && group.files.delete.length === 0) {
                this._changeGroups.splice(groupIndex, 1);
            }

            this._updateWebview();
        }
    }

    private async _rejectFile(groupId: string, filePath: string, fileType: 'modify' | 'create' | 'delete') {
        await vscode.commands.executeCommand('tribe.rejectFile', groupId, filePath, fileType);

        // Update the local state to reflect the rejected file
        const groupIndex = this._changeGroups.findIndex((group) => group.id === groupId);
        if (groupIndex !== -1) {
            const group = this._changeGroups[groupIndex];

            // Remove the file from the appropriate list
            if (fileType === 'modify') {
                group.files.modify = group.files.modify.filter((file) => file.path !== filePath);
            } else if (fileType === 'create') {
                group.files.create = group.files.create.filter((file) => file.path !== filePath);
            } else if (fileType === 'delete') {
                group.files.delete = group.files.delete.filter((path) => path !== filePath);
            }

            // If the group has no more files, remove it
            if (group.files.modify.length === 0 && group.files.create.length === 0 && group.files.delete.length === 0) {
                this._changeGroups.splice(groupIndex, 1);
            }

            this._updateWebview();
        }
    }

    private async _modifyChange(groupId: string, filePath: string, newContent: string) {
        await vscode.commands.executeCommand('tribe.modifyChange', groupId, filePath, newContent);

        // Update the local state to reflect the modified content
        const groupIndex = this._changeGroups.findIndex((group) => group.id === groupId);
        if (groupIndex !== -1) {
            const group = this._changeGroups[groupIndex];

            // Find and update the file in the appropriate list
            const modifyIndex = group.files.modify.findIndex((file) => file.path === filePath);
            if (modifyIndex !== -1) {
                group.files.modify[modifyIndex].content = newContent;
            }

            const createIndex = group.files.create.findIndex((file) => file.path === filePath);
            if (createIndex !== -1) {
                group.files.create[createIndex].content = newContent;
            }

            this._updateWebview();
        }
    }

    private async _requestExplanation(groupId: string, filePath: string) {
        const explanation = await vscode.commands.executeCommand('tribe.requestExplanation', groupId, filePath);

        // Update the local state with the explanation
        const groupIndex = this._changeGroups.findIndex((group) => group.id === groupId);
        if (groupIndex !== -1 && explanation) {
            const group = this._changeGroups[groupIndex];

            // Find and update the file in the appropriate list
            const modifyIndex = group.files.modify.findIndex((file) => file.path === filePath);
            if (modifyIndex !== -1) {
                group.files.modify[modifyIndex].explanation = String(explanation || '');
            }

            const createIndex = group.files.create.findIndex((file) => file.path === filePath);
            if (createIndex !== -1) {
                group.files.create[createIndex].explanation = String(explanation || '');
            }

            this._updateWebview();
        }
    }

    private async _selectImplementation(implementationId: string) {
        await vscode.commands.executeCommand('tribe.selectImplementation', implementationId);

        // Convert the selected implementation to a change group
        const implementation = this._alternativeImplementations.find((impl) => impl.id === implementationId);
        if (implementation) {
            const newGroup: ChangeGroup = {
                id: implementation.id,
                title: implementation.title,
                description: implementation.description,
                agentId: 'system',
                agentName: 'System',
                timestamp: new Date().toISOString(),
                files: implementation.files,
            };

            this._changeGroups.push(newGroup);
            this._alternativeImplementations = [];
            this._updateWebview();
        }
    }

    private _dismissImplementations() {
        this._alternativeImplementations = [];
        this._updateWebview();
    }

    private async _addAnnotation(annotation: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) {
        const newAnnotation = await vscode.commands.executeCommand('tribe.addAnnotation', annotation);
        if (newAnnotation) {
            this._annotations.push(newAnnotation as Annotation);
            this._updateWebview();
        }
    }

    private async _editAnnotation(id: string, content: string) {
        await vscode.commands.executeCommand('tribe.editAnnotation', id, content);

        // Update the annotation in our local state
        const updateAnnotation = (annotations: Annotation[]) => {
            for (const annotation of annotations) {
                if (annotation.id === id) {
                    annotation.content = content;
                    return true;
                }
                if (annotation.replies.length > 0) {
                    if (updateAnnotation(annotation.replies)) {
                        return true;
                    }
                }
            }
            return false;
        };

        updateAnnotation(this._annotations);
        this._updateWebview();
    }

    private async _deleteAnnotation(id: string) {
        await vscode.commands.executeCommand('tribe.deleteAnnotation', id);

        // Remove the annotation from our local state
        const removeAnnotation = (annotations: Annotation[]) => {
            const index = annotations.findIndex((a) => a.id === id);
            if (index !== -1) {
                annotations.splice(index, 1);
                return true;
            }

            for (const annotation of annotations) {
                if (annotation.replies.length > 0) {
                    if (removeAnnotation(annotation.replies)) {
                        return true;
                    }
                }
            }
            return false;
        };

        removeAnnotation(this._annotations);
        this._updateWebview();
    }

    private async _replyToAnnotation(parentId: string, reply: Omit<Annotation, 'id' | 'timestamp' | 'replies'>) {
        const newReply = await vscode.commands.executeCommand('tribe.replyToAnnotation', parentId, reply);
        if (newReply) {
            // Add the reply to the parent annotation
            const addReply = (annotations: Annotation[]) => {
                for (const annotation of annotations) {
                    if (annotation.id === parentId) {
                        annotation.replies.push(newReply as Annotation);
                        return true;
                    }
                    if (annotation.replies.length > 0) {
                        if (addReply(annotation.replies)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            addReply(this._annotations);
            this._updateWebview();
        }
    }

    private async _restoreCheckpoint(checkpointId: string) {
        await vscode.commands.executeCommand('tribe.restoreCheckpoint', checkpointId);
        // The extension will handle updating the workspace
    }

    private async _deleteCheckpoint(checkpointId: string) {
        await vscode.commands.executeCommand('tribe.deleteCheckpoint', checkpointId);

        // Remove the checkpoint from our local state
        this._checkpoints = this._checkpoints.filter((cp) => cp.id !== checkpointId);
        this._updateWebview();
    }

    private async _viewCheckpointDiff(checkpointId: string) {
        await vscode.commands.executeCommand('tribe.viewCheckpointDiff', checkpointId);
        // The extension will handle showing the diff
    }

    private async _createCheckpoint(description: string) {
        const newCheckpoint = await vscode.commands.executeCommand('tribe.createCheckpoint', description);
        if (newCheckpoint) {
            this._checkpoints.push(newCheckpoint as Checkpoint);
            this._updateWebview();
        }
    }

    private _updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateState',
                payload: {
                    changeGroups: this._changeGroups,
                    alternativeImplementations: this._alternativeImplementations,
                    conflicts: this._conflicts,
                    annotations: this._annotations,
                    checkpoints: this._checkpoints,
                    isResolvingConflicts: this._isResolvingConflicts,
                    currentUser: this._currentUser,
                    agents: this._agents,
                },
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = getUri(webview, this._extensionUri, ['out', 'webview', 'main.js']);
        const styleUri = getUri(webview, this._extensionUri, ['out', 'webview', 'style.css']);
        const nonce = getNonce();

        return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} https://fonts.googleapis.com 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource} https://fonts.googleapis.com https://fonts.gstatic.com; connect-src ${webview.cspSource} https:;">
					<link href="${styleUri}" rel="stylesheet">
					<title>Tribe Crew Panel</title>
				</head>
				<body>
					<div id="root"></div>
					<script nonce="${nonce}">
						// Add debugging code
						window.addEventListener('error', function(event) {
							console.error('JS Error:', event.error);
						});
						
						// Log when the DOM is ready
						document.addEventListener('DOMContentLoaded', function() {
							console.log('DOM fully loaded');
							console.log('Root element exists:', !!document.getElementById('root'));
						});
					</script>
					<script nonce="${nonce}" src="${scriptUri}"></script>
				</body>
			</html>
		`;
    }

    public async _handleLoadingIndicator(response: any): Promise<void> {
        if (!this._view) {
            console.error('Cannot show loading indicator: view is not available');
            return;
        }

        console.log('Showing loading indicator for agent:', response.payload.sender);

        // Send a loading indicator message to the webview
        this._view.webview.postMessage({
            type: 'LOADING_INDICATOR',
            payload: {
                ...response.payload,
                // Ensure we have all required properties
                sender: response.payload.sender,
                targetAgent: response.payload.targetAgent || response.payload.sender,
                isVPResponse: response.payload.isVPResponse || false,
                isTeamMessage: response.payload.isTeamMessage || false,
            },
        });
    }

    public async _hideLoadingIndicator(): Promise<void> {
        if (!this._view) {
            console.error('Cannot hide loading indicator: view is not available');
            return;
        }

        console.log('Hiding loading indicator');

        // Send a message to hide the loading indicator
        this._view.webview.postMessage({
            type: 'HIDE_LOADING_INDICATOR',
        });
    }

    // Add the reset tribe method
    private async _resetTribe() {
        try {
            // Call the extension's reset command
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: "Resetting Tribe...",
                    cancellable: false
                },
                async (progress) => {
                    progress.report({ increment: 0, message: "Deleting Tribe configuration..." });
                    
                    // Call server-side reset command to clean up storage
                    try {
                        const resetResult = await vscode.commands.executeCommand('tribe.resetStorage');
                        progress.report({ increment: 25, message: `Storage reset: ${resetResult ? 'Success' : 'Failed'}` });
                    } catch (err) {
                        console.error("Error calling resetStorage command:", err);
                        // Continue with UI reset even if storage reset fails
                    }
                    
                    // Get workspace folder
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders && workspaceFolders.length > 0) {
                        const workspaceFolder = workspaceFolders[0];
                        const tribeFolderPath = vscode.Uri.joinPath(workspaceFolder.uri, '.tribe');
                        
                        // Delete the .tribe folder if it exists
                        try {
                            await vscode.workspace.fs.delete(tribeFolderPath, { recursive: true });
                            progress.report({ increment: 25, message: "Workspace .tribe folder deleted" });
                        } catch (err) {
                            console.log("No workspace .tribe folder to delete or error deleting:", err);
                        }
                    }

                    // Reset the UI state
                    progress.report({ increment: 25, message: "Resetting UI state..." });
                    
                    this._currentAgents = [];
                    this._changeGroups = [];
                    this._alternativeImplementations = [];
                    this._conflicts = [];
                    this._annotations = [];
                    this._checkpoints = [];
                    this._agents = [];
                    
                    // Update UI state with multiple message types for redundancy
                    if (this._view) {
                        // Clear project state
                        this._view.webview.postMessage({
                            type: 'PROJECT_STATE',
                            payload: {
                                initialized: false,
                                vision: '',
                                currentPhase: '',
                                activeAgents: [],
                                agents: [],
                                pendingDecisions: [],
                                tasks: [],
                                notifications: [],
                                teams: []
                            }
                        });
                        
                        // Clear agents
                        this._view.webview.postMessage({
                            type: 'AGENTS_LOADED',
                            payload: []
                        });
                        
                        // Reset to initial view
                        this._view.webview.postMessage({
                            type: 'RESET_TO_INITIAL',
                            payload: { timestamp: Date.now() }
                        });
                        
                        // Update general state
                        this._updateWebview();
                    }
                    
                    progress.report({ increment: 25, message: "Reset complete" });
                    
                    // Show success message
                    vscode.window.showInformationMessage("Tribe has been reset successfully. Please reload if needed.");
                }
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Error resetting Tribe: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    private async _loadInitialState() {
        try {
            // Immediately load and send the agents to populate the UI
            await this._getAgents();
            
            // Try to load active project from persistence
            try {
                const activeProject = await vscode.commands.executeCommand('tribe.getActiveProject') as ProjectData | null;
                
                if (activeProject && activeProject.team && activeProject.team.agents) {
                    console.log('Found active project:', activeProject.id);
                    
                    // Update local state with the loaded agents
                    this._currentAgents = activeProject.team.agents;
                    
                    // Send the loaded project state to the UI
                    this._view?.webview.postMessage({
                        type: 'PROJECT_INITIALIZED',
                        payload: {
                            id: activeProject.id,
                            initialized: true,
                            agents: activeProject.team.agents,
                            activeAgents: activeProject.team.agents,
                            team: activeProject.team,
                            vision: activeProject.team.vision || activeProject.description,
                            currentPhase: 'Planning'
                        }
                    });
                }
            } catch (e) {
                console.log('No active project to load:', e);
            }
            
            try {
                // Load any pending changes
                const pendingChanges = await vscode.commands.executeCommand('tribe.getPendingChanges');
                if (Array.isArray(pendingChanges)) {
                    this._changeGroups = pendingChanges;
                }
            } catch (e) {
                console.log('No pending changes to load');
            }

            try {
                // Load checkpoints
                const checkpoints = await vscode.commands.executeCommand('tribe.getCheckpoints');
                if (Array.isArray(checkpoints)) {
                    this._checkpoints = checkpoints;
                }
            } catch (e) {
                console.log('No checkpoints to load');
            }

            try {
                // Load annotations
                const annotations = await vscode.commands.executeCommand('tribe.getAnnotations');
                if (Array.isArray(annotations)) {
                    this._annotations = annotations;
                }
            } catch (e) {
                console.log('No annotations to load');
            }

            this._updateWebview();
            
            // Ensure we initialize the project state with the current agents
            if (this._currentAgents.length > 0) {
                this._view?.webview.postMessage({
                    type: 'PROJECT_INITIALIZED',
                    payload: {
                        vision: 'AI-powered software development',
                        currentPhase: 'Planning',
                        agents: this._currentAgents,
                        activeAgents: this._currentAgents,
                        initialized: true
                    }
                });
            }
        } catch (error) {
            console.error('Error loading initial state:', error);
        }
    }
}
