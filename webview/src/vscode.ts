export type VSCodeApi = {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
};

declare global {
    interface Window {
        acquireVsCodeApi(): VSCodeApi;
        vscodeApi: VSCodeApi;
        vscode: VSCodeApi;
    }
}

export function getMediaPath(): string {
    return (window as any).__vscMediaPath || '';
}

// Suppress DevTools protocol errors
const originalError = console.error;
console.error = (...args) => {
    if (typeof args[0] === 'string' && 
        (args[0].includes('Autofill.') || args[0].includes('vscode-webview'))) {
        return;
    }
    originalError.apply(console, args);
};

export function getVsCodeApi(): VSCodeApi {
    if (window.vscode) {
        return window.vscode;
    }

    try {
        // Try to acquire the VS Code API
        const api = window.acquireVsCodeApi();
        window.vscode = api; // Cache it for future use
        return api as VSCodeApi;
    } catch (e) {
        console.error('Failed to acquire VS Code API:', e);
        // Return a mock API for development/testing
        return {
            postMessage: (message: any) => {
                console.log('VS Code API not available, message not sent:', message);
            },
            getState: () => ({}),
            setState: () => {}
        };
    }
}
