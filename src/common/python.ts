// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/* eslint-disable @typescript-eslint/naming-convention */
import { commands, Disposable, Event, EventEmitter, Uri, WorkspaceFolder } from 'vscode';
import { traceError, traceLog, traceVerbose } from './log/logging';
import {
	PythonExtension,
	ResolvedEnvironment,
	Bitness,
	VersionInfo,
	ResolvedVersionInfo,
	PythonReleaseLevel,
} from '@vscode/python-extension';
import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';

// Define a proper interface for ResolvedInterpreter to match what we're returning
export interface ResolvedInterpreter {
	type: string;
	name: string;
	folderUri: Uri;
	workspaceFolder: WorkspaceFolder | undefined;
	path: string;
	version: ResolvedVersionInfo;
	sysPrefix: string;
	architecture: number;
	sysVersion: string;
	executable: {
		filename: string;
		sysPrefix: string;
		ctime: number;
		mtime: number;
		bitness: Bitness;
	};
}

export interface IInterpreterDetails {
	path?: string[];
	resource?: Uri;
	version?: {
		major: number;
		minor: number;
		micro: number;
		raw: string;
	};
	sysPrefix?: string;
	architecture?: number;
}

const onDidChangePythonInterpreterEvent = new EventEmitter<IInterpreterDetails>();
export const onDidChangePythonInterpreter: Event<IInterpreterDetails> = onDidChangePythonInterpreterEvent.event;

let _api: PythonExtension | undefined;
async function getPythonExtensionAPI(): Promise<PythonExtension | undefined> {
	if (_api) {
		return _api;
	}
	try {
		_api = await PythonExtension.api();
		return _api;
	} catch (error) {
		traceVerbose('Python extension API not available:', error);
		return undefined;
	}
}

export async function initializePython(disposables: Disposable[]): Promise<void> {
	try {
		const api = await getPythonExtensionAPI();

		if (api) {
			traceLog('Python extension API available, setting up event listeners');
			disposables.push(
				api.environments.onDidChangeActiveEnvironmentPath((e) => {
					onDidChangePythonInterpreterEvent.fire({ path: [e.path], resource: e.resource?.uri });
				}),
			);

			traceLog('Waiting for interpreter from python extension.');
			onDidChangePythonInterpreterEvent.fire(await getInterpreterDetails());
		} else {
			traceLog('Python extension API not available, will use bundled Python if available');
			// Fire an empty event to signal that we should fall back to bundled Python
			onDidChangePythonInterpreterEvent.fire({ path: undefined, resource: undefined });
		}
	} catch (error) {
		traceError('Error initializing python: ', error);
		// Fire an empty event to signal that we should fall back to bundled Python
		onDidChangePythonInterpreterEvent.fire({ path: undefined, resource: undefined });
	}
}

export async function resolveInterpreter(pythonPath: string): Promise<ResolvedInterpreter | undefined> {
	try {
		if (!fs.existsSync(pythonPath)) {
			traceError(`Python interpreter not found at ${pythonPath}`);
			return undefined;
		}

		const uri = Uri.file(pythonPath);
		const workspaceFolder = workspace.getWorkspaceFolder(uri);

		// Create a basic version object with default values
		const version: ResolvedVersionInfo = {
			major: 3,
			minor: 8,
			micro: 0,
			release: {
				level: 'final' as PythonReleaseLevel,
				serial: 0,
			},
		};

		// Get the directory containing the Python executable
		const sysPrefix = path.dirname(path.dirname(pythonPath));

		return {
			type: 'Unknown',
			name: path.basename(pythonPath),
			folderUri: workspaceFolder ? workspaceFolder.uri : Uri.file(path.dirname(pythonPath)),
			workspaceFolder: workspaceFolder,
			path: pythonPath,
			version: version,
			sysPrefix: sysPrefix,
			architecture: 64, // Assume 64-bit
			sysVersion: '3.8.0', // Store version string separately from ResolvedVersionInfo
			executable: {
				filename: pythonPath,
				sysPrefix: sysPrefix,
				ctime: 0,
				mtime: 0,
				bitness: 64 as unknown as Bitness,
			},
		};
	} catch (ex) {
		traceError(`Failed to resolve interpreter: ${ex}`);
		return undefined;
	}
}

export async function getInterpreterDetails(resource?: Uri | string): Promise<IInterpreterDetails> {
	// If resource is a string, assume it's a path to a Python interpreter
	if (typeof resource === 'string') {
		try {
			if (!fs.existsSync(resource)) {
				return { path: undefined };
			}

			// Create a basic version object with default values
			const version = {
				major: 3,
				minor: 8,
				micro: 0,
				raw: '3.8.0',
			};

			// Get the directory containing the Python executable
			const sysPrefix = path.dirname(path.dirname(resource));

			return {
				path: [resource],
				version: version,
				sysPrefix: sysPrefix,
				architecture: 64, // Assume 64-bit
			};
		} catch (error) {
			traceError(`Error getting interpreter details for ${resource}: ${error}`);
			return { path: undefined };
		}
	}

	const api = await getPythonExtensionAPI();
	if (!api) {
		traceLog('Python extension not available, returning empty interpreter details');
		return { path: undefined, resource };
	}

	try {
		const environment = await api?.environments.resolveEnvironment(
			api?.environments.getActiveEnvironmentPath(resource),
		);
		if (environment?.executable.uri && checkVersion(environment)) {
			return {
				path: [environment?.executable.uri.fsPath],
				resource,
				version: {
					major: environment.version?.major || 3,
					minor: environment.version?.minor || 8,
					micro: environment.version?.micro || 0,
					raw: environment.version?.sysVersion || '3.8.0',
				},
				sysPrefix: environment.executable.sysPrefix,
				architecture: Number(environment.executable.bitness) === 64 ? 64 : 32,
			};
		}
	} catch (error) {
		traceError('Error getting interpreter details from Python extension:', error);
	}
	return { path: undefined, resource };
}

export async function getDebuggerPath(): Promise<string | undefined> {
	const api = await getPythonExtensionAPI();
	if (!api) {
		return undefined;
	}
	return api?.debug.getDebuggerPackagePath();
}

export async function runPythonExtensionCommand(command: string, ...rest: any[]) {
	const api = await getPythonExtensionAPI();
	if (!api) {
		traceError(`Cannot run Python extension command ${command}: Python extension not available`);
		return undefined;
	}
	return await commands.executeCommand(command, ...rest);
}

export function checkVersion(resolved: ResolvedEnvironment | undefined): boolean {
	if (!resolved) {
		return false;
	}
	const version = resolved?.version;
	if (version && version.major === 3 && version.minor >= 8) {
		return true;
	}
	traceError(`Python version ${version?.major}.${version?.minor} is not supported.`);
	traceError(`Selected python path: ${resolved?.executable.uri?.fsPath}`);
	traceError('Supported versions are 3.8 and above.');
	return false;
}
