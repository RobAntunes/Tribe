import * as vscode from 'vscode';
import { join } from 'path';

/**
 * Gets a URI to a resource in the extension
 * @param webview The webview to get the URI for
 * @param extensionUri The URI of the extension
 * @param pathList The path segments to the resource
 * @returns A URI that can be used in the webview
 */
export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]): vscode.Uri {
	return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}
