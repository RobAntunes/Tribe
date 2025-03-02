/* eslint-disable header/header */

import * as fsapi from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import * as WebSocket from 'ws';
import { Disposable, env, LogOutputChannel } from 'vscode';
import { State, Trace } from 'vscode-languageclient/node';
import {
    LanguageClient,
    LanguageClientOptions,
    RevealOutputChannelOn,
    ServerOptions,
} from 'vscode-languageclient/node';
import { EventEmitter, Message, MessageType } from './utilities';
import { DEBUG_SERVER_SCRIPT_PATH, SERVER_SCRIPT_PATH } from './constants';
import { traceError, traceInfo, traceVerbose } from './log/logging';
import { getDebuggerPath } from './python';
import { getExtensionSettings, getGlobalSettings, getWorkspaceSettings, ISettings } from './settings';
import { getLSClientTraceLevel, getProjectRoot } from './utilities';
import { isVirtualWorkspace } from './vscodeapi';

// Add extension method to LanguageClient
declare module 'vscode-languageclient/node' {
    interface LanguageClient {
        needsStop(): boolean;
    }
}

// Extend LanguageClient prototype with needsStop method
LanguageClient.prototype.needsStop = function (): boolean {
    // In vscode-languageclient v7.0.0, we need to check if the client is running
    // We'll use a more reliable approach by checking the internal state
    const client = this as any;
    return client._state !== undefined && client._state !== State.Stopped;
};

export type IInitOptions = { settings: ISettings[]; globalSettings: ISettings };

// Real-time update system using WebSockets
export class RealTimeUpdateServer {
    private server: http.Server;
    private wss: WebSocket.Server;
    private clients: Map<string, WebSocket> = new Map();
    private port: number;
    
    // Event emitters
    public readonly onMessage = new EventEmitter<Message>();
    public readonly onConnection = new EventEmitter<string>();
    public readonly onDisconnection = new EventEmitter<string>();
    
    constructor(port: number = 0) {
        this.port = port;
        this.server = http.createServer();
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            this.clients.set(clientId, ws);
            this.onConnection.emit(clientId);
            
            ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString()) as Message;
                    this.onMessage.emit(message);
                } catch (error) {
                    traceError(`Error parsing WebSocket message: ${error}`);
                }
            });
            
            ws.on('close', () => {
                this.clients.delete(clientId);
                this.onDisconnection.emit(clientId);
            });
        });
    }
    
    public start(): Promise<number> {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                const actualPort = (this.server.address() as any).port;
                traceInfo(`Real-time update server started on port ${actualPort}`);
                resolve(actualPort);
            });
        });
    }
    
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            this.wss.close(() => {
                this.server.close(() => {
                    traceInfo('Real-time update server stopped');
                    resolve();
                });
            });
        });
    }
    
    public sendToAll(message: Message): void {
        const messageStr = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }
    
    public sendToClient(clientId: string, message: Message): boolean {
        const client = this.clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
            return true;
        }
        return false;
    }
    
    public sendStreamToAll(content: string, streamId: string, isLastPart: boolean = false): void {
        const message: Message = {
            id: `stream_${Date.now()}`,
            sender: 'server',
            receiver: 'all',
            content,
            timestamp: new Date().toISOString(),
            type: MessageType.STREAM,
            streamId,
            isPartial: !isLastPart,
            isLastPart
        };
        this.sendToAll(message);
    }
}

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
                if (lsClient.needsStop()) {
                    await lsClient.stop();
                } else {
                    traceInfo(`Server: Client is not running, skipping stop`);
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
            // In vscode-languageclient v7.0.0, we need to handle state changes differently
            _disposables.push(
                newLSClient.onDidChangeState((e) => {
                    // State values are the same in v7.0.0
                    const stateString =
                        e.newState === State.Running
                            ? 'Running'
                            : e.newState === State.Starting
                              ? 'Starting'
                              : 'Stopped';
                    traceVerbose(`Server State: ${stateString}`);
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
            // In vscode-languageclient v7.0.0, we need to set the trace level directly on the tracer
            newLSClient.outputChannel.appendLine(`Setting trace level to: ${Trace[level]}`);
            const client = newLSClient as any;
            if (client._tracer) {
                client._tracer.trace = level;
            } else {
                client._tracer = { trace: level };
            }
            return newLSClient;
        } catch (error) {
            traceError(`Error creating server: ${error}`);
            return undefined;
        }
    } finally {
        _isRestarting = false;
    }
}
