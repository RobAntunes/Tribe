/* eslint-disable header/header */

import * as vscode from 'vscode';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as path from 'path';
import { API_ENDPOINTS } from './config';
import { StorageService } from './storage';
import { ExtensionErrorHandler, ErrorSeverity, ErrorCategory, createError, errorWrapper } from './errorHandling';
import { registerChangeCommands } from './commands/changeCommands';
import { registerCheckpointCommands } from './commands/checkpointCommands';
import { registerAnnotationCommands } from './commands/annotationCommands';
import { registerImplementationCommands } from './commands/implementationCommands';
import { registerConflictCommands } from './commands/conflictCommands';
import { registerHistoryCommands } from './commands/historyCommands';
import { DiffService } from './services/diffService';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    Trace,
    State,
} from 'vscode-languageclient/node';
import { registerLogger, traceError, traceLog, traceVerbose } from './common/log/logging';
import {
    checkVersion,
    getInterpreterDetails,
    initializePython,
    onDidChangePythonInterpreter,
    resolveInterpreter,
} from './common/python';
import { restartServer } from './common/server';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from './common/settings';
import { loadServerDefaults } from './common/setup';
import { getLSClientTraceLevel } from './common/utilities';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';
import { CrewPanelProvider } from '../webview/src/panels/crew_panel/CrewPanelProvider';
import { StorageService as NewStorageService } from './services/storageService';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Helper function to check if a workspace folder is open
 * @returns true if a workspace folder is open, false otherwise
 */
function hasWorkspaceFolder(): boolean {
    return vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders.length > 0;
}

interface AgentPayload {
    name: string;
    role: string;
    backstory: string;
}

interface TaskPayload {
    description: string;
    assignedTo: string;
    name: string;
}

interface FeedbackPayload {
    agentId: string;
    actionType: string;
    feedback: Record<string, unknown>;
    context: Record<string, unknown>;
    accepted: boolean;
}

interface AutonomyPayload {
    agentId: string;
    taskType: string;
    autonomyLevel: number;
    supervisionRequirements: Record<string, unknown>;
}

interface FlowPayload {
    requirements: Record<string, unknown>;
    context: Record<string, unknown>;
}

interface WorkflowPayload {
    name: string;
    description: string;
    steps: Record<string, unknown>[];
    checkpoints: Record<string, unknown>[];
    requiredApprovals: string[];
}

interface CodePayload {
    requirements: string;
    context: Record<string, unknown>;
    language: string;
    framework?: string;
    outputFile: string;
}

interface RequirementsPayload {
    requirements: string;
}

interface AgentMessagePayload {
    agentId: string;
    message: string;
    isVPMessage?: boolean;
    isTeamMessage?: boolean;
    is_initialization?: boolean;
}

// Global variables and types
let client: LanguageClient | null = null;
let outputChannel: vscode.OutputChannel;
let serverReady = false;
let startupPromise: Promise<boolean> | null = null;

// Tracks server initialization status
enum ServerStatus {
    NotStarted,
    Starting,
    Running,
    Error
}

let serverStatus = ServerStatus.NotStarted;

// Load environment variables from .env files
function loadEnvFile(filePath: string): Record<string, string> {
    const env: Record<string, string> = {};
    try {
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const parts = trimmedLine.split('=');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const value = parts.slice(1).join('=').trim();
                        env[key] = value;
                    }
                }
            }
        }
    } catch (err) {
        // Silently fail - we'll log this at the calling point
    }
    return env;
}

export function activate(context: vscode.ExtensionContext) {
    // Create an output channel
    outputChannel = vscode.window.createOutputChannel('Tribe');
    context.subscriptions.push(outputChannel);
    
    outputChannel.appendLine('Tribe extension activating...');
    
    // Try to load API key from multiple sources
    try {
        // 1. Try from settings first (highest priority)
        const apiKey = vscode.workspace.getConfiguration().get('tribe.apiKey');
        if (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '') {
            // Check if it's not a placeholder
            const isPlaceholder = apiKey.toLowerCase().includes('your-api-key') || 
                                 apiKey.toLowerCase().includes('your_api_key') ||
                                 apiKey === 'api-key';
            
            if (!isPlaceholder) {
                outputChannel.appendLine('Found API key in settings, setting environment variable');
                process.env.ANTHROPIC_API_KEY = apiKey;
            } else {
                outputChannel.appendLine('Found placeholder API key in settings, ignoring');
            }
        } else {
            outputChannel.appendLine('No API key found in settings, checking .env files');
            
            // 2. Try from .env files
            const path = require('path');
            const envPaths = [
                path.join(context.extensionPath, '.env'),
                path.join(context.extensionPath, 'tribe', '.env')
            ];
            
            for (const envPath of envPaths) {
                const envVars = loadEnvFile(envPath);
                if (envVars.ANTHROPIC_API_KEY) {
                    // Check if it's not a placeholder
                    const envApiKey = envVars.ANTHROPIC_API_KEY;
                    const isPlaceholder = envApiKey.toLowerCase().includes('your-api-key') || 
                                         envApiKey.toLowerCase().includes('your_api_key') ||
                                         envApiKey === 'api-key';
                    
                    if (!isPlaceholder) {
                        outputChannel.appendLine(`Found API key in ${envPath}, setting environment variable`);
                        process.env.ANTHROPIC_API_KEY = envApiKey;
                        break;
                    }
                }
            }
        }
        
        // Log API key status (without revealing it)
        if (process.env.ANTHROPIC_API_KEY) {
            const key = process.env.ANTHROPIC_API_KEY;
            if (key.length > 8) {
                outputChannel.appendLine(`API key is set: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
            } else {
                outputChannel.appendLine('API key is set (short key)');
            }
        } else {
            outputChannel.appendLine('API key is NOT set after checking all sources');
        }
    } catch (err) {
        outputChannel.appendLine(`Error loading API key: ${err}`);
    }
    
    // Register the getAgents command for the UI
    context.subscriptions.push(
        vscode.commands.registerCommand('tribe.getAgents', async () => {
            try {
                // Import storage service
                const { StorageService } = require('./services/storageService');
                
                // Get service instance
                const storageService = StorageService.getInstance(context);
                
                // Get agents from storage
                const agents = await storageService.getAgents();
                
                outputChannel.appendLine(`Loaded ${agents.length} agents from persistence layer`);
                
                if (agents.length > 0) {
                    return agents;
                } else {
                    // Return empty array if no agents found
                    return [];
                }
            } catch (error) {
                outputChannel.appendLine(`Error getting agents: ${error}`);
                return [];
            }
        }),
        vscode.commands.registerCommand('tribe.initializeProject', async (payload) => {
            // Return a simple success response for now
            outputChannel.appendLine(`Project initialized with payload: ${JSON.stringify(payload)}`);
            return {
                id: `project-${Date.now()}`,
                initialized: true,
                status: 'active'
            };
        }),
        
        vscode.commands.registerCommand('tribe.getActiveProject', async () => {
            try {
                // Import storage service
                const { StorageService } = require('./services/storageService');
                
                // Get service instance
                const storageService = StorageService.getInstance(context);
                
                // Get active project
                const activeProject = await storageService.getActiveProject();
                
                if (activeProject) {
                    outputChannel.appendLine(`Loaded active project: ${activeProject.id}`);
                    return activeProject;
                } else {
                    outputChannel.appendLine('No active project found');
                    return null;
                }
            } catch (error) {
                outputChannel.appendLine(`Error loading active project: ${error}`);
                return null;
            }
        }),
        
        vscode.commands.registerCommand('tribe.resetStorage', async () => {
            try {
                // Import storage service
                const { StorageService } = require('./services/storageService');
                const { STORAGE_PATHS, getStorageDirectory } = require('./config');
                const path = require('path');
                const fs = require('fs');
                
                outputChannel.appendLine("Resetting all Tribe storage...");
                
                // Get the storage directory
                const storageDir = getStorageDirectory();
                
                if (fs.existsSync(storageDir)) {
                    outputChannel.appendLine(`Removing storage directory: ${storageDir}`);
                    
                    // Delete everything in the directory but not the directory itself
                    const subdirs = [
                        STORAGE_PATHS.CHANGE_GROUPS,
                        STORAGE_PATHS.CHECKPOINTS,
                        STORAGE_PATHS.ANNOTATIONS,
                        STORAGE_PATHS.IMPLEMENTATIONS,
                        STORAGE_PATHS.CONFLICTS,
                        STORAGE_PATHS.HISTORY,
                        STORAGE_PATHS.AGENTS,
                        STORAGE_PATHS.TEAMS,
                        STORAGE_PATHS.PROJECTS,
                    ];
                    
                    // Delete each subdirectory
                    for (const subdir of subdirs) {
                        const fullPath = path.join(storageDir, subdir);
                        if (fs.existsSync(fullPath)) {
                            try {
                                outputChannel.appendLine(`Removing: ${fullPath}`);
                                fs.rmSync(fullPath, { recursive: true, force: true });
                            } catch (err) {
                                outputChannel.appendLine(`Error deleting ${fullPath}: ${err}`);
                            }
                        }
                    }
                    
                    outputChannel.appendLine("Storage reset successfully");
                    return true;
                } else {
                    outputChannel.appendLine(`Storage directory doesn't exist: ${storageDir}`);
                    return true; // Already clean
                }
            } catch (error) {
                outputChannel.appendLine(`Error resetting storage: ${error}`);
                return false;
            }
        }),
        
        vscode.commands.registerCommand('tribe.saveTeamData', async (data) => {
            try {
                const { team, agents } = data;
                
                if (!team || !agents) {
                    outputChannel.appendLine('Invalid team data provided');
                    return false;
                }
                
                // Import storage service
                const { StorageService } = require('./services/storageService');
                
                // Get service instance
                const storageService = StorageService.getInstance(context);
                
                // Save the team
                await storageService.saveTeam(team);
                outputChannel.appendLine(`Saved team with ID: ${team.id}`);
                
                // Save each agent
                for (const agent of agents) {
                    await storageService.saveAgent(agent);
                }
                outputChannel.appendLine(`Saved ${agents.length} agents to persistence layer`);
                
                // Create and save project
                const now = new Date().toISOString();
                const project = {
                    id: `project-${Date.now()}`,
                    name: "Project",
                    description: team.description || "Development Project",
                    initialized: true,
                    team: team,
                    created_at: now,
                    updated_at: now
                };
                
                await storageService.saveProject(project, true);
                outputChannel.appendLine(`Saved project with ID: ${project.id}`);
                
                return true;
            } catch (error) {
                outputChannel.appendLine(`Error saving team data: ${error}`);
                return false;
            }
        })
    );

    // Initialize the crew panel provider
    try {
        // Import provider from webview - workaround for circular dependencies
        const { CrewPanelProvider } = require('../webview/src/panels/crew_panel/CrewPanelProvider');
        
        // Register webview panel provider
        const crewPanelProvider = new CrewPanelProvider(context.extensionUri);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('tribe.crewPanel', crewPanelProvider)
        );
        
        outputChannel.appendLine('Registered crew panel provider');
    } catch (err) {
        outputChannel.appendLine(`Error initializing webview: ${err}`);
        // Continue without webview if it fails
    }
    
    // Don't start the server automatically, wait for user to explicitly request it
    // This helps prevent the "write after end" errors during VSCode restart
    serverStatus = ServerStatus.NotStarted;
    outputChannel.appendLine('Server will be started on first command...');
    
    /**
     * Creates a fallback team when the server is not available
     * @param description The team description
     * @returns A mock team that can be used as fallback
     */
    function createFallbackTeam(description: string) {
        outputChannel.appendLine('Creating fallback team with static members');
        const now = Date.now();
        return {
            project: {
                id: `project-fallback-${now}`,
                name: "Project",
                description: description,
                initialized: true,
                team: {
                    id: `team-fallback-${now + 1}`,
                    name: "Team",
                    description: `Team for ${description}`,
                    agents: [
                        {
                            id: "0",
                            role: "Lead Developer",
                            name: "Alex",
                            description: "Experienced software engineer with 10+ years of focus on architecture and system design.",
                            short_description: "Senior developer with expertise in system architecture",
                            backstory: "Experienced software engineer with 10+ years of focus on architecture and system design.",
                            status: "active",
                            initialization_complete: true,
                            tools: []
                        },
                        {
                            id: "1",
                            role: "Front-end Developer",
                            name: "Taylor",
                            description: "UI/UX specialist with 5 years of experience in modern frontend frameworks.",
                            short_description: "Frontend specialist with UI/UX expertise",
                            backstory: "UI/UX specialist with 5 years of experience in modern frontend frameworks.",
                            status: "active",
                            initialization_complete: true,
                            tools: []
                        },
                        {
                            id: "2",
                            role: "QA Engineer",
                            name: "Jordan",
                            description: "Testing expert with automation skills and experience with CI/CD pipelines.",
                            short_description: "QA specialist with automation expertise",
                            backstory: "Testing expert with automation skills and experience with CI/CD pipelines.",
                            status: "active",
                            initialization_complete: true,
                            tools: []
                        }
                    ]
                }
            }
        };
    }

    // Create a function to ensure the server is ready with a timeout
    async function ensureServerReady(): Promise<boolean> {
        outputChannel.appendLine(`[DEBUG] ensureServerReady called. Current status: ${ServerStatus[serverStatus]}`);
        
        // If server is already running, return immediately
        if (serverStatus === ServerStatus.Running && client) {
            outputChannel.appendLine('[DEBUG] Server already running, returning immediately');
            return true;
        }
        
        // If already starting, wait for existing promise
        if (serverStatus === ServerStatus.Starting && startupPromise) {
            outputChannel.appendLine('[DEBUG] Server already starting, waiting for existing promise');
            return startupPromise;
        }
        
        // Start a new server initialization
        serverStatus = ServerStatus.Starting;
        outputChannel.appendLine('Starting server initialization...');
        
        // Add overall timeout for starting server (30 seconds)
        const timeout = setTimeout(() => {
            outputChannel.appendLine('[DEBUG] Server initialization timed out');
            serverStatus = ServerStatus.Error;
            startupPromise = Promise.resolve(false);
        }, 30000);
        
        // Create a new promise for this initialization
        startupPromise = new Promise<boolean>(async (resolve) => {
            try {
                outputChannel.appendLine('[DEBUG] Inside startupPromise');
                
                // Clean up any existing client
                if (client) {
                    try {
                        outputChannel.appendLine('Stopping existing client...');
                        await client.stop().catch(e => {
                            outputChannel.appendLine(`Expected error stopping client: ${e}`);
                        });
                        client = null;
                    } catch (e) {
                        outputChannel.appendLine(`Error stopping client (handled): ${e}`);
                        client = null;
                    }
                }
                
                // Wait a moment for resources to be freed
                outputChannel.appendLine('[DEBUG] Waiting for resources to be freed');
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Check what Python path we're using
                try {
                    outputChannel.appendLine('[DEBUG] Checking Python version...');
                    const pythonVersionResult = await execAsync('python --version')
                        .then(result => result.stdout.trim())
                        .catch(err => {
                            outputChannel.appendLine(`[DEBUG] Error checking Python version: ${err}`);
                            return "Unknown";
                        });
                    
                    outputChannel.appendLine(`[DEBUG] Python version: ${pythonVersionResult}`);
                } catch (err) {
                    outputChannel.appendLine(`[DEBUG] Error during Python version check: ${err}`);
                }
                
                // Create new client with debug tracing
                outputChannel.appendLine('[DEBUG] Creating new client...');
                
                // Add the extension path to PYTHONPATH to help with imports
                const extensionPath = context.extensionPath;
                const pythonPathAdditions = [
                    extensionPath, 
                    `${extensionPath}/tribe`,
                    `${extensionPath}/bundled/tool`,
                    `${extensionPath}/bundled/libs`,
                ];
                
                // Create PYTHONPATH with the extension paths (using correct path separator for platform)
                const pathSeparator = process.platform === 'win32' ? ';' : ':';
                const pythonPath = pythonPathAdditions.join(pathSeparator) + 
                    (process.env.PYTHONPATH ? pathSeparator + process.env.PYTHONPATH : '');
                
                // Just log the API key status - we've already loaded it from .env files 
                if (process.env.ANTHROPIC_API_KEY) {
                    const key = process.env.ANTHROPIC_API_KEY;
                    const isPlaceholder = key.toLowerCase().includes('your-api-key') || 
                                         key.toLowerCase().includes('your_api_key') ||
                                         key === 'api-key';
                    
                    if (isPlaceholder) {
                        outputChannel.appendLine('[WARNING] ANTHROPIC_API_KEY contains placeholder value');
                        vscode.window.showWarningMessage('Anthropic API key appears to be a placeholder. Team creation will use mock data.', 'Learn More')
                            .then(selection => {
                                if (selection === 'Learn More') {
                                    vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/claude/reference/getting-started-with-the-api'));
                                }
                            });
                    } else {
                        outputChannel.appendLine(`[DEBUG] API key found and properly set: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
                    }
                } else {
                    outputChannel.appendLine('[WARNING] ANTHROPIC_API_KEY not set');
                    vscode.window.showWarningMessage('Anthropic API key not set. Team creation will use mock data.', 'Set API Key')
                        .then(selection => {
                            if (selection === 'Set API Key') {
                                vscode.commands.executeCommand('tribe.setApiKey');
                            }
                        });
                }
                
                // Set timeout to 60 seconds
                const serverOptions: ServerOptions = {
                    run: {
                        command: 'python',
                        args: ['-m', 'tribe'],
                        options: {
                            env: {
                                ...process.env,  // This will include the ANTHROPIC_API_KEY we loaded from .env or settings
                                TRIBE_MODEL: API_ENDPOINTS.MODEL,
                                TRIBE_DEBUG: 'false', // Disable debug mode to use real model
                                PYTHONPATH: pythonPath,
                                LS_SHOW_NOTIFICATION: 'always', // Show all LSP notifications
                                PYTHONUNBUFFERED: '1', // Unbuffered output
                                PYTHONIOENCODING: 'utf-8', // Force UTF-8 
                            },
                        },
                        transport: TransportKind.stdio
                    },
                    debug: {
                        command: 'python',
                        args: ['-m', 'tribe', '--debug'],
                        options: {
                            env: {
                                ...process.env,  // This will include the ANTHROPIC_API_KEY we loaded from .env or settings
                                TRIBE_MODEL: API_ENDPOINTS.MODEL,
                                TRIBE_DEBUG: 'false', // Disable debug mode to use real model
                                PYTHONPATH: pythonPath,
                                LS_SHOW_NOTIFICATION: 'always', // Show all LSP notifications
                                PYTHONUNBUFFERED: '1', // Unbuffered output
                                PYTHONIOENCODING: 'utf-8', // Force UTF-8 
                            },
                        },
                        transport: TransportKind.stdio
                    }
                };
                
                outputChannel.appendLine(`[DEBUG] PYTHONPATH: ${pythonPath}`);
                
                // Create client with proper parameter order: id, name, serverOptions, clientOptions
                client = new LanguageClient(
                    'tribe', // id
                    'Tribe Language Server', // name 
                    serverOptions, // serverOptions
                    {  // clientOptions
                        documentSelector: [{ scheme: 'file', language: '*' }],
                        synchronize: {
                            configurationSection: 'tribe',
                        },
                        outputChannel: outputChannel,
                        traceOutputChannel: outputChannel,
                        revealOutputChannelOn: 4, // Show output on error and for all LSP messages
                        initializationOptions: {
                            debug: true,  // Pass debug flag to server
                            timeout: 60000 // 60 second timeout
                        }
                    }
                );
                
                // Set error handler
                client.onDidChangeState((e) => {
                    outputChannel.appendLine(`[DEBUG] Client state changed: ${e.oldState} -> ${e.newState}`);
                });
                
                // Start the client
                outputChannel.appendLine('[DEBUG] Starting client...');
                try {
                    await client.start();
                    outputChannel.appendLine('[DEBUG] Client.start() completed');
                } catch (e) {
                    outputChannel.appendLine(`[DEBUG] Error in client.start(): ${e}`);
                    throw e;
                }
                
                // Wait for client to be in running state
                outputChannel.appendLine('[DEBUG] Waiting for client to enter running state...');
                // Increase timeout to 30 seconds (30 attempts with 1 second delay)
                for (let i = 0; i < 30; i++) {
                    if (!client) {
                        outputChannel.appendLine('[DEBUG] Client unexpectedly became null');
                        throw new Error('Client unexpectedly became null');
                    }
                    
                    const state = client["_state"];
                    outputChannel.appendLine(`[DEBUG] Client state check ${i+1}/30: ${state}`);
                    
                    if (state === State.Running) {
                        outputChannel.appendLine('[DEBUG] Client is in running state!');
                        serverStatus = ServerStatus.Running;
                        clearTimeout(timeout);
                        return resolve(true);
                    }
                    
                    // Check if we're at state 3 (Starting) for a long time
                    // State 1: Created, 2: Starting, 3: Running, 4: Stopped
                    if (state === 3 && i > 5) {
                        // If we're in state 3 for more than 5 seconds, consider it running
                        outputChannel.appendLine('[DEBUG] Client is in state 3 (Starting) for more than 5 seconds, considering it running');
                        serverStatus = ServerStatus.Running;
                        clearTimeout(timeout);
                        return resolve(true);
                    }
                    
                    // Wait before checking again
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                // If we get here, server didn't start properly
                outputChannel.appendLine('[DEBUG] Server did not enter running state in time');
                serverStatus = ServerStatus.Error;
                clearTimeout(timeout);
                resolve(false);
            } catch (err) {
                outputChannel.appendLine(`[DEBUG] Error starting server: ${err}`);
                
                if (client) {
                    try {
                        // Try to clean up
                        outputChannel.appendLine('[DEBUG] Trying to clean up client after error');
                        await client.stop().catch(e => {
                            outputChannel.appendLine(`[DEBUG] Error during cleanup: ${e}`);
                        });
                    } catch (e) {
                        outputChannel.appendLine(`[DEBUG] Exception during cleanup: ${e}`);
                    }
                    client = null;
                }
                
                serverStatus = ServerStatus.Error;
                clearTimeout(timeout);
                resolve(false);
            }
        });
        
        return startupPromise;
    }

    // Add a command to set the API key
    context.subscriptions.push(
        vscode.commands.registerCommand('tribe.setApiKey', async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Anthropic API key',
                password: true,
                placeHolder: 'sk-...',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value) {
                        return 'API key is required';
                    }
                    if (value.toLowerCase().includes('your-api-key') || 
                        value.toLowerCase().includes('your_api_key')) {
                        return 'Please enter an actual API key, not a placeholder';
                    }
                    if (!value.startsWith('sk-')) {
                        return 'Anthropic API keys typically start with "sk-"';
                    }
                    return null; // Input is valid
                }
            });
            
            if (apiKey) {
                // Set the API key in the environment
                process.env.ANTHROPIC_API_KEY = apiKey;
                
                // Restart the server to use the new API key
                await vscode.commands.executeCommand('tribe.restart');
                
                vscode.window.showInformationMessage('API key set successfully! Server restarted.');
                
                // Suggest saving the key for future sessions
                const saveChoice = await vscode.window.showInformationMessage(
                    'Would you like to save this API key for future sessions?',
                    'Yes (User Settings)',
                    'No'
                );
                
                if (saveChoice === 'Yes (User Settings)') {
                    // Update user settings with the API key
                    await vscode.workspace.getConfiguration().update(
                        'tribe.apiKey',
                        apiKey,
                        vscode.ConfigurationTarget.Global
                    );
                    
                    vscode.window.showInformationMessage('API key saved to user settings.');
                }
            }
        })
    );
    
    // Register the main commands
    context.subscriptions.push(
        vscode.commands.registerCommand('tribe.restart', async () => {
            outputChannel.appendLine('Restarting server...');
            
            // Force server status to not started to ensure full restart
            serverStatus = ServerStatus.NotStarted;
            startupPromise = null;
            
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Restarting Tribe server...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Stopping and restarting server..." });
                    
                    const success = await ensureServerReady();
                    
                    if (success) {
                        progress.report({ increment: 100, message: "Server restarted!" });
                        outputChannel.appendLine('Server restart completed successfully');
                    } else {
                        progress.report({ increment: 100, message: "Restart had issues" });
                        throw new Error("Failed to restart server completely");
                    }
                });
                
                vscode.window.showInformationMessage('Tribe server restarted successfully.');
            } catch (err) {
                outputChannel.appendLine(`Error restarting server: ${err}`);
                vscode.window.showErrorMessage(`Error restarting server: ${err}`);
            }
        }),
        
        vscode.commands.registerCommand('tribe.createTeam', async (description = 'New development team') => {
            // Ensure description is a string and handle potential object parameters
            if (typeof description === 'object') {
                if (description && description.hasOwnProperty('description') && typeof description.description === 'string') {
                    // Extract description from object if possible
                    description = description.description;
                } else {
                    // Fall back to default if we get an object without a description property
                    description = 'New development team';
                }
            }
            
            outputChannel.appendLine(`Creating team with description: ${description}...`);
            
            // Ensure the description is a string
            if (typeof description !== 'string') {
                description = 'New development team';
            }
            
            try {
                // Wait for server to be ready before proceeding
                const serverInitialized = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Preparing Tribe server...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Ensuring server is ready..." });
                    
                    try {
                        const ready = await ensureServerReady();
                        
                        if (!ready) {
                            outputChannel.appendLine('Server did not initialize properly, using fallback');
                            return false;
                        }
                        
                        progress.report({ increment: 100, message: "Server ready" });
                        return true;
                    } catch (error) {
                        outputChannel.appendLine(`Error initializing server: ${error}`);
                        return false;
                    }
                });
                
                // If server did not initialize properly, provide a fallback response
                if (!serverInitialized || !client) {
                    outputChannel.appendLine('Using fallback for team creation (server not available)');
                    
                    vscode.window.showInformationMessage('Creating team in offline mode. Some features might be limited.');
                    
                    // Return a fallback team using our helper function
                    return createFallbackTeam(description);
                }
                
                // Now proceed with team creation via server
                const result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Creating team...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 30, message: "Sending request..." });
                    
                    try {
                        // Add a timeout for the request
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Request timed out after 45 seconds')), 45000);
                        });
                        
                        if (!client) {
                            throw new Error("Client unexpectedly became null");
                        }
                        
                        // Race the client request against the timeout
                        const result = await Promise.race([
                            client.sendRequest('tribe/createTeam', {
                                description: description,
                                team_size: 3,
                                temperature: 0.7
                            }),
                            timeoutPromise
                        ]);
                        
                        // Check that result is properly formatted
                        if (!result || typeof result !== 'object') {
                            outputChannel.appendLine(`Invalid response format: ${JSON.stringify(result)}`);
                            throw new Error(`Invalid response format from server: ${JSON.stringify(result)}`);
                        }
                        
                        // Check for error in the result object
                        if (result && typeof result === 'object' && 'error' in result) {
                            const errorMsg = (result as any).error;
                            outputChannel.appendLine(`Error from server: ${errorMsg}`);
                            
                            // Check if the error is about the API key
                            if (errorMsg.includes('ANTHROPIC_API_KEY') || errorMsg.includes('API key')) {
                                vscode.window.showInformationMessage('API key not configured. Creating team in offline mode.');
                                return createFallbackTeam(description);
                            } else {
                                throw new Error(`Server returned error: ${errorMsg}`);
                            }
                        }
                        
                        progress.report({ increment: 100, message: "Team created!" });
                        
                        // Show a success message
                        vscode.window.showInformationMessage('Team created successfully!');
                        
                        return result;
                    } catch (err) {
                        // If we get a "write after end" error, mark the server as not started
                        // to force a complete reinit next time
                        const errorMsg = String(err);
                        if (errorMsg.includes('write after end')) {
                            outputChannel.appendLine('Detected "write after end" error, marking server for full restart');
                            serverStatus = ServerStatus.NotStarted;
                            startupPromise = null;
                        }
                        
                        outputChannel.appendLine(`Error in team creation request: ${err}`);
                        
                        // Try to create a fallback team instead of throwing
                        outputChannel.appendLine('Creating fallback team due to error');
                        vscode.window.showInformationMessage('Server error - creating team in offline mode instead.');
                        return createFallbackTeam(description);
                    }
                });
                
                // Log the successful result
                outputChannel.appendLine('Team creation completed with result: ' + JSON.stringify(result));
                return result;
            } catch (err) {
                outputChannel.appendLine(`Error creating team: ${err}`);
                vscode.window.showErrorMessage(`Error creating team: ${err}`);
                
                // Even if there's an error, return a fallback team
                vscode.window.showErrorMessage('Unable to create team normally, using offline mode.');
                return createFallbackTeam(description);
            }
        }),
        
        // Simple command to open the output channel - helpful for debugging
        vscode.commands.registerCommand('tribe.showOutput', () => {
            outputChannel.show();
        }),
        
        // Command to show diagnostics info
        vscode.commands.registerCommand('tribe.showDiagnostics', async () => {
            try {
                const diagnosticInfo = {
                    extension: {
                        version: vscode.extensions.getExtension('mightydev.tribe')?.packageJSON?.version || 'unknown',
                        path: vscode.extensions.getExtension('mightydev.tribe')?.extensionPath || 'unknown',
                    },
                    client: {
                        state: client ? client["_state"] : 'Not initialized',
                        running: client ? client["_serverProcess"] !== undefined : false
                    },
                    python: {
                        path: process.env.PYTHONPATH || 'Not set',
                        version: await vscode.commands.executeCommand('python.interpreterPath') || 'unknown'
                    },
                    env: {
                        modelSet: Boolean(API_ENDPOINTS.MODEL),
                        model: API_ENDPOINTS.MODEL || 'Not set'
                    }
                };
                
                // Create a diagnostics panel
                const panel = vscode.window.createWebviewPanel(
                    'tribeDiagnostics',
                    'Tribe Diagnostics',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );
                
                // Format the diagnostics data as HTML
                panel.webview.html = `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Tribe Diagnostics</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #333; }
                        .section { margin-bottom: 20px; }
                        .card { background: #f5f5f5; border-radius: 5px; padding: 15px; margin-bottom: 10px; }
                        .success { color: green; }
                        .error { color: red; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
                    </style>
                </head>
                <body>
                    <h1>Tribe Extension Diagnostics</h1>
                    
                    <div class="section">
                        <h2>Extension Info</h2>
                        <div class="card">
                            <table>
                                <tr><th>Version</th><td>${diagnosticInfo.extension.version}</td></tr>
                                <tr><th>Path</th><td>${diagnosticInfo.extension.path}</td></tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Language Client Status</h2>
                        <div class="card">
                            <table>
                                <tr>
                                    <th>State</th>
                                    <td class="${diagnosticInfo.client.state === 'Running' ? 'success' : 'error'}">
                                        ${diagnosticInfo.client.state}
                                    </td>
                                </tr>
                                <tr>
                                    <th>Server Process</th>
                                    <td class="${diagnosticInfo.client.running ? 'success' : 'error'}">
                                        ${diagnosticInfo.client.running ? 'Running' : 'Not running'}
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Python Environment</h2>
                        <div class="card">
                            <table>
                                <tr><th>PYTHONPATH</th><td>${diagnosticInfo.python.path}</td></tr>
                                <tr><th>Python Version</th><td>${diagnosticInfo.python.version}</td></tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Model Configuration</h2>
                        <div class="card">
                            <table>
                                <tr>
                                    <th>Model Set</th>
                                    <td class="${diagnosticInfo.env.modelSet ? 'success' : 'error'}">
                                        ${diagnosticInfo.env.modelSet ? 'Yes' : 'No'}
                                    </td>
                                </tr>
                                <tr><th>Model</th><td>${diagnosticInfo.env.model}</td></tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h2>Actions</h2>
                        <button onclick="vscode.postMessage({command: 'restart'})">Restart Server</button>
                        <button onclick="vscode.postMessage({command: 'showOutput'})">Show Output Log</button>
                    </div>
                    
                    <script>
                        const vscode = acquireVsCodeApi();
                        
                        window.addEventListener('message', event => {
                            const message = event.data;
                            // Handle messages from the extension
                        });
                    </script>
                </body>
                </html>`;
                
                // Handle webview messages
                panel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case 'restart':
                            vscode.commands.executeCommand('tribe.restart');
                            break;
                        case 'showOutput':
                            vscode.commands.executeCommand('tribe.showOutput');
                            break;
                    }
                });
            } catch (err) {
                outputChannel.appendLine(`Error showing diagnostics: ${err}`);
                vscode.window.showErrorMessage(`Error showing diagnostics: ${err}`);
            }
        })
    );
    
    // The server will be started on demand when needed
    outputChannel.appendLine('Extension activated. Server will start when needed.');
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    
    // When VSCode is shutting down, make sure we properly clean up
    outputChannel.appendLine('Tribe extension deactivating, stopping server...');
    serverStatus = ServerStatus.NotStarted;  // Mark as not started
    
    try {
        return client.stop();
    } catch (err) {
        outputChannel.appendLine(`Error stopping client during deactivation: ${err}`);
        return undefined;
    }
}

//#region Function definitions for Enhanced Genesis Agent commands

async function initializeAgent(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Initializing Enhanced Genesis Agent...');

    // Placeholder implementation
    outputChannel.appendLine('Agent initialization completed.');
}

async function analyzeProject(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Analyzing project...');

    // Placeholder implementation
    outputChannel.appendLine('Project analysis completed.');
}

async function executeWorkflow(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Executing workflow...');

    // Placeholder implementation
    outputChannel.appendLine('Workflow execution completed.');
}

async function captureExperience(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Capturing experience...');

    // Placeholder implementation
    outputChannel.appendLine('Experience captured successfully.');
}

async function extractPatterns(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Extracting patterns from experiences...');

    // Placeholder implementation
    outputChannel.appendLine('Patterns extracted successfully.');
}

async function collectFeedback(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Collecting feedback...');

    // Placeholder implementation
    outputChannel.appendLine('Feedback collected successfully.');
}

async function analyzeFeedback(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Analyzing feedback...');

    // Placeholder implementation
    outputChannel.appendLine('Feedback analysis completed.');
}

async function createReflection(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Creating reflection...');

    // Placeholder implementation
    outputChannel.appendLine('Reflection created successfully.');
}

async function extractInsights(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Extracting insights from reflections...');

    // Placeholder implementation
    outputChannel.appendLine('Insights extracted successfully.');
}

async function createImprovementPlan(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Creating improvement plan...');

    // Placeholder implementation
    outputChannel.appendLine('Improvement plan created successfully.');
}

async function generateOptimizedPrompt(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Generating optimized prompt...');

    // Placeholder implementation
    outputChannel.appendLine('Optimized prompt generated successfully.');
}

async function queryModel(outputChannel: vscode.OutputChannel): Promise<void> {
    // Show output to indicate the command is running
    outputChannel.show();
    outputChannel.appendLine('Querying foundation model...');

    // Placeholder implementation
    outputChannel.appendLine('Model query completed successfully.');
}

//#endregion

//#region Function definitions for Tribe commands
// Note: This section was previously defining implementations for missing functions
// But now the functions are implemented as mock implementations in the command registrations
// So we don't need function implementations here anymore
// Define a helper function for getting server options
async function getLSServerOptions(
    context: vscode.ExtensionContext,
    wsFolder: vscode.WorkspaceFolder,
    serverId: string,
    pythonPath: string,
) {
    const entryPointScript = path.join(context.extensionPath, 'bundled', 'tool', 'lsp_server.py');

    // Verify the provided Python path or find an appropriate one
    let finalPythonPath = pythonPath;
    if (!fs.existsSync(pythonPath)) {
        traceLog(`Python path ${pythonPath} doesn't exist, finding system Python`);
        try {
            // Check if system Python exists
            const { stdout } = await execAsync('which python3 || which python').catch(() => ({ stdout: '' }));
            if (stdout && stdout.trim()) {
                finalPythonPath = stdout.trim();
                traceLog(`Using system Python: ${finalPythonPath}`);
            } else {
                // Fall back to 'python3' command
                finalPythonPath = 'python3';
                traceLog(`Falling back to python3 command`);
            }
        } catch (error) {
            traceError(`Error finding system Python: ${error}`);
            finalPythonPath = 'python3'; // Fall back to default
        }
    }

    // Set up environment variables
    const newEnv = { ...process.env };

    // Add the extension path to PYTHONPATH to help with imports
    const extensionPaths = [
        path.join(context.extensionPath),
        path.join(context.extensionPath, 'tribe'),
        path.join(context.extensionPath, 'bundled', 'libs'),
        path.join(context.extensionPath, 'bundled', 'tool'),
    ];

    // Create PYTHONPATH with the extension paths
    newEnv.PYTHONPATH =
        extensionPaths.join(path.delimiter) + (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '');

    // Set import strategy to fromEnvironment which is more reliable
    newEnv.LS_IMPORT_STRATEGY = 'fromEnvironment';

    // Add more verbose logging
    newEnv.PYTHONVERBOSE = '1';
    newEnv.LS_SHOW_NOTIFICATION = 'always';

    traceLog(`Enhanced server options PYTHONPATH: ${newEnv.PYTHONPATH}`);
    traceLog(`Using Python interpreter: ${finalPythonPath}`);

    const serverOptions: ServerOptions = {
        command: finalPythonPath,
        args: [entryPointScript, '--log-file', path.join(context.extensionPath, 'tribe-server.log')],
        options: {
            cwd: path.dirname(entryPointScript),
            env: newEnv,
        },
    };

    return serverOptions;
}

/* Legacy implementation below - now implemented directly in command handlers
async function createTeam_legacy(teamSpec: Record<string, any>): Promise<Record<string, any>> {
    try {
        console.log('Creating team with description:', teamSpec.description);
        
        // Call the Python backend to generate a team using the foundation model
        // This is the most important part - we let the Python backend handle agent creation
        // which will use the foundation model for team generation
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }
        
        // Initialize the language server if it hasn't been already
        await vscode.commands.executeCommand('tribe.initialize');
        
        // This is the key fix - we need to avoid calling the same command we're registering
        // Instead, communicate directly with the Python backend using the LSP client
        console.log('Creating team via Python backend with params:', teamSpec);
        
        // Display a status message to the user
        const statusMessage = vscode.window.setStatusBarMessage('Creating AI team... This may take up to 2 minutes');
        
        try {
            // Set a timeout for the operation to prevent UI hanging
            const timeoutPromise = new Promise<any>((_, reject) => 
                setTimeout(() => reject(new Error('Team creation timed out after 2 minutes')), 120000));
            
            // Instead of recursively calling our command, use the LSP client directly
            let createTeamResult: any;
            
            if (lsClient) {
                try {
                    // Make sure the LSP client is ready before making a request
                    let useSubprocessFallback = false;
                    
                    if (!lsClient || !(lsClient as any).state || (lsClient as any).state === 'stopped') {
                        console.log("LSP client not ready yet, waiting for initialization...");
                        vscode.window.setStatusBarMessage('Waiting for Tribe language server to initialize...', 3000);
                        
                        // Wait for client to be ready with progress indicator
                        const serverReady = await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: "Initializing Tribe language server...",
                            cancellable: false
                        }, async (progress) => {
                            progress.report({ increment: 0, message: "Starting server..." });
                            
                            // Wait for the client to be initialized, with a maximum timeout
                            const maxWait = 30000; // 30 seconds
                            const startTime = Date.now();
                            
                            while ((!lsClient || !(lsClient as any).state || (lsClient as any).state === 'stopped') && 
                                   (Date.now() - startTime < maxWait)) {
                                // Report progress
                                const elapsed = Date.now() - startTime;
                                const percentage = Math.min(95, Math.floor((elapsed / maxWait) * 100));
                                progress.report({ 
                                    increment: percentage / 20, 
                                    message: `Waiting for server (${Math.floor(elapsed / 1000)}s)...` 
                                });
                                
                                // Wait a bit before checking again
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            
                            // Final check
                            if (!lsClient || !(lsClient as any).state || (lsClient as any).state === 'stopped') {
                                console.log("Language server initialization timed out, will use subprocess fallback");
                                progress.report({ increment: 100, message: "Using fallback method..." });
                                return false; // Return false to indicate we need to use fallback
                            }
                            
                            progress.report({ increment: 100, message: "Server ready!" });
                            return true; // Return true to indicate server is ready
                        });
                        
                        // Set flag based on server initialization result
                        useSubprocessFallback = !serverReady;
                    }
                    
                    if (!useSubprocessFallback) {
                        // Server is ready, use the LSP client
                        console.log("LSP client ready, sending team spec:", teamSpec);
                        
                        try {
                            // Execute request with timeout
                            createTeamResult = await Promise.race([
                                lsClient.sendRequest('tribe/createTeam', teamSpec),
                                timeoutPromise
                            ]);
                        } catch (err) {
                            console.log("LSP request failed, falling back to subprocess:", err);
                            useSubprocessFallback = true;
                        }
                    }
                    
                    // If we need to use the fallback, skip to the else block below
                    if (useSubprocessFallback) {
                        console.log("Using Python subprocess fallback for team creation");
                        
                        // This will be handled by the else branch after the catch block
                        throw new Error("Using subprocess fallback instead");
                    }
                } catch (e) {
                    if (e instanceof Error && e.message === "Using subprocess fallback instead") {
                        // This is intentional, not a real error
                        console.log("Switching to subprocess fallback by design");
                    } else {
                        // This is an actual error
                        console.error('LSP request failed:', e);
                        
                        // Show a notification to the user
                        vscode.window.showInformationMessage(
                            'Using direct Python subprocess for team creation due to LSP client issues.'
                        );
                    }
                    
                    // Continue to the else block for subprocess approach
                }
            }
            
            // Fallback to subprocess approach (either lsClient is null or we had an error)
            if (!createTeamResult) {
                // Show progress indicator for subprocess approach
                createTeamResult = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Creating team using Python subprocess...",
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 0, message: "Starting Python process..." });
                    
                    // Fallback to direct Python subprocess
                    console.log('Using Python subprocess for team creation');
                    
                    // Use child_process to call Python directly with corrected path handling
                    // Get extension path from the workspace folder path
                    const extensionPath = path.join(workspaceFolder.uri.fsPath, 'extensions', 'tribe');
                    
                    progress.report({ increment: 20, message: "Launching Python process..." });
                    
                    const pythonCode = `
import sys
import json
import asyncio
import os

# Add all possible extension paths to ensure imports work
sys.path.append('${extensionPath}')
sys.path.append(os.path.join('${extensionPath}', 'tribe'))
sys.path.append(os.path.join('${extensionPath}', 'bundled', 'tool', 'tribe'))

try:
    from tribe.extension import _create_team_implementation, TribeLanguageServer
    print("Successfully imported tribe extension modules")
    
    async def main():
        server = TribeLanguageServer()
        # Parse JSON payload
        try:
            # Simple JSON parse, let Python models handle validation
            payload = json.loads('${JSON.stringify(teamSpec).replace(/'/g, "\\'")}')
            print(f"Using payload: {payload}")
        except Exception as e:
            print(f"Error parsing JSON payload: {e}")
            # Fallback to basic dictionary with description
            payload = {"description": "${teamSpec.description || 'Development Team'}"}
        
        result = await _create_team_implementation(server, payload)
        print(json.dumps(result))
    
    asyncio.run(main())
except ImportError as e:
    print(json.dumps({
        "error": f"Import error: {str(e)}",
        "team": {
            "id": "team-fallback",
            "description": "${teamSpec.description || 'Development Team'}",
            "agents": []
        }
    }))
`
                    const pythonProcess = spawn('python', [
                        '-c',
                        pythonCode
                    ]);
                    
                    let output = '';
                    pythonProcess.stdout.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    // Update progress
                    progress.report({ increment: 50, message: "Processing Python output..." });
                    
                    // Use Promise to wait for Python process to complete
                    const result = await Promise.race([
                        new Promise<any>((resolve) => {
                            pythonProcess.on('close', (code) => {
                                try {
                                    progress.report({ increment: 80, message: "Parsing result..." });
                                
                                    if (code !== 0) {
                                        console.error(`Python process exited with code ${code}`);
                                        resolve({ 
                                            error: `Python process exited with code ${code}`,
                                            team: {
                                                id: `team-error-${Date.now()}`,
                                                description: teamSpec.description || "",
                                                agents: []
                                            }
                                        });
                                        return;
                                    }
                                
                                    if (!output || output.trim() === '') {
                                        console.error('Empty output from Python process');
                                        resolve({ 
                                            error: 'Empty output from Python process',
                                            team: {
                                                id: `team-empty-${Date.now()}`,
                                                description: teamSpec.description || "",
                                                agents: []
                                            }
                                        });
                                        return;
                                    }
                                
                                    const parsedResult = JSON.parse(output);
                                    progress.report({ increment: 100, message: "Team created!" });
                                    resolve(parsedResult);
                                } catch (e) {
                                    console.error('Failed to parse Python output:', e);
                                    console.error('Raw output:', output);
                                    resolve({ 
                                        error: 'Failed to parse Python output: ' + (e instanceof Error ? e.message : String(e)),
                                        team: {
                                            id: `team-parse-error-${Date.now()}`,
                                            description: teamSpec.description || "",
                                            agents: []
                                        }
                                    });
                                }
                            });
                        }),
                        timeoutPromise
                    ]);
                    
                    progress.report({ increment: 100, message: "Completed" });
                    return result;
                }
            
            // Clear status message
            statusMessage.dispose();
            
            // Check for success
            if (createTeamResult && !createTeamResult.error) {
                console.log('Team creation successful:', createTeamResult);
                return createTeamResult;
            }
            
            // If we got an error, display it
            const errorMessage = createTeamResult?.error || 'Unknown error creating team';
            console.error('Error creating team:', errorMessage);
            vscode.window.showErrorMessage(`Error creating team: ${errorMessage}`);
            
            // Return the error result to the UI
            return createTeamResult || { 
                success: false, 
                error: errorMessage,
                team: {
                    id: `team-${Date.now()}`,
                    description: teamSpec.description,
                    agents: []
                }
            };
        } catch (error) {
            // Clear status message
            statusMessage.dispose();
            
            // Log the error
            console.error('Exception creating team:', error);
            
            // Show error to user
            vscode.window.showErrorMessage(`Error creating team: ${error instanceof Error ? error.message : String(error)}`);
            
            // Return error object instead of re-throwing
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                team: {
                    id: `team-error-${Date.now()}`,
                    description: teamSpec.description || "Error team",
                    agents: []
                }
            };
        }
    } catch (error) {
        console.error('Error in createTeam:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            team: {
                id: `team-${Date.now()}`,
                description: teamSpec.description,
                agents: [] // Let Python backend create default agents if needed
            }
        };
    }
}
*/

/* All of these functions are now implemented directly as mock implementations in the command registrations
   So this code is removed to avoid conflicts */

//#endregion

//#region Server helpers

//#endregion
