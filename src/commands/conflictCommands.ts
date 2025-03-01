/* eslint-disable header/header */

import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { DiffService } from '../services/diffService';
import { CreateConflictPayload, ResolveConflictPayload } from '../models/types';
import { errorWrapper } from '../errorHandling';
import { COMMANDS, API_ENDPOINTS } from '../config';

/**
 * Register conflict management commands
 * @param context Extension context
 */
export function registerConflictCommands(context: vscode.ExtensionContext): void {
	// Initialize services
	const storageService = StorageService.getInstance(context);
	const diffService = DiffService.getInstance();

	// Register commands
	const commands = [
		vscode.commands.registerCommand(
			COMMANDS.CREATE_CONFLICT,
			errorWrapper(
				async (payload: CreateConflictPayload): Promise<any> => {
					console.log('Creating conflict:', payload.title);

					try {
						// Create a conflict
						const conflict = {
							id: `conflict-${Date.now()}`,
							timestamp: new Date().toISOString(),
							title: payload.title,
							description: payload.description,
							filePath: payload.filePath,
							status: 'unresolved' as const,
							agentChanges: payload.agentChanges || [],
							userChanges: payload.userChanges || [],
							resolvedContent: null,
						};

						// Save the conflict
						await storageService.saveConflict(conflict);

						return {
							conflict,
							success: true,
						};
					} catch (error) {
						console.error('Error creating conflict:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'CREATE_CONFLICT',
				'Create a conflict record for a file',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GET_CONFLICTS,
			errorWrapper(
				async (status?: string): Promise<any[]> => {
					// Get all conflicts from storage
					const conflicts = await storageService.getConflicts();

					// If status is provided, filter conflicts by status
					if (status) {
						return conflicts.filter((c) => c.status === status);
					}

					return conflicts;
				},
				'GET_CONFLICTS',
				'Get all conflicts or conflicts with a specific status',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.DELETE_CONFLICT,
			errorWrapper(
				async (conflictId: string): Promise<boolean> => {
					console.log(`Deleting conflict: ${conflictId}`);

					// Delete the conflict from storage
					await storageService.deleteConflict(conflictId);

					return true;
				},
				'DELETE_CONFLICT',
				'Delete a conflict',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.RESOLVE_CONFLICT,
			errorWrapper(
				async (payload: ResolveConflictPayload): Promise<any> => {
					console.log(`Resolving conflict: ${payload.conflictId}`);

					try {
						// Get the conflict
						const conflicts = await storageService.getConflicts();
						const conflictIndex = conflicts.findIndex((c) => c.id === payload.conflictId);

						if (conflictIndex === -1) {
							throw new Error(`Conflict ${payload.conflictId} not found`);
						}

						const conflict = conflicts[conflictIndex];

						// Update the conflict with the resolved content
						conflict.resolvedContent = payload.resolvedContent;
						conflict.status = 'resolved';

						// Save the conflict
						await storageService.saveConflict(conflict);

						// Apply the resolved content to the file
						await diffService.applyFileChange({
							path: conflict.filePath,
							content: payload.resolvedContent,
							type: 'modify',
						});

						// Show a success message
						vscode.window.showInformationMessage(
							`Conflict ${payload.conflictId} resolved and applied to ${conflict.filePath}`,
						);

						return {
							conflict,
							success: true,
						};
					} catch (error) {
						console.error('Error resolving conflict:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'RESOLVE_CONFLICT',
				'Resolve a conflict with custom content',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.RESOLVE_CONFLICT_WITH_AGENT,
			errorWrapper(
				async (conflictId: string): Promise<any> => {
					console.log(`Resolving conflict with agent changes: ${conflictId}`);

					try {
						// Get the conflict first
						const conflicts = await storageService.getConflicts();
						const conflict = conflicts.find((c) => c.id === conflictId);

						if (!conflict) {
							throw new Error(`Conflict ${conflictId} not found`);
						}

						// Resolve the conflict automatically using agent changes
						const resolvedChanges = await storageService.resolveConflictAutomatically(conflictId, 'agent');

						// Get the updated conflict after resolution
						const updatedConflicts = await storageService.getConflicts();
						const updatedConflict = updatedConflicts.find((c) => c.id === conflictId);

						if (updatedConflict && updatedConflict.resolvedContent) {
							// Apply the resolved content to the file
							await diffService.applyFileChange({
								path: updatedConflict.filePath,
								content: updatedConflict.resolvedContent,
								type: 'modify',
							});

							// Show a success message
							vscode.window.showInformationMessage(
								`Conflict ${conflictId} resolved with agent changes and applied to ${updatedConflict.filePath}`,
							);

							return {
								success: true,
								conflict: updatedConflict,
								changes: resolvedChanges,
							};
						} else {
							throw new Error('Failed to resolve conflict: No resolved content available');
						}
					} catch (error) {
						console.error('Error resolving conflict with agent changes:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'RESOLVE_CONFLICT_WITH_AGENT',
				'Resolve a conflict using agent changes',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.RESOLVE_CONFLICT_WITH_USER,
			errorWrapper(
				async (conflictId: string): Promise<any> => {
					console.log(`Resolving conflict with user changes: ${conflictId}`);

					try {
						// Get the conflict first
						const conflicts = await storageService.getConflicts();
						const conflict = conflicts.find((c) => c.id === conflictId);

						if (!conflict) {
							throw new Error(`Conflict ${conflictId} not found`);
						}

						// Resolve the conflict automatically using user changes
						const resolvedChanges = await storageService.resolveConflictAutomatically(conflictId, 'user');

						// Get the updated conflict after resolution
						const updatedConflicts = await storageService.getConflicts();
						const updatedConflict = updatedConflicts.find((c) => c.id === conflictId);

						if (updatedConflict && updatedConflict.resolvedContent) {
							// Apply the resolved content to the file
							await diffService.applyFileChange({
								path: updatedConflict.filePath,
								content: updatedConflict.resolvedContent,
								type: 'modify',
							});

							// Show a success message
							vscode.window.showInformationMessage(
								`Conflict ${conflictId} resolved with user changes and applied to ${updatedConflict.filePath}`,
							);

							return {
								success: true,
								conflict: updatedConflict,
								changes: resolvedChanges,
							};
						} else {
							throw new Error('Failed to resolve conflict: No resolved content available');
						}
					} catch (error) {
						console.error('Error resolving conflict with user changes:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'RESOLVE_CONFLICT_WITH_USER',
				'Resolve a conflict using user changes',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.VIEW_CONFLICT_DIFF,
			errorWrapper(
				async (conflictId: string): Promise<void> => {
					console.log(`Viewing diff for conflict: ${conflictId}`);

					try {
						// Get the conflict
						const conflicts = await storageService.getConflicts();
						const conflict = conflicts.find((c) => c.id === conflictId);

						if (!conflict) {
							throw new Error(`Conflict ${conflictId} not found`);
						}

						// Get the current file content
						let originalContent: string = '';
						try {
							const fileContent = await diffService.getFileContent(conflict.filePath);
							originalContent = fileContent || '';
						} catch (error) {
							console.error(`Error getting file content for ${conflict.filePath}:`, error);
							originalContent = '';
						}

						// Show a quick pick to select which diff to view
						const options = [
							{
								label: 'Agent Changes',
								description: 'View diff between original and agent changes',
								content: conflict.agentChanges.length > 0 ? conflict.agentChanges[0].content : '',
							},
							{
								label: 'User Changes',
								description: 'View diff between original and user changes',
								content: conflict.userChanges.length > 0 ? conflict.userChanges[0].content : '',
							},
						];

						if (conflict.status === 'resolved' && conflict.resolvedContent) {
							options.push({
								label: 'Resolved Content',
								description: 'View diff between original and resolved content',
								content: conflict.resolvedContent,
							});
						}

						const selectedOption = await vscode.window.showQuickPick(options, {
							placeHolder: 'Select which diff to view',
						});

						if (!selectedOption) {
							return;
						}

						// Show the diff
						await diffService.showDiff(
							originalContent,
							selectedOption.content,
							`Diff for ${conflict.filePath} (${selectedOption.label})`,
						);
					} catch (error) {
						console.error(`Error viewing conflict diff: ${error}`);
						vscode.window.showErrorMessage(`Failed to view conflict diff: ${error}`);
					}
				},
				'VIEW_CONFLICT_DIFF',
				'View diff for a conflict',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.MERGE_CONFLICT_CHANGES,
			errorWrapper(
				async (conflictId: string): Promise<any> => {
					console.log(`Merging changes for conflict: ${conflictId}`);

					try {
						// Get the conflict
						const conflicts = await storageService.getConflicts();
						const conflict = conflicts.find((c) => c.id === conflictId);

						if (!conflict) {
							throw new Error(`Conflict ${conflictId} not found`);
						}

						// Get the current file content
						let originalContent: string = '';
						try {
							const fileContent = await diffService.getFileContent(conflict.filePath);
							originalContent = fileContent || '';
						} catch (error) {
							console.error(`Error getting file content for ${conflict.filePath}:`, error);
							originalContent = '';
						}

						// Get agent and user changes
						const agentContent =
							conflict.agentChanges.length > 0 ? conflict.agentChanges[0].content : originalContent;
						const userContent =
							conflict.userChanges.length > 0 ? conflict.userChanges[0].content : originalContent;

						// Create a merged content with conflict markers
						const mergedContent = `<<<<<<< AGENT CHANGES
${agentContent}
=======
${userContent}
>>>>>>> USER CHANGES`;

						// Create a temporary file with the merged content
						const tempFilePath = `${conflict.filePath}.merge`;
						await diffService.applyFileChange({
							path: tempFilePath,
							content: mergedContent,
							type: 'create',
						});

						// Open the file in the editor
						const uri = vscode.Uri.file(tempFilePath);
						await vscode.window.showTextDocument(uri);

						// Show a message with instructions
						vscode.window
							.showInformationMessage(
								'Resolve the conflict by editing the file, then save it and use the "Complete Conflict Merge" command',
								'Complete Merge',
							)
							.then(async (selection) => {
								if (selection === 'Complete Merge') {
									// Get the content of the temporary file
									const resolvedContent = await diffService.getFileContent(tempFilePath);

									// Resolve the conflict with the merged content
									await vscode.commands.executeCommand(COMMANDS.RESOLVE_CONFLICT, {
										conflictId,
										resolvedContent,
									});

									// Delete the temporary file
									await diffService.deleteFile(tempFilePath);
								}
							});

						return {
							success: true,
							tempFilePath,
						};
					} catch (error) {
						console.error('Error merging conflict changes:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'MERGE_CONFLICT_CHANGES',
				'Merge changes for a conflict',
			),
		),
	];

	// Add commands to context subscriptions
	context.subscriptions.push(...commands);
}
