/* eslint-disable header/header */

import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { DiffService } from '../services/diffService';
import { FileChange } from '../models/types';
import { errorWrapper } from '../errorHandling';
import { COMMANDS, API_ENDPOINTS } from '../config';

/**
 * Register history management commands
 * @param context Extension context
 */
export function registerHistoryCommands(context: vscode.ExtensionContext): void {
	// Initialize services
	const storageService = StorageService.getInstance(context);
	const diffService = DiffService.getInstance();

	// Register commands
	const commands = [
		vscode.commands.registerCommand(
			COMMANDS.RECORD_HISTORY_ENTRY,
			errorWrapper(
				async (description: string, changes: any[]): Promise<any> => {
					console.log('Recording history entry:', description);

					try {
						// Create a history entry
						const historyEntry = {
							id: `history-${Date.now()}`,
							timestamp: new Date().toISOString(),
							description,
							changes: changes || [],
						};

						// Save the history entry
						await storageService.saveHistoryEntry(historyEntry);

						return {
							historyEntry,
							success: true,
						};
					} catch (error) {
						console.error('Error recording history entry:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'RECORD_HISTORY_ENTRY',
				'Record a history entry with changes',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GET_HISTORY,
			errorWrapper(
				async (limit?: number): Promise<any[]> => {
					// Get history entries from storage
					const historyEntries = await storageService.getHistoryEntries();

					// If limit is provided, return only the most recent entries
					if (limit && limit > 0) {
						return historyEntries.slice(0, limit);
					}

					return historyEntries;
				},
				'GET_HISTORY',
				'Get history entries',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.CLEAR_HISTORY,
			errorWrapper(
				async (): Promise<boolean> => {
					console.log('Clearing history');

					// Clear all history entries
					await storageService.clearHistory();

					// Show a success message
					vscode.window.showInformationMessage('History cleared');

					return true;
				},
				'CLEAR_HISTORY',
				'Clear all history entries',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.VIEW_HISTORY_DIFF,
			errorWrapper(
				async (historyEntryId: string): Promise<void> => {
					console.log(`Viewing diff for history entry: ${historyEntryId}`);

					try {
						// Get the history entry
						const historyEntries = await storageService.getHistoryEntries();
						const historyEntry = historyEntries.find((h: any) => h.id === historyEntryId);

						if (!historyEntry) {
							throw new Error(`History entry ${historyEntryId} not found`);
						}

						// If there are no changes, show a message
						if (!historyEntry.changes || historyEntry.changes.length === 0) {
							vscode.window.showInformationMessage('This history entry has no changes');
							return;
						}

						// Show a quick pick to select a file
						interface FileItem {
							label: string;
							description: string;
							change: FileChange;
						}

						const fileItems: FileItem[] = historyEntry.changes.map((change: any) => ({
							label: change.path,
							description: `${change.type} file`,
							change,
						}));

						const selectedItem = await vscode.window.showQuickPick<FileItem>(fileItems, {
							placeHolder: 'Select a file to view diff',
						});

						if (!selectedItem) {
							return;
						}

						// Use the selected item directly
						const change = selectedItem.change;

						// For create or modify, show the diff
						if (change.type === 'create' || change.type === 'modify') {
							let originalContent = '';

							// For modify, get the original content from the change
							if (change.type === 'modify' && change.originalContent) {
								originalContent = change.originalContent;
							}

							// Show the diff
							await diffService.showDiff(
								originalContent,
								change.content,
								`Diff for ${change.path} (${change.type})`,
							);
						} else if (change.type === 'delete' && change.originalContent) {
							// For delete, show the original content that was deleted
							await diffService.showDiff(change.originalContent, '', `Diff for ${change.path} (delete)`);
						}
					} catch (error) {
						console.error(`Error viewing history diff: ${error}`);
						vscode.window.showErrorMessage(`Failed to view history diff: ${error}`);
					}
				},
				'VIEW_HISTORY_DIFF',
				'View diff for a history entry',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.REVERT_HISTORY_ENTRY,
			errorWrapper(
				async (historyEntryId: string): Promise<any> => {
					console.log(`Reverting history entry: ${historyEntryId}`);

					try {
						// Get the history entry
						const historyEntries = await storageService.getHistoryEntries();
						const historyEntry = historyEntries.find((h: any) => h.id === historyEntryId);

						if (!historyEntry) {
							throw new Error(`History entry ${historyEntryId} not found`);
						}

						// If there are no changes, show a message
						if (!historyEntry.changes || historyEntry.changes.length === 0) {
							vscode.window.showInformationMessage('This history entry has no changes to revert');
							return {
								success: false,
								message: 'No changes to revert',
							};
						}

						// Revert each change in reverse order
						const results = [];
						const reversedChanges = [...historyEntry.changes].reverse();

						for (const change of reversedChanges) {
							try {
								if (change.type === 'create') {
									// Revert a create by deleting the file
									await diffService.deleteFile(change.path);

									results.push({
										path: change.path,
										success: true,
									});
								} else if (change.type === 'modify' && change.originalContent) {
									// Revert a modify by restoring the original content
									await diffService.applyFileChange({
										path: change.path,
										content: change.originalContent,
										type: 'modify',
									});

									results.push({
										path: change.path,
										success: true,
									});
								} else if (change.type === 'delete' && change.originalContent) {
									// Revert a delete by recreating the file
									await diffService.applyFileChange({
										path: change.path,
										content: change.originalContent,
										type: 'create',
									});

									results.push({
										path: change.path,
										success: true,
									});
								} else {
									results.push({
										path: change.path,
										success: false,
										error: 'Missing original content for revert',
									});
								}
							} catch (error) {
								console.error(`Error reverting change to ${change.path}:`, error);
								results.push({
									path: change.path,
									success: false,
									error: error instanceof Error ? error.message : String(error),
								});
							}
						}

						// Show a success message
						const successCount = results.filter((r) => r.success).length;
						const failCount = results.length - successCount;

						if (failCount === 0) {
							vscode.window.showInformationMessage(
								`History entry reverted successfully (${successCount} files)`,
							);
						} else {
							vscode.window.showWarningMessage(
								`History entry reverted with issues: ${successCount} succeeded, ${failCount} failed`,
							);
						}

						// Record a new history entry for the revert
						await vscode.commands.executeCommand(
							COMMANDS.RECORD_HISTORY_ENTRY,
							`Reverted: ${historyEntry.description}`,
							results.map((r) => ({
								path: r.path,
								type: 'revert',
								success: r.success,
								error: r.error,
							})),
						);

						return {
							results,
							success: failCount === 0,
						};
					} catch (error) {
						console.error('Error reverting history entry:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'REVERT_HISTORY_ENTRY',
				'Revert changes from a history entry',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.SHOW_HISTORY_VIEW,
			errorWrapper(
				async (): Promise<void> => {
					console.log('Showing history view');

					try {
						// Get history entries
						const historyEntriesResult = await vscode.commands.executeCommand(COMMANDS.GET_HISTORY);
						const historyEntries = Array.isArray(historyEntriesResult) ? historyEntriesResult : [];

						if (!historyEntries || historyEntries.length === 0) {
							vscode.window.showInformationMessage('No history entries found');
							return;
						}

						// Create a webview panel
						const panel = vscode.window.createWebviewPanel(
							'historyView',
							'History',
							vscode.ViewColumn.One,
							{
								enableScripts: true,
							},
						);

						// Generate HTML for the webview
						panel.webview.html = generateHistoryViewHtml(historyEntries);

						// Handle messages from the webview
						panel.webview.onDidReceiveMessage(async (message) => {
							if (message.command === 'viewDiff') {
								await vscode.commands.executeCommand(
									COMMANDS.VIEW_HISTORY_DIFF,
									message.historyEntryId,
								);
							} else if (message.command === 'revertEntry') {
								await vscode.commands.executeCommand(
									COMMANDS.REVERT_HISTORY_ENTRY,
									message.historyEntryId,
								);

								// Refresh the webview
								const updatedHistoryEntriesResult = await vscode.commands.executeCommand(
									COMMANDS.GET_HISTORY,
								);
								const updatedHistoryEntries = Array.isArray(updatedHistoryEntriesResult)
									? updatedHistoryEntriesResult
									: [];
								panel.webview.html = generateHistoryViewHtml(updatedHistoryEntries);
							}
						});
					} catch (error) {
						console.error('Error showing history view:', error);
						vscode.window.showErrorMessage(`Failed to show history view: ${error}`);
					}
				},
				'SHOW_HISTORY_VIEW',
				'Show history view',
			),
		),
	];

	// Add commands to context subscriptions
	context.subscriptions.push(...commands);
}

/**
 * Generate HTML for the history view
 * @param historyEntries History entries to display
 * @returns HTML string
 */
function generateHistoryViewHtml(historyEntries: any[]): string {
	const entriesHtml = historyEntries
		.map((entry) => {
			const date = new Date(entry.timestamp).toLocaleString();
			const changesCount = entry.changes ? entry.changes.length : 0;

			return `
            <div class="history-entry">
                <div class="entry-header">
                    <span class="entry-date">${date}</span>
                    <span class="entry-description">${entry.description}</span>
                    <span class="entry-changes">${changesCount} changes</span>
                </div>
                <div class="entry-actions">
                    <button class="view-diff-btn" data-id="${entry.id}">View Diff</button>
                    <button class="revert-btn" data-id="${entry.id}">Revert</button>
                </div>
            </div>
        `;
		})
		.join('');

	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>History</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 10px;
                    color: var(--vscode-foreground);
                }
                .history-entry {
                    margin-bottom: 10px;
                    padding: 10px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 3px;
                }
                .entry-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                .entry-date {
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .entry-description {
                    font-weight: bold;
                }
                .entry-changes {
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                }
                .entry-actions {
                    display: flex;
                    gap: 5px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 5px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .empty-message {
                    text-align: center;
                    margin-top: 20px;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <h1>History</h1>
            ${entriesHtml || '<div class="empty-message">No history entries found</div>'}
            
            <script>
                const vscode = acquireVsCodeApi();
                
                // Add event listeners to buttons
                document.querySelectorAll('.view-diff-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'viewDiff',
                            historyEntryId: btn.dataset.id
                        });
                    });
                });
                
                document.querySelectorAll('.revert-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (confirm('Are you sure you want to revert these changes?')) {
                            vscode.postMessage({
                                command: 'revertEntry',
                                historyEntryId: btn.dataset.id
                            });
                        }
                    });
                });
            </script>
        </body>
        </html>
    `;
}
