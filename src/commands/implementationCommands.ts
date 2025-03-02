/* eslint-disable header/header */

import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { DiffService } from '../services/diffService';
import { CreateImplementationPayload, ApplyImplementationPayload } from '../models/types';
import { errorWrapper, ErrorCategory } from '../errorHandling';
import { COMMANDS, API_ENDPOINTS } from '../config';

/**
 * Register implementation management commands
 * @param context Extension context
 */
export function registerImplementationCommands(context: vscode.ExtensionContext): void {
	// Initialize services
	const storageService = StorageService.getInstance(context);
	const diffService = DiffService.getInstance();

	// Register commands
	const commands = [
		vscode.commands.registerCommand(
			COMMANDS.CREATE_IMPLEMENTATION,
			errorWrapper(
				async (payload: CreateImplementationPayload): Promise<any> => {
					console.log('Creating implementation:', payload.title);

					try {
						// Create an implementation
						const implementation = {
							id: `implementation-${Date.now()}`,
							timestamp: new Date().toISOString(),
							title: payload.title,
							description: payload.description,
							files: payload.files || [],
							status: 'pending' as const,
							author: payload.author || 'User',
							tags: payload.tags || [],
						};

						// Save the implementation
						await storageService.saveImplementation(implementation);

						return {
							implementation,
							success: true,
						};
					} catch (error) {
						console.error('Error creating implementation:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'CREATE_IMPLEMENTATION',
				ErrorCategory.SYSTEM,
				'Create an implementation for a feature or bug fix',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GET_IMPLEMENTATIONS,
			errorWrapper(
				async (status?: string): Promise<any[]> => {
					// Get all implementations from storage
					const implementations = await storageService.getImplementations();

					// If status is provided, filter implementations by status
					if (status) {
						return implementations.filter((i) => i.status === status);
					}

					return implementations;
				},
				'GET_IMPLEMENTATIONS',
				ErrorCategory.SYSTEM,
				'Get all implementations or implementations with a specific status',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.DELETE_IMPLEMENTATION,
			errorWrapper(
				async (implementationId: string): Promise<boolean> => {
					console.log(`Deleting implementation: ${implementationId}`);

					// Delete the implementation from storage
					await storageService.deleteImplementation(implementationId);

					return true;
				},
				'DELETE_IMPLEMENTATION',
				ErrorCategory.SYSTEM,
				'Delete an implementation',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.APPLY_IMPLEMENTATION,
			errorWrapper(
				async (payload: ApplyImplementationPayload): Promise<any> => {
					console.log(`Applying implementation: ${payload.implementationId}`);

					try {
						// Get the implementation
						const implementations = await storageService.getImplementations();
						const implementation = implementations.find((i) => i.id === payload.implementationId);

						if (!implementation) {
							throw new Error(`Implementation ${payload.implementationId} not found`);
						}

						// Apply each file change
						const results = [];

						for (const file of implementation.files) {
							try {
								if (file.type === 'create' || file.type === 'modify') {
									// Apply the file change
									await diffService.applyFileChange({
										path: file.path,
										content: file.content,
										type: file.type,
									});

									results.push({
										path: file.path,
										success: true,
									});
								} else if (file.type === 'delete') {
									// Delete the file
									await diffService.deleteFile(file.path);

									results.push({
										path: file.path,
										success: true,
									});
								}
							} catch (error) {
								console.error(`Error applying change to ${file.path}:`, error);
								results.push({
									path: file.path,
									success: false,
									error: error instanceof Error ? error.message : String(error),
								});
							}
						}

						// Update the implementation status
						implementation.status = 'applied';
						await storageService.saveImplementation(implementation);

						// Show a success message
						const successCount = results.filter((r) => r.success).length;
						const failCount = results.length - successCount;

						if (failCount === 0) {
							vscode.window.showInformationMessage(
								`Implementation applied successfully (${successCount} files)`,
							);
						} else {
							vscode.window.showWarningMessage(
								`Implementation applied with issues: ${successCount} succeeded, ${failCount} failed`,
							);
						}

						return {
							results,
							success: failCount === 0,
						};
					} catch (error) {
						console.error('Error applying implementation:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'APPLY_IMPLEMENTATION',
				ErrorCategory.SYSTEM,
				'Apply an implementation to the workspace',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.VIEW_IMPLEMENTATION_DIFF,
			errorWrapper(
				async (implementationId: string): Promise<void> => {
					console.log(`Viewing diff for implementation: ${implementationId}`);

					try {
						// Get the implementation
						const implementations = await storageService.getImplementations();
						const implementation = implementations.find((i) => i.id === implementationId);

						if (!implementation) {
							throw new Error(`Implementation ${implementationId} not found`);
						}

						// If there are no files, show a message
						if (!implementation.files || implementation.files.length === 0) {
							vscode.window.showInformationMessage('This implementation has no file changes');
							return;
						}

						// Show a quick pick to select a file
						const fileItems = implementation.files.map((file) => ({
							label: file.path,
							description: `${file.type} file`,
							file,
						}));

						const selectedItem = await vscode.window.showQuickPick(fileItems, {
							placeHolder: 'Select a file to view diff',
						});

						if (!selectedItem) {
							return;
						}

						const file = selectedItem.file;

						// For create or modify, show the diff
						if (file.type === 'create' || file.type === 'modify') {
							let originalContent = '';

							// For modify, get the current file content
							if (file.type === 'modify') {
								try {
									const fileContent = await diffService.getFileContent(file.path);
									originalContent = fileContent || '';
								} catch (error) {
									console.error(`Error getting file content for ${file.path}:`, error);
									originalContent = '';
								}
							}

							// Show the diff
							await diffService.showDiff(
								originalContent,
								file.content,
								`Diff for ${file.path} (${file.type})`,
							);
						} else if (file.type === 'delete') {
							// For delete, show the file content that will be deleted
							try {
								const fileContent = await diffService.getFileContent(file.path);
								const content = fileContent || '';
								await diffService.showDiff(content, '', `Diff for ${file.path} (delete)`);
							} catch (error) {
								console.error(`Error getting file content for ${file.path}:`, error);
								vscode.window.showErrorMessage(`Failed to get content for ${file.path}`);
							}
						}
					} catch (error) {
						console.error(`Error viewing implementation diff: ${error}`);
						vscode.window.showErrorMessage(`Failed to view implementation diff: ${error}`);
					}
				},
				'VIEW_IMPLEMENTATION_DIFF',
				ErrorCategory.SYSTEM,
				'View diff for an implementation',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.UPDATE_IMPLEMENTATION_STATUS,
			errorWrapper(
				async (implementationId: string, status: string): Promise<boolean> => {
					console.log(`Updating implementation ${implementationId} status to: ${status}`);

					try {
						// Get the implementation
						const implementations = await storageService.getImplementations();
						const implementationIndex = implementations.findIndex((i) => i.id === implementationId);

						if (implementationIndex === -1) {
							throw new Error(`Implementation ${implementationId} not found`);
						}

						// Update the status
						implementations[implementationIndex].status = status as 'pending' | 'rejected' | 'applied';

						// Save the implementation
						await storageService.saveImplementation(implementations[implementationIndex]);

						// Show a success message
						vscode.window.showInformationMessage(
							`Implementation ${implementationId} status updated to ${status}`,
						);

						return true;
					} catch (error) {
						console.error(`Error updating implementation status: ${error}`);
						vscode.window.showErrorMessage(`Failed to update implementation status: ${error}`);
						return false;
					}
				},
				'UPDATE_IMPLEMENTATION_STATUS',
				ErrorCategory.SYSTEM,
				'Update the status of an implementation',
			),
		),
	];

	// Add commands to context subscriptions
	context.subscriptions.push(...commands);
}
