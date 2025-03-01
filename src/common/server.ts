/* eslint-disable header/header */

import * as fsapi from 'fs-extra';
import * as path from 'path';
import { Disposable, env, LogOutputChannel } from 'vscode';
import { State } from 'vscode-languageclient';
import {
	LanguageClient,
	LanguageClientOptions,
	RevealOutputChannelOn,
	ServerOptions,
} from 'vscode-languageclient/node';
import { DEBUG_SERVER_SCRIPT_PATH, SERVER_SCRIPT_PATH } from './constants';
import { traceError, traceInfo, traceVerbose } from './log/logging';
import { getDebuggerPath } from './python';
import { getExtensionSettings, getGlobalSettings, getWorkspaceSettings, ISettings } from './settings';
import { getLSClientTraceLevel, getProjectRoot } from './utilities';
import { isVirtualWorkspace } from './vscodeapi';

export type IInitOptions = { settings: ISettings[]; globalSettings: ISettings };

async function createServer(
	settings: ISettings,
	serverId: string,
	serverName: string,
	outputChannel: LogOutputChannel,
	initializationOptions: IInitOptions,
): Promise<LanguageClient> {
	const command = settings.interpreter[0];
	const cwd = settings.cwd;

	// Set up environment variables
	const extensionRoot = path.dirname(path.dirname(__dirname));
	const bundledLibsPath = path.join(extensionRoot, 'bundled', 'libs');
	const bundledToolPath = path.join(extensionRoot, 'bundled', 'tool');
	const newEnv = { ...process.env };
	newEnv.PYTHONPATH = [bundledLibsPath, bundledToolPath, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);

	// Set debugger path needed for debugging python code.
	let debuggerPath;
	try {
		debuggerPath = await getDebuggerPath();
	} catch (error) {
		traceVerbose(`Error getting debugger path: ${error}`);
		debuggerPath = undefined;
	}

	const isDebugScript = await fsapi.pathExists(DEBUG_SERVER_SCRIPT_PATH);
	if (newEnv.USE_DEBUGPY && debuggerPath) {
		newEnv.DEBUGPY_PATH = debuggerPath;
	} else {
		newEnv.USE_DEBUGPY = 'False';
	}

	// Set import strategy
	newEnv.LS_IMPORT_STRATEGY = settings.importStrategy;

	// Set notification type
	newEnv.LS_SHOW_NOTIFICATION = settings.showNotifications;

	const args =
		newEnv.USE_DEBUGPY === 'False' || !isDebugScript
			? settings.interpreter.slice(1).concat([SERVER_SCRIPT_PATH])
			: settings.interpreter.slice(1).concat([DEBUG_SERVER_SCRIPT_PATH]);
	traceInfo(`Server run command: ${[command, ...args].join(' ')}`);

	const serverOptions: ServerOptions = {
		command,
		args,
		options: { cwd, env: newEnv },
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for python documents
		documentSelector: isVirtualWorkspace()
			? [{ language: 'python' }]
			: [
					{ scheme: 'file', language: 'python' },
					{ scheme: 'untitled', language: 'python' },
					{ scheme: 'vscode-notebook', language: 'python' },
					{ scheme: 'vscode-notebook-cell', language: 'python' },
				],
		outputChannel: outputChannel,
		traceOutputChannel: outputChannel,
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		initializationOptions,
	};

	return new LanguageClient(serverId, serverName, serverOptions, clientOptions);
}

let _disposables: Disposable[] = [];
let _isRestarting = false;
let _restartTimeoutId: NodeJS.Timeout | undefined;

export async function restartServer(
	serverId: string,
	serverName: string,
	outputChannel: LogOutputChannel,
	lsClient?: LanguageClient,
): Promise<LanguageClient | undefined> {
	// Debounce server restarts to prevent race conditions
	if (_isRestarting) {
		traceInfo(`Server: Restart already in progress, debouncing this request`);

		// Clear any existing timeout
		if (_restartTimeoutId) {
			clearTimeout(_restartTimeoutId);
		}

		// Return the current client, a new restart will be triggered after the current one completes
		return lsClient;
	}

	_isRestarting = true;

	try {
		if (lsClient) {
			traceInfo(`Server: Stop requested`);
			try {
				// Check if the client is in a state where it can be stopped
				if (lsClient.state === State.Running || lsClient.state === State.Starting) {
					await lsClient.stop();
				} else {
					traceInfo(`Server: Client is not running (state: ${State[lsClient.state]}), skipping stop`);
				}
			} catch (ex) {
				traceError(`Server: Error stopping client: ${ex}`);
				// Continue with creating a new client even if stopping the old one failed
			}
			_disposables.forEach((d) => d.dispose());
			_disposables = [];
		}
		const projectRoot = await getProjectRoot();
		const workspaceSetting = await getWorkspaceSettings(serverId, projectRoot, true);

		// Ensure we have a valid interpreter
		if (!workspaceSetting.interpreter || workspaceSetting.interpreter.length === 0) {
			traceError('No Python interpreter available. Server cannot be started.');
			return undefined;
		}

		try {
			const newLSClient = await createServer(workspaceSetting, serverId, serverName, outputChannel, {
				settings: await getExtensionSettings(serverId, true),
				globalSettings: await getGlobalSettings(serverId, false),
			});
			traceInfo(`Server: Start requested.`);
			_disposables.push(
				newLSClient.onDidChangeState((e) => {
					switch (e.newState) {
						case State.Stopped:
							traceVerbose(`Server State: Stopped`);
							break;
						case State.Starting:
							traceVerbose(`Server State: Starting`);
							break;
						case State.Running:
							traceVerbose(`Server State: Running`);
							break;
					}
				}),
			);
			try {
				// Add a timeout to prevent hanging if the server doesn't start
				const startPromise = newLSClient.start();
				const timeoutPromise = new Promise<void>((_, reject) => {
					const timeout = setTimeout(() => {
						clearTimeout(timeout);
						reject(new Error('Server start timed out after 30 seconds'));
					}, 30000);
				});

				await Promise.race([startPromise, timeoutPromise]).catch((ex) => {
					traceError(`Server: Start failed: ${ex}`);
					return undefined;
				});
			} catch (ex) {
				traceError(`Server: Start failed: ${ex}`);
				return undefined;
			}

			const level = getLSClientTraceLevel(outputChannel.logLevel, env.logLevel);
			await newLSClient.setTrace(level);
			return newLSClient;
		} catch (error) {
			traceError(`Error creating server: ${error}`);
			return undefined;
		}
	} finally {
		_isRestarting = false;
	}
}
