/* eslint-disable header/header */

import * as vscode from 'vscode';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as path from 'path';
import { API_ENDPOINTS } from './config';
import { StorageService } from './storage';
import { ExtensionErrorHandler, ErrorSeverity, createError, errorWrapper } from './errorHandling';
import { registerChangeCommands } from './commands/changeCommands';
import { registerCheckpointCommands } from './commands/checkpointCommands';
import { registerAnnotationCommands } from './commands/annotationCommands';
import { registerImplementationCommands } from './commands/implementationCommands';
import { registerConflictCommands } from './commands/conflictCommands';
import { registerHistoryCommands } from './commands/historyCommands';
import { DiffService } from './services/diffService';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
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
					await lsClient?.setTrace(level);
				};

				context.subscriptions.push(
					outputChannel.onDidChangeLogLevel(async (e) => {
						await changeLogLevel(e, vscode.env.logLevel);
					}),
					vscode.env.onDidChangeLogLevel(async (e) => {
						await changeLogLevel(outputChannel.logLevel, e);
					}),
				);

				// Log Server information
				traceLog(`Name: ${serverInfo.name}`);
				traceLog(`Module: ${serverInfo.module}`);
				traceVerbose(`Full Server Info: ${JSON.stringify(serverInfo)}`);

				// Register CrewPanel commands
				const commands = [
					vscode.commands.registerCommand(
						'tribe.createTeam',
						errorWrapper(
							async (payload: { description: string }): Promise<any> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import json
import sys
import os
import asyncio
import uuid
from tribe import Tribe
from tribe.tools.agents import Agent

async def create_agent(tribe, spec):
    """Create an agent with error handling"""
    try:
        print(f"Creating agent with role: {spec['role']}", file=sys.stderr)
        
        # Create agent using Agent class directly
        agent = Agent(
            role=spec['role'],
            goal=spec['goal'],
            backstory=spec['backstory'],
            verbose=True,
            allow_delegation=True
        )
        
        # Add agent to tribe's crew
        tribe.crew.add_agent(agent)
        
        print(f"Agent creation successful for {spec['role']}", file=sys.stderr)
        return {
            'id': str(uuid.uuid4()),
            'role': spec['role'],
            'status': 'active'
        }
    except Exception as e:
        print(f"Error creating agent {spec['role']}: {str(e)}", file=sys.stderr)
        return None

async def main():
    try:
        # Get API endpoint from environment
        api_endpoint = os.environ.get('AI_API_ENDPOINT')
        if not api_endpoint:
            api_endpoint = "https://teqheaidyjmkjwkvkde65rfmo40epndv.lambda-url.eu-west-3.on.aws/"
            print(f"Using default API endpoint: {api_endpoint}", file=sys.stderr)
        else:
            print(f"Using API endpoint from environment: {api_endpoint}", file=sys.stderr)

        # Initialize Tribe with complete configuration
        config = {
            'api_endpoint': api_endpoint,
            'function_calling_llm': None,
            'manager_llm': None,
            'embedder': None,
            'planning_llm': None,
            'memory': None,
            'memory_config': None,
            'cache': True,
            'verbose': True,
            'process': 'hierarchical',
            'share_crew': True,
            'language': 'en',
            'full_output': False,
            'debug': True,
            'max_rpm': 60,
            'collaboration_mode': 'HYBRID',
            'task_execution_mode': {
                'allow_parallel': True,
                'allow_delegation': True,
                'max_concurrent_tasks': 10,
                'retry_failed_tasks': True,
                'max_retries': 3,
                'use_enhanced_scheduling': True
            }
        }
        
        print("Creating Tribe instance with config...", file=sys.stderr)
        tribe = await Tribe.create(config=config)
        
        print("Creating team...", file=sys.stderr)
        result = await tribe.crew.create_team(${JSON.stringify(payload.description)})
        print(f"Team creation result: {result}", file=sys.stderr)
        
        # Get the team ID from the result
        team_id = result.get('team', {}).get('id')
        
        # Create additional agents based on project requirements
        agent_specs = [
            {
                "name": "Project Manager",
                "role": "Project Manager",
                "goal": "Manage project tasks and coordinate team efforts",
                "backstory": "Expert in project management and team coordination"
            },
            {
                "name": "Developer",
                "role": "Developer",
                "goal": "Implement project features and write code",
                "backstory": "Skilled software developer with expertise in multiple languages"
            },
            {
                "name": "Architect",
                "role": "Architect",
                "goal": "Design system architecture and make technical decisions",
                "backstory": "Experienced software architect with focus on scalable systems"
            },
            {
                "role": "QA Engineer",
                "goal": "Ensure code quality and test coverage",
                "backstory": "Quality assurance expert with focus on automated testing"
            }
        ]
        
        # Create agents concurrently
        tasks = [create_agent(tribe, spec) for spec in agent_specs]
        created_agents = await asyncio.gather(*tasks)
        
        # Filter out failed agent creations and add to result
        created_agents = [agent for agent in created_agents if agent is not None]
        if created_agents:
            if 'team' in result:
                result['team']['agents'].extend(created_agents)
        
        print(f"Final team result: {result}", file=sys.stderr)
        print(json.dumps(result))
        
    except Exception as e:
        error_msg = f"Error creating team: {str(e)}"
        print(f"Exception details: {str(e.__class__.__name__)}: {str(e)}", file=sys.stderr)
        print(json.dumps({'error': error_msg}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											if (data.error) {
												reject(new Error(data.error));
											} else {
												resolve(data);
											}
										} catch (e) {
											reject(new Error('Failed to parse team creation response'));
										}
									});
								});
							},
							'CREATE_TEAM',
							'Create a new team of AI agents',
						),
					),

					vscode.commands.registerCommand(
						'tribe.initializeProject',
						errorWrapper(
							async (payload: {
								description: string;
							}): Promise<{ id: string; vision: string; response: string }> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}",
    json={
        "messages": [
            {
                "role": "system",
                "content": "You are the VP of Engineering, responsible for analyzing project requirements and creating the optimal team of AI agents, describing the initial set of tools, assigning tasks to the team, and creating initial workflow"
            },
            {
                "role": "user",
                "content": "${payload.description}"
            }
        ]
    }
)
print(json.dumps(response.json()))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											const response = data.choices?.[0]?.message?.content;
											resolve({
												id: Date.now().toString(),
												vision: payload.description,
												response,
											});
										} catch (e) {
											reject(new Error('Failed to initialize project'));
										}
									});
								});
							},
							'INITIALIZE_PROJECT',
							'Initialize a new project and create team',
						),
					),

					vscode.commands.registerCommand(
						'tribe.getAgents',
						errorWrapper(
							async (): Promise<any[]> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

try:
    response = requests.get("${API_ENDPOINTS.AI_API}/agents")
    data = response.json()
    print(json.dumps(data))
except Exception as e:
    print(json.dumps({"error": str(e), "agents": []}))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											// If we have mock data for testing, use it
											if (
												process.env.NODE_ENV === 'development' &&
												(!data.agents || data.agents.length === 0)
											) {
												resolve([
													{ id: 'agent-1', name: 'Developer', role: 'Developer' },
													{ id: 'agent-2', name: 'Designer', role: 'Designer' },
													{ id: 'agent-3', name: 'Product Manager', role: 'Product Manager' },
													{ id: 'agent-4', name: 'QA Engineer', role: 'QA Engineer' },
													{ id: 'agent-5', name: 'DevOps Engineer', role: 'DevOps Engineer' },
												]);
											} else {
												resolve(data.agents || []);
											}
										} catch (e) {
											console.error('Failed to parse agent list:', e);
											reject(new Error('Failed to parse agent list'));
										}
									});
								});
							},
							'GET_AGENTS',
							'Get list of available agents',
						),
					),

					vscode.commands.registerCommand(
						'tribe.createAgent',
						errorWrapper(
							async (
								payload: AgentPayload,
							): Promise<{
								id: string;
								name: string;
								role: string;
								status: string;
								backstory: string;
							}> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/agent/create",
    json={
        "name": "${payload.name}",
        "role": "${payload.role}",
        "backstory": "${payload.backstory}"
    }
)
print(json.dumps(response.json()))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data.agent || {
													id: '',
													name: payload.name,
													role: payload.role,
													status: 'error',
													backstory: payload.backstory,
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse agent creation response'));
										}
									});
								});
							},
							'CREATE_AGENT',
							'Create new agent',
						),
					),

					vscode.commands.registerCommand(
						'tribe.sendAgentMessage',
						errorWrapper(
							async (payload: AgentMessagePayload): Promise<any> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonScript = `
import requests, json, sys, uuid
from datetime import datetime
from tribe.core.dynamic import DynamicAgent
from tribe.tools.system_tools import SystemAccessManager
import asyncio

# Get payload parameters from command line arguments
agent_id = sys.argv[1]
message = sys.argv[2]
is_vp_message = sys.argv[3].lower() == "true"
is_team_message = sys.argv[4].lower() == "true"
is_initialization = sys.argv[5].lower() == "true"

async def check_system_access():
    """Check access to all systems"""
    system_manager = SystemAccessManager()
    agent = DynamicAgent(role="VP of Engineering")
    system_access = {}

    for system_name in ["learning_system", "project_management", "collaboration_tools"]:
        tool = system_manager.get_tool(system_name)
        if tool:
            access_info = await tool.execute(agent_role=agent.role)
            system_access[system_name] = access_info

    return system_access

try:
    # Get system access using asyncio
    system_access = asyncio.run(check_system_access())

    # Send request to API
    body = json.dumps({
        "messages": [
            {
                "role": "system",
                "content": f"You are responding as {agent_id}. Your responses should be based on the following verified system access:\\n{json.dumps(system_access, indent=2)}\\n\\nOnly claim access to systems that are verified above. If asked about system access, provide specific details from the verification results."
            },
            {
                "role": "user",
                "content": message
            }
        ],
        "agentId": agent_id,
        "isVPMessage": is_vp_message,
        "isTeamMessage": is_team_message,
        "is_initialization": is_initialization,
        "system_access": system_access
    })

    response = requests.post("${API_ENDPOINTS.AI_API}", data=body, headers={'Content-Type': 'application/json'}, timeout=30)
    
    if not response.ok:
        print(json.dumps({
            "type": "ERROR",
            "payload": f"API request failed: {response.status_code} - {response.text}"
        }))
        sys.exit(1)

    try:
        # Parse the response
        response_data = response.json()
        message_content = response_data.get("body", "No response received")
        if isinstance(message_content, str):
            message_content = message_content.strip('"')

        # Create response message
        print(json.dumps({
            "type": "MESSAGE_RESPONSE",
            "payload": {
                "id": str(uuid.uuid4()),
                "sender": agent_id,
                "content": message_content,
                "timestamp": datetime.now().isoformat(),
                "type": "agent",
                "targetAgent": agent_id,
                "isVPResponse": is_vp_message,
                "isManagerResponse": is_team_message,
                "isTeamMessage": is_team_message,
                "isSelfReferential": any(keyword in message_content.lower() for keyword in ["your role", "your capabilities", "what can you do", "who are you", "access", "system", "learning", "project management"]),
                "systemAccessVerified": True if agent_id == "VP of Engineering" else False,
                "availableTools": list(system_access.keys())
            }
        }))

    except Exception as e:
        print(json.dumps({
            "type": "ERROR",
            "payload": f"Failed to create response: {str(e)}"
        }))
        sys.exit(1)

except requests.RequestException as e:
    print(json.dumps({
        "type": "ERROR",
        "payload": f"Network error: {str(e)}"
    }))
    sys.exit(1)

except Exception as e:
    print(json.dumps({
        "type": "ERROR",
        "payload": f"Unexpected error: {str(e)}"
    }))
    sys.exit(1)
`;

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										pythonScript,
										payload.agentId,
										payload.message,
										String(payload.isVPMessage || false),
										String(payload.isTeamMessage || false),
										String(payload.is_initialization || false),
									],
									spawnOptions,
								);

								// Create a wrapper that handles loading states
								return new Promise((resolve, reject) => {
									// Generate a unique message ID for tracking
									const messageId = Date.now().toString();

									// Immediately resolve with a loading state
									const loadingIndicator = {
										type: 'LOADING_INDICATOR',
										payload: {
											id: messageId,
											sender: payload.agentId,
											targetAgent: payload.agentId,
											isVPResponse: payload.isVPMessage || false,
											isTeamMessage: payload.isTeamMessage || false,
											isLoading: true,
										},
									};

									console.log('Sending loading indicator:', loadingIndicator);
									resolve(loadingIndicator);

									let result = '';
									let error = '';

									// Collect the actual response
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});

									pythonProcess.stderr.on('data', (data: Buffer) => {
										error += data.toString();
										console.error(`Agent message error: ${data}`);
									});

									pythonProcess.on('close', async (code: number) => {
										if (code !== 0) {
											// Send error state
											console.log('Sending error message and hiding loading indicator');
											vscode.commands.executeCommand('tribe.updateMessage', {
												type: 'MESSAGE_RESPONSE',
												payload: {
													id: messageId, // Use the same ID for tracking
													sender: payload.agentId,
													content: `Error: ${error}`,
													timestamp: new Date().toISOString(),
													type: 'agent',
													targetAgent: payload.agentId,
													isError: true,
													isVPResponse: payload.isVPMessage || false,
													isTeamMessage: payload.isTeamMessage || false,
												},
												hideLoading: true,
											});
											return;
										}

										try {
											const response = JSON.parse(result);
											if (response.type === 'ERROR') {
												// Send error state
												console.log('Sending error response and hiding loading indicator');
												vscode.commands.executeCommand('tribe.updateMessage', {
													type: 'MESSAGE_RESPONSE',
													payload: {
														id: messageId, // Use the same ID for tracking
														sender: payload.agentId,
														content: response.payload,
														timestamp: new Date().toISOString(),
														type: 'agent',
														targetAgent: payload.agentId,
														isError: true,
														isVPResponse: payload.isVPMessage || false,
														isTeamMessage: payload.isTeamMessage || false,
													},
													hideLoading: true,
												});
											} else {
												// Ensure we have content before sending
												const content = response.payload?.content;
												if (!content || content.trim() === '') {
													console.log('Received empty content, sending error message');
													vscode.commands.executeCommand('tribe.updateMessage', {
														type: 'MESSAGE_RESPONSE',
														payload: {
															id: messageId, // Use the same ID for tracking
															sender: payload.agentId,
															content:
																"I apologize, but I couldn't generate a proper response. Please try again.",
															timestamp: new Date().toISOString(),
															type: 'agent',
															targetAgent: payload.agentId,
															isError: true,
															isVPResponse: payload.isVPMessage || false,
															isTeamMessage: payload.isTeamMessage || false,
														},
														hideLoading: true,
													});
													return;
												}

												// Send complete state and hide loading indicator
												console.log('Sending successful response and hiding loading indicator');
												vscode.commands.executeCommand('tribe.updateMessage', {
													...response,
													payload: {
														...response.payload,
														id: messageId, // Use the same ID for tracking
													},
													hideLoading: true,
												});
											}
										} catch (e) {
											// Send error state
											console.log('Sending parse error and hiding loading indicator');
											vscode.commands.executeCommand('tribe.updateMessage', {
												type: 'MESSAGE_RESPONSE',
												payload: {
													id: messageId, // Use the same ID for tracking
													sender: payload.agentId,
													content: `Failed to parse response: ${result}`,
													timestamp: new Date().toISOString(),
													type: 'agent',
													targetAgent: payload.agentId,
													isError: true,
													isVPResponse: payload.isVPMessage || false,
													isTeamMessage: payload.isTeamMessage || false,
												},
												hideLoading: true,
											});
										}
									});
								});
							},
							'SEND_AGENT_MESSAGE',
							'Send message to agent',
						),
					),

					vscode.commands.registerCommand(
						'tribe.createTask',
						errorWrapper(
							async (
								payload: TaskPayload,
							): Promise<{
								id: string;
								name: string;
								status: string;
								assignedTo: string;
								description: string;
							}> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/task/create",
    json={
        "type": "create_task",
        "description": "${payload.description}",
        "assigned_to": "${payload.assignedTo}",
        "name": "${payload.name}"
    }
)
print(json.dumps(response.json()))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data.task || {
													id: '',
													name: payload.name,
													status: 'error',
													assignedTo: payload.assignedTo,
													description: payload.description,
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse task creation response'));
										}
									});
								});
							},
							'CREATE_TASK',
							'Create new task',
						),
					),

					vscode.commands.registerCommand(
						'tribe.recordFeedback',
						errorWrapper(
							async (payload: FeedbackPayload): Promise<Record<string, unknown>> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/feedback/record",
    json={
        "type": "record_feedback",
        "agent_id": "${payload.agentId}",
        "action_type": "${payload.actionType}",
        "feedback": ${JSON.stringify(payload.feedback)},
        "context": ${JSON.stringify(payload.context)},
        "accepted": ${payload.accepted}
    }
)
print(json.dumps({ "result": response.json() }))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data.result || {
													status: 'error',
													message: 'Failed to record feedback',
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse feedback recording response'));
										}
									});
								});
							},
							'RECORD_FEEDBACK',
							'Record agent feedback',
						),
					),

					vscode.commands.registerCommand(
						'tribe.setAutonomyLevel',
						errorWrapper(
							async (payload: AutonomyPayload): Promise<Record<string, unknown>> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/autonomy/set",
    json={
        "type": "set_autonomy",
        "agent_id": "${payload.agentId}",
        "task_type": "${payload.taskType}",
        "autonomy_level": ${payload.autonomyLevel},
        "supervision_requirements": ${JSON.stringify(payload.supervisionRequirements)}
    }
)
print(json.dumps({ "result": response.json() }))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data.result || {
													status: 'error',
													message: 'Failed to set autonomy level',
													agent_id: payload.agentId,
													autonomy_level: payload.autonomyLevel,
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse autonomy level response'));
										}
									});
								});
							},
							'SET_AUTONOMY',
							'Set agent autonomy level',
						),
					),

					vscode.commands.registerCommand(
						'tribe.analyzeFlows',
						errorWrapper(
							async (): Promise<{ suggestions: Record<string, unknown>[] }> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.get("${API_ENDPOINTS.AI_API}/flows/analyze")
suggestions = response.json().get('suggestions', [])

print(json.dumps({"suggestions": suggestions}))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data || {
													suggestions: [],
													status: 'error',
													message: 'Failed to analyze flows',
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse flow analysis response'));
										}
									});
								});
							},
							'ANALYZE_FLOWS',
							'Analyze workflow flows',
						),
					),

					vscode.commands.registerCommand(
						'tribe.generateFlow',
						errorWrapper(
							async (
								payload: FlowPayload,
							): Promise<{
								flow_id: string;
								steps: string[];
								requirements: Record<string, unknown>;
								context: Record<string, unknown>;
							}> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/flow/generate",
    json={
        "requirements": ${JSON.stringify(payload.requirements)},
        "context": ${JSON.stringify(payload.context)}
    }
)

result = response.json()
flow_id = result.get('flow_id')
steps = result.get('steps', [])

output = {
    "flow_id": flow_id,
    "steps": steps,
    "requirements": payload.requirements,
    "context": payload.context
}

print(json.dumps(output))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data || {
													flow_id: '',
													steps: [],
													requirements: payload.requirements,
													context: payload.context,
													status: 'error',
													message: 'Failed to generate flow',
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse flow generation response'));
										}
									});
								});
							},
							'GENERATE_FLOW',
							'Generate new workflow flow',
						),
					),

					vscode.commands.registerCommand(
						'tribe.executeFlow',
						errorWrapper(
							async (payload: {
								flowId: string;
								initialState: Record<string, unknown>;
							}): Promise<{
								result: unknown;
								state: Record<string, unknown>;
								visualizations: unknown[];
							}> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/flow/execute",
    json={
        "flow_id": "${payload.flowId}",
        "initial_state": ${JSON.stringify(payload.initialState)}
    }
)

result = response.json()
output = {
    "result": result.get('result'),
    "state": result.get('state', {}),
    "visualizations": result.get('visualizations', []),
    "proposed_changes": {
        "files_to_modify": result.get('files_to_modify', []),
        "files_to_create": result.get('files_to_create', []),
        "files_to_delete": result.get('files_to_delete', [])
    }
}

print(json.dumps(output))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data || {
													result: null,
													state: payload.initialState,
													visualizations: [],
													proposed_changes: {
														files_to_modify: [],
														files_to_create: [],
														files_to_delete: [],
													},
													status: 'error',
													message: 'Failed to execute flow',
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse flow execution response'));
										}
									});
								});
							},
							'EXECUTE_FLOW',
							'Execute workflow flow',
						),
					),

					vscode.commands.registerCommand(
						'tribe.createWorkflow',
						errorWrapper(
							async (payload: WorkflowPayload): Promise<Record<string, unknown>> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/workflow/create",
    json={
        "name": "${payload.name}",
        "description": "${payload.description}",
        "steps": ${JSON.stringify(payload.steps)},
        "checkpoints": ${JSON.stringify(payload.checkpoints)},
        "required_approvals": ${JSON.stringify(payload.requiredApprovals)}
    }
)

print(json.dumps({"workflow": response.json()}))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											resolve(
												data.workflow || {
													id: '',
													name: payload.name,
													description: payload.description,
													steps: payload.steps,
													checkpoints: payload.checkpoints,
													required_approvals: payload.requiredApprovals,
													status: 'error',
													message: 'Failed to create workflow',
												},
											);
										} catch (e) {
											reject(new Error('Failed to parse workflow creation response'));
										}
									});
								});
							},
							'CREATE_WORKFLOW',
							'Create new workflow',
						),
					),

					vscode.commands.registerCommand(
						'tribe.generateCode',
						errorWrapper(
							async (payload: CodePayload): Promise<string> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/code/generate",
    json={
        "task_type": "code_generation",
        "requirements": ${JSON.stringify(payload.requirements)},
        "language": "${payload.language}",
        "framework": "${payload.framework || ''}",
        "output_file": "${payload.outputFile}"
    }
)

print(json.dumps({"result": response.json()}))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											if (data.result && data.result.code) {
												resolve(data.result.code);
											} else {
												resolve(
													`// Failed to generate code for requirements:\n// ${payload.requirements}\n// Language: ${payload.language}\n// Framework: ${payload.framework || 'none'}`,
												);
											}
										} catch (e) {
											reject(new Error('Failed to parse code generation response'));
										}
									});
								});
							},
							'GENERATE_CODE',
							'Generate code based on requirements',
						),
					),

					vscode.commands.registerCommand(
						'tribe.analyzeRequirements',
						errorWrapper(
							async (payload: RequirementsPayload): Promise<string> => {
								const tribePath = path.join(context.extensionPath, 'tribe');
								const tribeSrcPath = path.join(tribePath, 'src');
								const pythonPath = process.env.PYTHONPATH || '';
								const spawnOptions: SpawnOptionsWithoutStdio = {
									env: {
										...process.env,
										AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
										PYTHONPATH: [tribePath, pythonPath].filter(Boolean).join(path.delimiter),
									},
								};

								const pythonProcess = spawn(
									'python',
									[
										'-c',
										`
import requests
import json

response = requests.post(
    "${API_ENDPOINTS.AI_API}/requirements/analyze",
    json={
        "requirements": ${JSON.stringify(payload.requirements)}
    }
)

print(json.dumps({"analysis": response.json().get('analysis')}))
`,
									],
									spawnOptions,
								);

								return new Promise((resolve, reject) => {
									let result = '';
									pythonProcess.stdout.on('data', (data: Buffer) => {
										result += data.toString();
									});
									pythonProcess.stderr.on('data', (data: Buffer) => {
										console.error(`Error: ${data}`);
									});
									pythonProcess.on('close', (code: number) => {
										if (code !== 0) {
											reject(new Error(`Process exited with code ${code}`));
											return;
										}
										try {
											const data = JSON.parse(result);
											if (data.analysis) {
												resolve(data.analysis);
											} else {
												resolve(
													`Analysis failed for requirements:\n${payload.requirements}\n\nPlease try again with more detailed requirements.`,
												);
											}
										} catch (e) {
											reject(new Error('Failed to parse requirements analysis response'));
										}
									});
								});
							},
							'ANALYZE_REQUIREMENTS',
							'Analyze project requirements',
						),
					),
					vscode.commands.registerCommand(
						'tribe.initializeTribe',
						errorWrapper(
							async (): Promise<TribeInitResult> => {
								console.log('Initializing tribe');
								try {
									// Check if workspace folder exists
									const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
									if (!workspaceFolder) {
										console.error('No workspace folder found');
										return {
											success: false,
											error: 'No workspace folder found',
											message:
												'Please open a folder in VS Code (File > Open Folder...) and try again.',
										};
									}

									// Initialize the tribe
									const storageService = StorageService.getInstance(context);
									// Create the .tribe directory in the workspace folder
									const tribeDir = path.join(workspaceFolder.uri.fsPath, '.tribe');
									if (!fs.existsSync(tribeDir)) {
										fs.mkdirSync(tribeDir, { recursive: true });
									}

									// Return success
									return {
										success: true,
										timestamp: new Date().toISOString(),
									};
								} catch (error) {
									console.error('Error initializing tribe:', error);
									return {
										success: false,
										error: error instanceof Error ? error.message : String(error),
										message: 'Failed to initialize Tribe. Please try again or contact support.',
									};
								}
							},
							'INITIALIZE_TRIBE',
							'Initialize the tribe environment',
						),
					),
				];

				context.subscriptions.push(...commands);

				// Register CrewPanel provider
				const crewPanelProvider = new CrewPanelProvider(context.extensionUri, context);
				context.subscriptions.push(
					vscode.window.registerWebviewViewProvider(CrewPanelProvider.viewType, crewPanelProvider),
				);

				// Show workspace folder warning if no folder is open
				if (!hasWorkspaceFolder()) {
					vscode.window.showWarningMessage(
						'Tribe extension requires an open workspace folder for full functionality. Some features may be limited.',
					);
				}

				// Register updateMessage command after crewPanelProvider is defined
				const updateMessageCommand = vscode.commands.registerCommand(
					'tribe.updateMessage',
					errorWrapper(
						async (response: any): Promise<void> => {
							console.log(
								'updateMessage called with type:',
								response.type,
								'hideLoading:',
								response.hideLoading,
							);

							// Ensure chain of command properties are preserved
							if (response.payload) {
								// Preserve VP and team message flags
								const isVPResponse = response.payload.isVPResponse;
								const isTeamMessage = response.payload.isTeamMessage;
								const teamId = response.payload.teamId;

								// Update the message status based on the response
								response.payload.status = response.payload.isLoading
									? 'loading'
									: response.payload.isError
										? 'error'
										: 'complete';

								// Ensure these properties are preserved in the update
								response.payload.isVPResponse = isVPResponse;
								response.payload.isTeamMessage = isTeamMessage;
								response.payload.teamId = teamId || (isTeamMessage ? 'root' : undefined);
							}

							// Use the already defined provider
							if (crewPanelProvider) {
								// Handle loading indicator separately
								if (response.type === 'LOADING_INDICATOR') {
									console.log('Handling loading indicator for agent:', response.payload?.sender);
									await crewPanelProvider._handleLoadingIndicator(response);
								} else if (response.hideLoading === true) {
									// Hide loading indicator and show the actual message
									console.log('Hiding loading indicator and showing message');
									await crewPanelProvider._hideLoadingIndicator();
									await crewPanelProvider._handleMessageUpdate(response);
								} else {
									// Regular message update
									console.log('Regular message update');
									await crewPanelProvider._handleMessageUpdate(response);
								}
							} else {
								console.error('crewPanelProvider not available for updateMessage');
							}
						},
						'UPDATE_MESSAGE',
						'Update message status in webview',
					),
				);
				context.subscriptions.push(updateMessageCommand);

				const runServer = errorWrapper(
					async () => {
						try {
							// First try to use the bundled Python that comes with the VS Code fork
							const extensionPath = context.extensionPath;
							const bundledPythonPath = vscode.Uri.joinPath(
								vscode.Uri.file(extensionPath),
								'venv',
								'bin',
								'python',
							).fsPath;

							// Check if the bundled Python exists
							try {
								const fs = require('fs');
								if (fs.existsSync(bundledPythonPath)) {
									traceLog(`Using bundled Python interpreter: ${bundledPythonPath}`);

									// Validate the Python interpreter before using it
									const resolvedInterpreter = await resolveInterpreter(bundledPythonPath);
									if (resolvedInterpreter) {
										traceLog(`Validated bundled Python interpreter: ${bundledPythonPath}`);

										// Set the interpreter in the settings
										await vscode.workspace
											.getConfiguration(serverId)
											.update(
												'interpreter',
												[bundledPythonPath],
												vscode.ConfigurationTarget.Global,
											);

										// Restart the server with the bundled Python
										lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
										return;
									} else {
										traceError(
											`Bundled Python interpreter validation failed: ${bundledPythonPath}`,
										);
									}
								} else {
									traceError(`Bundled Python not found at: ${bundledPythonPath}`);
								}
							} catch (error) {
								traceError(`Error checking bundled Python: ${error}`);
							}

							// If bundled Python is not available, try the configured interpreter
							const interpreter = getInterpreterFromSetting(serverId);
							if (interpreter && interpreter.length > 0) {
								// We don't need to check the version here since we're handling the case
								// when the Python extension is not available
								traceVerbose(
									`Using interpreter from ${serverInfo.module}.interpreter: ${interpreter.join(' ')}`,
								);
								lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
								return;
							}

							// As a last resort, try the Python extension
							try {
								const interpreterDetails = await getInterpreterDetails();
								if (interpreterDetails.path) {
									traceVerbose(
										`Using interpreter from Python extension: ${interpreterDetails.path.join(' ')}`,
									);
									lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
									return;
								}
							} catch (error) {
								traceError(`Error getting interpreter from Python extension: ${error}`);
							}

							// Show a warning but don't fail the extension activation
							traceError(
								'Python interpreter missing:\r\n' +
									'The bundled Python interpreter was not found.\r\n' +
									`[Option 1] Set an interpreter using "${serverId}.interpreter" setting.\r\n` +
									'[Option 2] Install the Python extension and select a Python interpreter.\r\n' +
									'Please use Python 3.8 or greater.',
							);

							vscode.window.showWarningMessage(
								'Tribe extension: Bundled Python interpreter not found. Some features will be limited. ' +
									'Please contact your administrator or set a Python 3.8+ interpreter manually.',
							);
						} catch (error) {
							// Log the error but don't fail the extension activation
							traceError('Error initializing Python server:', error);
							vscode.window.showWarningMessage(
								'Tribe extension: Failed to initialize Python server. Some features will be limited.',
							);
						}
					},
					'RUN_SERVER',
					'Server initialization',
				);

				context.subscriptions.push(
					onDidChangePythonInterpreter(
						errorWrapper(
							async () => {
								await runServer();
							},
							'INTERPRETER_CHANGE',
							'Python interpreter change handler',
						),
					),
					onDidChangeConfiguration(
						errorWrapper(
							async (e: vscode.ConfigurationChangeEvent) => {
								if (checkIfConfigurationChanged(e, serverId)) {
									await runServer();
								}
							},
							'CONFIG_CHANGE',
							'Configuration change handler',
						),
					),
					registerCommand(
						`${serverId}.restart`,
						errorWrapper(
							async () => {
								await runServer();
							},
							'SERVER_RESTART',
							'Server restart command',
						),
					),
				);

				setImmediate(async () => {
					try {
						// First check if we have a bundled Python
						const extensionPath = context.extensionPath;
						const bundledPythonPath = vscode.Uri.joinPath(
							vscode.Uri.file(extensionPath),
							'venv',
							'bin',
							'python',
						).fsPath;

						try {
							const fs = require('fs');
							if (fs.existsSync(bundledPythonPath)) {
								traceLog(`Found bundled Python at: ${bundledPythonPath}`);
								// Set the interpreter in the settings
								await vscode.workspace
									.getConfiguration(serverId)
									.update('interpreter', [bundledPythonPath], vscode.ConfigurationTarget.Global);
								await runServer();
								return;
							}
						} catch (error) {
							traceError(`Error checking bundled Python: ${error}`);
						}

						// If no bundled Python, check configured interpreter
						const interpreter = getInterpreterFromSetting(serverId);
						if (interpreter && interpreter.length > 0) {
							traceLog(`Using configured Python interpreter: ${interpreter.join(' ')}`);
							await runServer();
							return;
						}

						// As a last resort, try the Python extension
						try {
							traceLog(`Python extension loading`);
							await initializePython(context.subscriptions);
							traceLog(`Python extension loaded`);
							await runServer();
						} catch (error) {
							// Log the error but don't fail the extension activation
							traceError('Error initializing Python extension:', error);
							vscode.window.showWarningMessage(
								'Tribe extension: Python initialization failed. UI features will still be available, but AI functionality will be limited.',
							);
						}
					} catch (error) {
						// Log the error but don't fail the extension activation
						traceError('Error initializing Python:', error);
						vscode.window.showWarningMessage(
							'Tribe extension: Python initialization failed. UI features will still be available, but AI functionality will be limited.',
						);
					}
				});

				// Show activation message
				vscode.window.showInformationMessage('Tribe extension is now active!');
			} catch (e) {
				traceError('Failed to activate extension:', e);
				void vscode.window.showErrorMessage('Failed to activate Tribe extension.');
			}
		} catch (e) {
			traceError('Failed to activate extension:', e);
			void vscode.window.showErrorMessage('Failed to activate Tribe extension.');
		}
	},
	'EXTENSION_ACTIVATE',
	'Extension activation',
);

export const deactivate = errorWrapper(
	async (): Promise<void> => {
		console.log('Deactivating Tribe extension');
		if (lsClient) {
			await lsClient.stop();
		}
	},
	'EXTENSION_DEACTIVATE',
	'Extension deactivation',
);

/**
 * Interface for the result of tribe.initializeTribe command
 */
export interface TribeInitResult {
	success: boolean;
	error?: string;
	message?: string;
	timestamp?: string;
}
