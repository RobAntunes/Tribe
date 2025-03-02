// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs-extra';
import * as path from 'path';
import { LogLevel, Uri, WorkspaceFolder } from 'vscode';
import { Trace } from 'vscode-languageclient/node';
import { getWorkspaceFolders } from './vscodeapi';

export enum MessageType {
    TEXT = 'TEXT',
    COMMAND = 'COMMAND',
    RESPONSE = 'RESPONSE',
    STATUS = 'STATUS',
    ERROR = 'ERROR',
    STREAM = 'STREAM'
}

export interface Message {
    id: string;
    sender: string;
    receiver: string;
    content: string;
    timestamp: string;
    type: MessageType;
    metadata?: any;
    streamId?: string;
    isPartial?: boolean;
    isLastPart?: boolean;
}

export class EventEmitter<T = any> {
    private listeners: Array<(data: T) => void> = [];
    
    public on(listener: (data: T) => void): () => void {
        this.listeners.push(listener);
        return () => this.off(listener);
    }
    
    public off(listener: (data: T) => void): void {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
    
    public emit(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }
    
    public clear(): void {
        this.listeners = [];
    }
}

function logLevelToTrace(logLevel: LogLevel): Trace {
    switch (logLevel) {
        case LogLevel.Error:
        case LogLevel.Warning:
        case LogLevel.Info:
            return Trace.Messages;

        case LogLevel.Debug:
        case LogLevel.Trace:
            return Trace.Verbose;

        case LogLevel.Off:
        default:
            return Trace.Off;
    }
}

export function getLSClientTraceLevel(channelLogLevel: LogLevel, globalLogLevel: LogLevel): Trace {
    if (channelLogLevel === LogLevel.Off) {
        return logLevelToTrace(globalLogLevel);
    }
    if (globalLogLevel === LogLevel.Off) {
        return logLevelToTrace(channelLogLevel);
    }
    const level = logLevelToTrace(channelLogLevel <= globalLogLevel ? channelLogLevel : globalLogLevel);
    return level;
}

export async function getProjectRoot(): Promise<WorkspaceFolder> {
    const workspaces: readonly WorkspaceFolder[] = getWorkspaceFolders();
    if (workspaces.length === 0) {
        return {
            uri: Uri.file(process.cwd()),
            name: path.basename(process.cwd()),
            index: 0,
        };
    } else if (workspaces.length === 1) {
        return workspaces[0];
    } else {
        let rootWorkspace = workspaces[0];
        let root = undefined;
        for (const w of workspaces) {
            if (await fs.pathExists(w.uri.fsPath)) {
                root = w.uri.fsPath;
                rootWorkspace = w;
                break;
            }
        }

        for (const w of workspaces) {
            if (root && root.length > w.uri.fsPath.length && (await fs.pathExists(w.uri.fsPath))) {
                root = w.uri.fsPath;
                rootWorkspace = w;
            }
        }
        return rootWorkspace;
    }
}
