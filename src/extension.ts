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

let lsClient: LanguageClient | undefined;
export const activate = errorWrapper(
    async (context: vscode.ExtensionContext): Promise<void> => {
        console.log('Activating Tribe extension');

        try {
            // Initialize error handler
            const errorHandler = ExtensionErrorHandler.getInstance();
            errorHandler.addErrorListener((error) => {
                vscode.window.showErrorMessage(`[${error.code}] ${error.message}`);
            });

            // Initialize storage service
            const storageService = StorageService.getInstance(context);

            // Initialize new services
            NewStorageService.getInstance(context);
            DiffService.getInstance();

            // Register command handlers
            registerChangeCommands(context);
            registerCheckpointCommands(context);
            registerAnnotationCommands(context);
            registerImplementationCommands(context);
            registerConflictCommands(context);
            registerHistoryCommands(context);

            // Create output channel for Tribe commands
            const outputChannel = vscode.window.createOutputChannel('Tribe');
            context.subscriptions.push(outputChannel);

            // Register Enhanced Genesis Agent commands
            context.subscriptions.push(
                vscode.commands.registerCommand('tribe.initialize', async () => {
                    await initializeAgent(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.analyzeProject', async () => {
                    await analyzeProject(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.executeWorkflow', async () => {
                    await executeWorkflow(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.captureExperience', async () => {
                    await captureExperience(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.extractPatterns', async () => {
                    await extractPatterns(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.collectFeedback', async () => {
                    await collectFeedback(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.analyzeFeedback', async () => {
                    await analyzeFeedback(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.createReflection', async () => {
                    await createReflection(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.extractInsights', async () => {
                    await extractInsights(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.createImprovementPlan', async () => {
                    await createImprovementPlan(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.generateOptimizedPrompt', async () => {
                    await generateOptimizedPrompt(outputChannel);
                }),
                vscode.commands.registerCommand('tribe.queryModel', async () => {
                    await queryModel(outputChannel);
                }),
            );

            // Use bundled Python environment
            const extensionPath = context.extensionPath;
            const pythonPath = vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'venv', 'bin', 'python').fsPath;
            traceLog(`Using Python interpreter: ${pythonPath}`);

            // This is required to get server name and module. This should be
            // the first thing that we do in this extension.
            try {
                const serverInfo = loadServerDefaults();
                const serverName = serverInfo.name;
                const serverId = serverInfo.module;

                // Setup logging
                const outputChannel = createOutputChannel(serverName);
                context.subscriptions.push(outputChannel, registerLogger(outputChannel));

                const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
                    const level = getLSClientTraceLevel(c, g);
                    if (lsClient) {
                        // In vscode-languageclient v7.0.0, we need to use the outputChannel directly
                        // as setTrace is not available
                        lsClient.outputChannel.appendLine(`Setting trace level to: ${Trace[level]}`);
                        const client = lsClient as any;
                        if (client._tracer) {
                            client._tracer.trace = level;
                        }
                    }
                };

                vscode.debug.onDidChangeActiveDebugSession(async (e) => {
                    const workspaceFolders = vscode.workspace.workspaceFolders || [];
                    for (const wsFolder of workspaceFolders) {
                        if (e?.configuration.cwd === wsFolder.uri.fsPath) {
                            try {
                                if (lsClient) {
                                    lsClient.sendNotification('debug/refresh');
                                }
                            } catch (err) {
                                traceError(`Failed to get server options: ${err}`);
                            }
                            break;
                        }
                    }
                });

                // Get current logging level
                const logLevelConfig = vscode.workspace.getConfiguration('output', null);
                const currentLogLevel =
                    (await logLevelConfig.get<string>('level')) === 'debug'
                        ? vscode.LogLevel.Debug
                        : vscode.LogLevel.Info;

                // Update log level based on log level configuration changes
                context.subscriptions.push(
                    vscode.workspace.onDidChangeConfiguration((e) => {
                        if (e.affectsConfiguration('output.level')) {
                            const logLevelConfig = vscode.workspace.getConfiguration('output', null);
                            const newLogLevel =
                                logLevelConfig.get<string>('level') === 'debug'
                                    ? vscode.LogLevel.Debug
                                    : vscode.LogLevel.Info;
                            changeLogLevel(newLogLevel, newLogLevel);
                        }
                    }),
                );

                // Register CrewPanel provider
                const crewPanelProvider = new CrewPanelProvider(context.extensionUri, context);
                context.subscriptions.push(
                    vscode.window.registerWebviewViewProvider(CrewPanelProvider.viewType, crewPanelProvider, {
                        webviewOptions: {
                            retainContextWhenHidden: true
                        },
                    }),
                );

                // Command to create a new team
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.createTeam',
                        errorWrapper(
                            async (teamSpec: Record<string, any>): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage(
                                        'Please open a workspace folder before creating a team.',
                                    );
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Create a team with just the VP of Engineering (Genesis agent)
                                // Other agents will be created dynamically via the VP's lambda calls
                                const teamResult = {
                                    success: true,
                                    team: {
                                        id: `team-${Date.now()}`,
                                        name: 'Team ' + (teamSpec.name || 'Untitled'),
                                        description: teamSpec.description || 'A development team',
                                        agents: [
                                            {
                                                id: `agent-vp-${Date.now()}`,
                                                name: 'Tank',
                                                role: 'VP of Engineering',
                                                status: 'active',
                                                backstory:
                                                    'Experienced VP of Engineering with expertise in technical leadership and system architecture. Responsible for bootstrapping the AI agent ecosystem.',
                                                description:
                                                    'As the VP of Engineering, Tank oversees all technical aspects of the project, making high-level architectural decisions and coordinating team efforts.',
                                            },
                                        ],
                                    },
                                };
                                return teamResult;
                            },
                            'CREATE_TEAM_FAILED',
                            ErrorCategory.SYSTEM,
                            'Create a new team of AI agents',
                        ),
                    ),
                );

                // Command to initialize a project
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.initializeProject',
                        errorWrapper(
                            async (config: Record<string, any>): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage(
                                        'Please open a workspace folder before initializing a project.',
                                    );
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is already initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (fs.existsSync(configFilePath)) {
                                    const overwrite = await vscode.window.showWarningMessage(
                                        'Tribe project already initialized. Overwrite?',
                                        'Yes',
                                        'No',
                                    );
                                    if (overwrite !== 'Yes') {
                                        return { success: false, error: 'Project already initialized' };
                                    }
                                }

                                try {
                                    // Show status message while initializing
                                    const initMessage = vscode.window.setStatusBarMessage(
                                        'Initializing project and creating team...',
                                    );

                                    // Create team configuration
                                    // Initialize environment first
                                    await vscode.commands.executeCommand('tribe.env.initialize', config);

                                    // Important: Now instead of just returning hardcoded agents, we'll
                                    // actually initialize the VP of Engineering and generate agents through lambda

                                    // First, create the environment folder
                                    const tribeFolderPath = path.join(workspaceFolder.uri.fsPath, '.tribe');
                                    if (!fs.existsSync(tribeFolderPath)) {
                                        fs.mkdirSync(tribeFolderPath, { recursive: true });
                                    }

                                    // Create initial team JSON with VP agent
                                    const teamId = `team-${Date.now()}`;
                                    const vpAgentId = `agent-vp-${Date.now()}`;

                                    // Call Python to create team using the foundation model
                                    const outputChannel = vscode.window.createOutputChannel('Tribe-Generation');
                                    context.subscriptions.push(outputChannel);
                                    outputChannel.show();
                                    outputChannel.appendLine(
                                        'Creating team with dynamic agents from foundation model...',
                                    );
                                    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';

                                    // Use the project description to generate team
                                    const projectDescription = config.description || 'A new software project';

                                    // First create the config.json with initial state
                                    const initialConfig = {
                                        project: {
                                            id: `project-${Date.now()}`,
                                            name: config.name || 'New Project',
                                            description: projectDescription,
                                            initialized: true,
                                            team: {
                                                id: teamId,
                                                name: `${config.name || 'New'} Team`,
                                                description: `Team for ${projectDescription}`,
                                                agents: [
                                                    {
                                                        id: vpAgentId,
                                                        name: 'Tank',
                                                        role: 'VP of Engineering',
                                                        status: 'active',
                                                        backstory:
                                                            'Experienced VP of Engineering with expertise in technical leadership and system architecture. Responsible for bootstrapping the AI agent ecosystem.',
                                                        description:
                                                            'As the VP of Engineering, Tank oversees all technical aspects of the project, making high-level architectural decisions and coordinating team efforts.',
                                                    },
                                                ],
                                            },
                                        },
                                    };

                                    // Write the initial config
                                    fs.writeFileSync(
                                        path.join(tribeFolderPath, 'config.json'),
                                        JSON.stringify(initialConfig, null, 2),
                                    );

                                    // Clear status message
                                    initMessage.dispose();

                                    // Create the result we'll return
                                    const result = {
                                        success: true,
                                        project: initialConfig.project,
                                    };

                                    // Immediately schedule the background task for after we return
                                    setTimeout(() => {
                                        // Define an async function to handle the team generation
                                        const generateTeam = async () => {
                                            try {
                                                await vscode.window.withProgress(
                                                    {
                                                        location: vscode.ProgressLocation.Notification,
                                                        title: 'Generating AI team members...',
                                                        cancellable: false,
                                                    },
                                                    async (progress) => {
                                                        progress.report({
                                                            increment: 10,
                                                            message: 'Creating team with VP of Engineering...',
                                                        });

                                                        try {
                                                            // Use the Python extension functionality to generate agents
                                                            const extensionPath = context.extensionPath;
                                                            const tribePath = path.join(extensionPath, 'tribe');

                                                            // Execute the Python script with proper arguments
                                                            outputChannel.appendLine(
                                                                'Running Python script to generate team...',
                                                            );

                                                            // Create a Python script file instead of using -c to avoid escaping issues
                                                            const tempScriptContent = `
import sys
import os
import traceback
import json

# Add extension path to Python path
sys.path.append('${extensionPath.replace(/\\/g, '\\\\')}')

try:
    # Import necessary modules
    from tribe.extension import _create_team_implementation, TribeLanguageServer
    import asyncio
    
    # Create server with proper arguments
    server = TribeLanguageServer(name="tribe-ls", version="1.0.0")
    server.workspace_path = '${workspaceFolder.uri.fsPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'
    
    # Set the API endpoint explicitly
    server.ai_api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
    
    # Call team creation function
    project_desc = """${projectDescription.replace(/"/g, '\\"')}"""
    team_result = asyncio.run(_create_team_implementation(server, {'description': project_desc}))
    
    # Print the result as JSON
    print(json.dumps(team_result))
    
except Exception as e:
    # If there's an error, print a structured error object
    error_obj = {
        "error": str(e),
        "traceback": traceback.format_exc(),
        "team": {
            "agents": [
                {
                    "id": "fallback-agent-1",
                    "name": "Spark",
                    "role": "Developer",
                    "status": "active",
                    "backstory": "Created as a fallback when team generation failed.",
                    "description": "A developer created when the foundation model team generation failed."
                }
            ]
        }
    }
    print(json.dumps(error_obj))
`;

                                                            // Write the script to a temporary file
                                                            const tempScriptPath = path.join(
                                                                extensionPath,
                                                                'temp_team_script.py',
                                                            );
                                                            fs.writeFileSync(tempScriptPath, tempScriptContent);

                                                            try {
                                                                // Execute the Python script from the file
                                                                outputChannel.appendLine(
                                                                    `Executing: ${pythonExecutable} ${tempScriptPath}`,
                                                                );
                                                                const { stdout, stderr } = await execAsync(
                                                                    `${pythonExecutable} ${tempScriptPath}`,
                                                                    { cwd: extensionPath },
                                                                );

                                                                // Delete the temporary script
                                                                fs.unlinkSync(tempScriptPath);

                                                                progress.report({
                                                                    increment: 50,
                                                                    message: 'Analyzing team generation results...',
                                                                });

                                                                // Parse the result
                                                                if (stdout) {
                                                                    try {
                                                                        const teamData = JSON.parse(stdout);

                                                                        // Check if we have agents in the response
                                                                        if (
                                                                            teamData &&
                                                                            teamData.team &&
                                                                            teamData.team.agents &&
                                                                            teamData.team.agents.length > 0
                                                                        ) {
                                                                            // Update config with new agents
                                                                            const config = JSON.parse(
                                                                                fs.readFileSync(
                                                                                    path.join(
                                                                                        tribeFolderPath,
                                                                                        'config.json',
                                                                                    ),
                                                                                    'utf8',
                                                                                ),
                                                                            );

                                                                            // Merge the VP with other generated agents
                                                                            const vpAgent =
                                                                                config.project.team.agents[0];
                                                                            config.project.team.agents = [
                                                                                vpAgent,
                                                                                ...teamData.team.agents.filter(
                                                                                    (a: any) =>
                                                                                        a.role !== 'VP of Engineering',
                                                                                ),
                                                                            ];

                                                                            // Write updated config
                                                                            fs.writeFileSync(
                                                                                path.join(
                                                                                    tribeFolderPath,
                                                                                    'config.json',
                                                                                ),
                                                                                JSON.stringify(config, null, 2),
                                                                            );

                                                                            // Update UI with the new agents
                                                                            try {
                                                                                // Notify that agents have changed
                                                                                vscode.commands.executeCommand(
                                                                                    'tribe.refreshAgents',
                                                                                    config.project.team.agents,
                                                                                );

                                                                                // Also try to update the crew panel if it's visible
                                                                                // The panel has its own internal variable _view which may not be
                                                                                // accessible via TypeScript but is documented in the class above
                                                                                if (crewPanelProvider) {
                                                                                    // Using any to bypass TypeScript checking
                                                                                    const provider =
                                                                                        crewPanelProvider as any;
                                                                                    if (
                                                                                        provider._view &&
                                                                                        provider._view.webview
                                                                                    ) {
                                                                                        provider._view.webview.postMessage(
                                                                                            {
                                                                                                type: 'AGENTS_LOADED',
                                                                                                payload:
                                                                                                    config.project.team
                                                                                                        .agents,
                                                                                            },
                                                                                        );
                                                                                    }
                                                                                }
                                                                            } catch (uiError) {
                                                                                outputChannel.appendLine(
                                                                                    `Error updating UI: ${uiError}`,
                                                                                );
                                                                            }

                                                                            progress.report({
                                                                                increment: 40,
                                                                                message: `Created ${config.project.team.agents.length} agent(s)`,
                                                                            });
                                                                        } else {
                                                                            outputChannel.appendLine(
                                                                                'No agents returned from team creation',
                                                                            );
                                                                        }
                                                                    } catch (parseError) {
                                                                        outputChannel.appendLine(
                                                                            `Error parsing team data: ${parseError}`,
                                                                        );
                                                                        outputChannel.appendLine(
                                                                            `Raw output: ${stdout}`,
                                                                        );
                                                                    }
                                                                }

                                                                if (stderr) {
                                                                    outputChannel.appendLine(
                                                                        `Python stderr: ${stderr}`,
                                                                    );
                                                                }
                                                            } catch (error) {
                                                                outputChannel.appendLine(
                                                                    `Error creating dynamic team: ${error}`,
                                                                );
                                                            }
                                                        } catch (error) {
                                                            outputChannel.appendLine(
                                                                `Error in progress execution: ${error instanceof Error ? error.message : String(error)}`,
                                                            );
                                                        }
                                                    },
                                                );
                                            } catch (err) {
                                                outputChannel.appendLine(
                                                    `Error running team generation: ${err instanceof Error ? err.message : String(err)}`,
                                                );
                                            }
                                        };

                                        // Execute the team generation function
                                        generateTeam();
                                    }, 100); // slight delay to ensure we return first

                                    return result;
                                } catch (error) {
                                    console.error('Error in tribe.initializeProject:', error);
                                    return {
                                        success: false,
                                        error: error instanceof Error ? error.message : String(error),
                                    };
                                }
                            },
                            'INITIALIZE_PROJECT_FAILED',
                            ErrorCategory.SYSTEM,
                            'Initialize a new project and create team',
                        ),
                    ),
                );

                // Command to refresh the agents list
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.refreshAgents',
                        errorWrapper(
                            async (agents: any[]): Promise<void> => {
                                console.log('Refreshing agents list with:', agents);
                                // This command just refreshes the UI with new agents
                                // No need to return anything
                            },
                            'REFRESH_AGENTS_FAILED',
                            ErrorCategory.SYSTEM,
                            'Refresh agents list',
                        ),
                    ),
                );

                // Command to get list of available agents
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.getAgents',
                        errorWrapper(
                            async (): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Return mock data for now
                                // Now we'll only hardcode the VP of Engineering (Genesis agent)
                                // Other agents will be created dynamically via the VP's lambda calls
                                const result = {
                                    success: true,
                                    agents: [
                                        {
                                            id: `agent-vp-${Date.now()}`,
                                            name: 'Tank',
                                            role: 'VP of Engineering',
                                            status: 'active',
                                            backstory:
                                                'Experienced VP of Engineering with expertise in technical leadership and system architecture. Responsible for bootstrapping the AI agent ecosystem.',
                                            description:
                                                'As the VP of Engineering, Tank oversees all technical aspects of the project, making high-level architectural decisions and coordinating team efforts.',
                                        },
                                    ],
                                };
                                return result;
                            },
                            'GET_AGENTS_FAILED',
                            ErrorCategory.SYSTEM,
                            'Get list of available agents',
                        ),
                    ),
                );

                // Command to create a new agent
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.createAgent',
                        errorWrapper(
                            async (agentSpec: AgentPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!agentSpec.name || !agentSpec.role) {
                                    return {
                                        success: false,
                                        error: 'Invalid agent specification. Name and role are required.',
                                    };
                                }

                                // Create agent (mock implementation)
                                const result = {
                                    success: true,
                                    agent: {
                                        id: `agent-${Date.now()}`,
                                        name: agentSpec.name,
                                        role: agentSpec.role,
                                        backstory:
                                            agentSpec.backstory ||
                                            `${agentSpec.name} is a ${agentSpec.role} with expertise in various domains.`,
                                    },
                                };
                                return result;
                            },
                            'CREATE_AGENT_FAILED',
                            ErrorCategory.SYSTEM,
                            'Create new agent',
                        ),
                    ),
                );

                // Command to send message to an agent
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.sendAgentMessage',
                        errorWrapper(
                            async (messagePayload: AgentMessagePayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!messagePayload.agentId || !messagePayload.message) {
                                    return {
                                        success: false,
                                        error: 'Invalid message payload. agentId and message are required.',
                                    };
                                }

                                // Send message to agent
                                try {
                                    // Update status in webview
                                    crewPanelProvider.updateMessageStatus({
                                        id: `msg-${Date.now()}`,
                                        agentId: messagePayload.agentId,
                                        status: 'processing',
                                        timestamp: new Date().toISOString(),
                                    });

                                    // Mock implementation
                                    const result = {
                                        success: true,
                                        response: {
                                            id: `msg-${Date.now()}`,
                                            from: messagePayload.agentId,
                                            content: `Mock response to: ${messagePayload.message}`,
                                            timestamp: new Date().toISOString(),
                                        },
                                    };

                                    // Update status in webview
                                    crewPanelProvider.updateMessageStatus({
                                        id: `msg-${Date.now()}`,
                                        agentId: messagePayload.agentId,
                                        status: 'completed',
                                        timestamp: new Date().toISOString(),
                                    });

                                    return result;
                                } catch (error) {
                                    // Update status in webview
                                    crewPanelProvider.updateMessageStatus({
                                        id: `msg-${Date.now()}`,
                                        agentId: messagePayload.agentId,
                                        status: 'failed',
                                        timestamp: new Date().toISOString(),
                                        error: error instanceof Error ? error.message : String(error),
                                    });

                                    throw error;
                                }
                            },
                            'SEND_AGENT_MESSAGE_FAILED',
                            ErrorCategory.SYSTEM,
                            'Send message to agent',
                        ),
                    ),
                );

                // Command to create a task
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.createTask',
                        errorWrapper(
                            async (taskSpec: TaskPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!taskSpec.name || !taskSpec.description || !taskSpec.assignedTo) {
                                    return {
                                        success: false,
                                        error: 'Invalid task specification. Name, description, and assignedTo are required.',
                                    };
                                }

                                // Create task (mock implementation)
                                const result = {
                                    success: true,
                                    task: {
                                        id: `task-${Date.now()}`,
                                        name: taskSpec.name,
                                        description: taskSpec.description,
                                        assignedTo: taskSpec.assignedTo,
                                        status: 'pending',
                                        createdAt: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'CREATE_TASK_FAILED',
                            ErrorCategory.SYSTEM,
                            'Create new task',
                        ),
                    ),
                );

                // Command to record agent feedback
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.recordFeedback',
                        errorWrapper(
                            async (feedbackPayload: FeedbackPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Record feedback (mock implementation)
                                const result = {
                                    success: true,
                                    feedback: {
                                        id: `feedback-${Date.now()}`,
                                        agentId: feedbackPayload.agentId,
                                        actionType: feedbackPayload.actionType,
                                        feedback: feedbackPayload.feedback,
                                        context: feedbackPayload.context,
                                        accepted: feedbackPayload.accepted,
                                        timestamp: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'RECORD_FEEDBACK_FAILED',
                            ErrorCategory.SYSTEM,
                            'Record agent feedback',
                        ),
                    ),
                );

                // Command to set agent autonomy level
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.setAgentAutonomy',
                        errorWrapper(
                            async (autonomyPayload: AutonomyPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (
                                    !autonomyPayload.agentId ||
                                    !autonomyPayload.taskType ||
                                    autonomyPayload.autonomyLevel < 0 ||
                                    autonomyPayload.autonomyLevel > 5
                                ) {
                                    return {
                                        success: false,
                                        error: 'Invalid autonomy payload. agentId, taskType, and autonomyLevel (0-5) are required.',
                                    };
                                }

                                // Set agent autonomy (mock implementation)
                                const result = {
                                    success: true,
                                    autonomy: {
                                        agentId: autonomyPayload.agentId,
                                        taskType: autonomyPayload.taskType,
                                        autonomyLevel: autonomyPayload.autonomyLevel,
                                        supervisionRequirements: autonomyPayload.supervisionRequirements,
                                        updatedAt: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'SET_AGENT_AUTONOMY_FAILED',
                            ErrorCategory.SYSTEM,
                            'Set agent autonomy level',
                        ),
                    ),
                );

                // Command to analyze workflow flows
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.analyzeFlows',
                        errorWrapper(
                            async (flowPayload: FlowPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!flowPayload.requirements) {
                                    return {
                                        success: false,
                                        error: 'Invalid flow payload. requirements are required.',
                                    };
                                }

                                // Analyze workflow flows (mock implementation)
                                const result = {
                                    success: true,
                                    analysis: {
                                        requirements: flowPayload.requirements,
                                        context: flowPayload.context,
                                        recommendedFlows: [
                                            {
                                                id: 'flow-1',
                                                name: 'Sequential Flow',
                                                description: 'A simple sequential workflow with linear progression.',
                                                suitabilityScore: 0.8,
                                            },
                                            {
                                                id: 'flow-2',
                                                name: 'Parallel Flow',
                                                description: 'A workflow with parallel task execution for efficiency.',
                                                suitabilityScore: 0.7,
                                            },
                                        ],
                                        timestamp: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'ANALYZE_FLOWS_FAILED',
                            ErrorCategory.SYSTEM,
                            'Analyze workflow flows',
                        ),
                    ),
                );

                // Command to generate a new workflow flow
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.generateFlow',
                        errorWrapper(
                            async (flowPayload: FlowPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!flowPayload.requirements) {
                                    return {
                                        success: false,
                                        error: 'Invalid flow payload. requirements are required.',
                                    };
                                }

                                // Generate workflow flow (mock implementation)
                                const result = {
                                    success: true,
                                    flow: {
                                        id: `flow-${Date.now()}`,
                                        name: 'Generated Flow',
                                        description: 'Automatically generated workflow flow',
                                        requirements: flowPayload.requirements,
                                        context: flowPayload.context,
                                        steps: [
                                            {
                                                id: 'step-1',
                                                name: 'Design',
                                                description: 'Design the solution',
                                                assignee: 'Designer',
                                                dependencies: [],
                                            },
                                            {
                                                id: 'step-2',
                                                name: 'Implement',
                                                description: 'Implement the solution',
                                                assignee: 'Developer',
                                                dependencies: ['step-1'],
                                            },
                                            {
                                                id: 'step-3',
                                                name: 'Test',
                                                description: 'Test the solution',
                                                assignee: 'Tester',
                                                dependencies: ['step-2'],
                                            },
                                        ],
                                        createdAt: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'GENERATE_FLOW_FAILED',
                            ErrorCategory.SYSTEM,
                            'Generate new workflow flow',
                        ),
                    ),
                );

                // Command to execute a workflow flow
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.executeFlow',
                        errorWrapper(
                            async (flowId: string): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!flowId) {
                                    return {
                                        success: false,
                                        error: 'Invalid input. flowId is required.',
                                    };
                                }

                                // Execute workflow flow (mock implementation)
                                const result = {
                                    success: true,
                                    execution: {
                                        id: `exec-${Date.now()}`,
                                        flowId: flowId,
                                        status: 'started',
                                        steps: [
                                            {
                                                id: 'step-1',
                                                status: 'pending',
                                                startTime: new Date().toISOString(),
                                            },
                                        ],
                                        startTime: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'EXECUTE_FLOW_FAILED',
                            ErrorCategory.SYSTEM,
                            'Execute workflow flow',
                        ),
                    ),
                );

                // Command to create a new workflow
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.createWorkflow',
                        errorWrapper(
                            async (workflowPayload: WorkflowPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (
                                    !workflowPayload.name ||
                                    !workflowPayload.description ||
                                    !workflowPayload.steps ||
                                    workflowPayload.steps.length === 0
                                ) {
                                    return {
                                        success: false,
                                        error: 'Invalid workflow payload. name, description, and steps are required.',
                                    };
                                }

                                // Create workflow (mock implementation)
                                const result = {
                                    success: true,
                                    workflow: {
                                        id: `workflow-${Date.now()}`,
                                        name: workflowPayload.name,
                                        description: workflowPayload.description,
                                        steps: workflowPayload.steps,
                                        checkpoints: workflowPayload.checkpoints,
                                        requiredApprovals: workflowPayload.requiredApprovals,
                                        createdAt: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'CREATE_WORKFLOW_FAILED',
                            ErrorCategory.SYSTEM,
                            'Create new workflow',
                        ),
                    ),
                );

                // Command to generate code based on requirements
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.generateCode',
                        errorWrapper(
                            async (codePayload: CodePayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Check if project is initialized
                                const workspaceFolder = vscode.workspace.workspaceFolders![0];
                                const configFilePath = path.join(workspaceFolder.uri.fsPath, '.tribe', 'config.json');
                                if (!fs.existsSync(configFilePath)) {
                                    vscode.window.showErrorMessage('Please initialize a Tribe project first.');
                                    return { success: false, error: 'Project not initialized' };
                                }

                                // Validate input
                                if (!codePayload.requirements || !codePayload.language || !codePayload.outputFile) {
                                    return {
                                        success: false,
                                        error: 'Invalid code payload. requirements, language, and outputFile are required.',
                                    };
                                }

                                // Generate code (mock implementation)
                                const result = {
                                    success: true,
                                    code: {
                                        language: codePayload.language,
                                        framework: codePayload.framework,
                                        outputFile: codePayload.outputFile,
                                        content: `// Generated code for ${codePayload.requirements}\n// Using ${codePayload.language} ${codePayload.framework || ''}\n\n// Sample code\nconsole.log('Hello, world!');`,
                                        createdAt: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'GENERATE_CODE_FAILED',
                            ErrorCategory.SYSTEM,
                            'Generate code based on requirements',
                        ),
                    ),
                );

                // Command to analyze project requirements
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.analyzeRequirements',
                        errorWrapper(
                            async (requirementsPayload: RequirementsPayload): Promise<Record<string, any>> => {
                                // Ensure a workspace folder is open
                                if (!hasWorkspaceFolder()) {
                                    vscode.window.showErrorMessage('Please open a workspace folder first.');
                                    return { success: false, error: 'No workspace folder open' };
                                }

                                // Validate input
                                if (!requirementsPayload.requirements) {
                                    return {
                                        success: false,
                                        error: 'Invalid requirements payload. requirements field is required.',
                                    };
                                }

                                // Analyze requirements (mock implementation)
                                const result = {
                                    success: true,
                                    analysis: {
                                        requirements: requirementsPayload.requirements,
                                        technicalComponents: [
                                            { name: 'User Authentication', priority: 'high', complexity: 'medium' },
                                            { name: 'Data Storage', priority: 'high', complexity: 'low' },
                                            { name: 'API Integration', priority: 'medium', complexity: 'high' },
                                        ],
                                        recommendedTechnologies: {
                                            languages: ['TypeScript', 'Python'],
                                            frameworks: ['React', 'Flask'],
                                            databases: ['PostgreSQL'],
                                        },
                                        timeline: {
                                            estimated: '4 weeks',
                                            breakdown: {
                                                planning: '1 week',
                                                development: '2 weeks',
                                                testing: '1 week',
                                            },
                                        },
                                        createdAt: new Date().toISOString(),
                                    },
                                };
                                return result;
                            },
                            'ANALYZE_REQUIREMENTS_FAILED',
                            ErrorCategory.SYSTEM,
                            'Analyze project requirements',
                        ),
                    ),
                );

                // Initialize the tribe environment
                context.subscriptions.push(
                    vscode.commands.registerCommand(
                        'tribe.env.initialize',
                        errorWrapper(
                            async (params?: Record<string, any>): Promise<Record<string, any>> => {
                                try {
                                    traceLog('Initializing tribe environment');

                                    // Get the first workspace folder
                                    if (
                                        !vscode.workspace.workspaceFolders ||
                                        vscode.workspace.workspaceFolders.length === 0
                                    ) {
                                        return {
                                            success: false,
                                            error: 'No workspace folder open',
                                        };
                                    }

                                    const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
                                    traceLog(`Workspace folder: ${workspaceFolder}`);

                                    // For debugging
                                    outputChannel.appendLine(`Workspace folder: ${workspaceFolder}`);

                                    // Create .tribe folder in workspace root if it doesn't exist
                                    const tribeFolderPath = path.join(workspaceFolder, '.tribe');
                                    if (!fs.existsSync(tribeFolderPath)) {
                                        fs.mkdirSync(tribeFolderPath);
                                    }

                                    return {
                                        success: true,
                                    };
                                } catch (error) {
                                    traceError('Failed to initialize tribe environment', error);
                                    return {
                                        success: false,
                                        error: error instanceof Error ? error.message : String(error),
                                    };
                                }
                            },
                            'INITIALIZE_ENVIRONMENT_FAILED',
                            ErrorCategory.SYSTEM,
                            'Initialize the tribe environment',
                        ),
                    ),
                );

                const updateMessageStatus = errorWrapper(
                    async (message: any) => {
                        crewPanelProvider.updateMessageStatus(message);
                    },
                    'UPDATE_MESSAGE_STATUS_FAILED',
                    ErrorCategory.SYSTEM,
                    'Update message status in webview',
                );

                // Create a dedicated function for handling message updates from the language server
                const handleServerStatusUpdates = async (params: any) => {
                    try {
                        const { type, data } = params;

                        if (type === 'message_status') {
                            await updateMessageStatus(data);
                        }
                    } catch (error) {
                        traceError('Failed to handle server status update', error);
                    }
                };

                // Start the language server
                const startServer = errorWrapper(
                    async () => {
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (!workspaceFolders || workspaceFolders.length === 0) {
                                traceLog('No workspace folders found. Server will not be started.');
                                return;
                            }

                            // When in development mode, launch the server locally
                            const isDevelopment = true; // For debugging
                            if (isDevelopment) {
                                const entryPointScript = path.join(
                                    context.extensionPath,
                                    'bundled',
                                    'tool',
                                    'lsp_server.py',
                                );

                                // Find appropriate Python interpreter
                                let pythonPath = 'python3';
                                try {
                                    // Check if system Python exists
                                    const { stdout } = await execAsync('which python3 || which python').catch(() => ({
                                        stdout: '',
                                    }));
                                    if (stdout && stdout.trim()) {
                                        pythonPath = stdout.trim();
                                        traceLog(`Using system Python: ${pythonPath}`);
                                    }
                                } catch (error) {
                                    traceLog(`Error finding system Python: ${error}`);
                                    // Continue with default python3
                                }

                                // Set up environment variables to help the server find modules
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
                                    extensionPaths.join(path.delimiter) +
                                    (process.env.PYTHONPATH ? path.delimiter + process.env.PYTHONPATH : '');

                                // Set import strategy to fromEnvironment
                                newEnv.LS_IMPORT_STRATEGY = 'fromEnvironment';

                                // Add more verbose logging
                                newEnv.PYTHONVERBOSE = '1';
                                newEnv.LS_SHOW_NOTIFICATION = 'always';

                                traceLog(`PYTHONPATH: ${newEnv.PYTHONPATH}`);
                                traceLog(`Python interpreter: ${pythonPath}`);

                                const serverOptions: ServerOptions = {
                                    command: pythonPath,
                                    args: [
                                        entryPointScript,
                                        '--log-file',
                                        path.join(context.extensionPath, 'tribe-server.log'),
                                    ],
                                    options: {
                                        cwd: path.dirname(entryPointScript),
                                        env: newEnv,
                                    },
                                };

                                // Client options
                                const clientOptions: LanguageClientOptions = {
                                    documentSelector: [{ language: '*' }],
                                    outputChannel,
                                    traceOutputChannel: outputChannel,
                                    synchronize: {
                                        configurationSection: 'tribe',
                                    },
                                };

                                // Create the language client and start the client.
                                lsClient = new LanguageClient(
                                    'tribe',
                                    'Tribe Language Server',
                                    serverOptions,
                                    clientOptions,
                                );

                                // Register handler for notification messages from server
                                lsClient.onReady().then(() => {
                                    lsClient?.onNotification('tribe/statusUpdate', handleServerStatusUpdates);
                                });

                                // Start the client. This will also launch the server
                                context.subscriptions.push(lsClient.start());
                                traceLog('Tribe Language Server started in development mode');
                            }
                        } catch (error) {
                            traceError('Failed to start language server', error);
                            throw error;
                        }
                    },
                    'SERVER_INIT_FAILED',
                    ErrorCategory.SYSTEM,
                    'Server initialization',
                );

                // Register commands and handlers
                context.subscriptions.push(
                    onDidChangePythonInterpreter(async () => {
                        errorWrapper(
                            async () => {
                                await restartServer(serverId, pythonPath, outputChannel, lsClient);
                            },
                            'INTERPRETER_CHANGE_FAILED',
                            ErrorCategory.SYSTEM,
                            'Python interpreter change handler',
                        )();
                    }),
                    onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
                        errorWrapper(
                            async () => {
                                if (checkIfConfigurationChanged(e, serverId)) {
                                    await restartServer(serverId, pythonPath, outputChannel, lsClient);
                                }
                            },
                            'CONFIG_CHANGE_FAILED',
                            ErrorCategory.SYSTEM,
                            'Configuration change handler',
                        )();
                    }),
                    registerCommand(`${serverId}.restart`, async () => {
                        errorWrapper(
                            async () => {
                                traceLog('Manual server restart requested');

                                // First try to get a system Python
                                let systemPythonPath = 'python3';
                                try {
                                    const { stdout } = await execAsync('which python3 || which python').catch(() => ({
                                        stdout: '',
                                    }));
                                    if (stdout && stdout.trim()) {
                                        systemPythonPath = stdout.trim();
                                        traceLog(`Using system Python for restart: ${systemPythonPath}`);
                                    }
                                } catch (error) {
                                    traceLog(`Error finding system Python for restart: ${error}`);
                                }

                                // Attempt server restart with more detailed logging
                                try {
                                    vscode.window.showInformationMessage('Restarting Tribe Language Server...');
                                    await restartServer(serverId, systemPythonPath, outputChannel, lsClient);
                                    vscode.window.showInformationMessage(
                                        'Tribe Language Server restarted successfully',
                                    );
                                } catch (error) {
                                    traceError(`Server restart failed: ${error}`);
                                    vscode.window.showErrorMessage(
                                        `Failed to restart server: ${error instanceof Error ? error.message : String(error)}`,
                                    );

                                    // If restart fails, try reinstantiating the client completely
                                    try {
                                        traceLog('Attempting full client reinstantiation');
                                        if (lsClient) {
                                            // Dispose the client properly
                                            if (
                                                (lsClient as any)._state !== undefined &&
                                                (lsClient as any)._state !== State.Stopped
                                            ) {
                                                await lsClient.stop();
                                            }
                                            // Instead of using dispose directly, we use stop() which already handles proper cleanup
                                            // as dispose() is not available on the LanguageClient type
                                        }

                                        // Create a new client
                                        lsClient = undefined;
                                        await startServer();
                                        vscode.window.showInformationMessage(
                                            'Tribe Language Server reinstantiated successfully',
                                        );
                                    } catch (reinstantiateError) {
                                        traceError(`Server reinstantiation failed: ${reinstantiateError}`);
                                        vscode.window.showErrorMessage(
                                            `Failed to reinstantiate server. Please reload VS Code window.`,
                                        );
                                    }
                                }
                            },
                            'SERVER_RESTART_FAILED',
                            ErrorCategory.SYSTEM,
                            'Server restart command',
                        )();
                    }),
                );

                await startServer();
            } catch (error) {
                traceError('Failed to activate extension', error);
                throw error;
            }
        } catch (error) {
            console.error('Error activating Tribe extension:', error);
            throw error;
        }
    },
    'EXTENSION_ACTIVATION_FAILED',
    ErrorCategory.SYSTEM,
    'Extension activation',
);

export const deactivate = errorWrapper(
    async () => {
        if (lsClient) {
            await lsClient.stop();
        }
    },
    'EXTENSION_DEACTIVATION_FAILED',
    ErrorCategory.SYSTEM,
    'Extension deactivation',
);

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
