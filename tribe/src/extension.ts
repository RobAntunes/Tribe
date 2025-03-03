import * as vscode from 'vscode';
import { API_ENDPOINTS } from './config';
import { LanguageClient } from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    // Initialize language client
    client = new LanguageClient(
        'tribe',
        'Tribe',
        {
            command: 'python',
            args: ['-m', 'tribe.server'],
            options: {
                env: {
                    ...process.env,
                    AI_API_ENDPOINT: API_ENDPOINTS.AI_API,
                },
            },
        },
        {
            documentSelector: [{ scheme: 'file', language: '*' }],
            synchronize: {
                configurationSection: 'tribe',
            },
        },
    );

    // Start the client
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
