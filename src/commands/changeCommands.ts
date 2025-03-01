/* eslint-disable header/header */

import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { DiffService } from '../services/diffService';
import { ApplyChangesPayload, CreateChangeGroupPayload } from '../models/types';
import { errorWrapper } from '../errorHandling';
import { COMMANDS, API_ENDPOINTS } from '../config';

/**
 * Register change management commands
 * @param context Extension context
 */
export function registerChangeCommands(context: vscode.ExtensionContext): void {
	// Initialize services
	const storageService = StorageService.getInstance(context);
	const diffService = DiffService.getInstance();

	// Register commands
	const commands = [
		vscode.commands.registerCommand(
			COMMANDS.APPLY_CHANGES,
			errorWrapper(
				async (payload: ApplyChangesPayload): Promise<boolean> => {
					console.log('Applying changes:', payload);

					try {
						// Process file modifications
						if (payload.files.modify && Object.keys(payload.files.modify).length > 0) {
							for (const path in payload.files.modify) {
								// Get the original content if the file exists
								const originalContent = diffService.getFileContent(path) || '';

								// Generate a FileChange object with hunks
								const fileChange = diffService.generateFileChange(
									path,
									originalContent,
									payload.files.modify[path],
								);

								// Apply the file change
								if (!diffService.applyFileChange(fileChange)) {
									console.error(`Failed to modify file: ${path}`);
									return false;
								}
							}
						}

						// Process file creations
						if (payload.files.create && Object.keys(payload.files.create).length > 0) {
							for (const path in payload.files.create) {
								// Generate a FileChange object
								const fileChange = {
									path: path,
									content: payload.files.create[path],
									type: 'create' as const,
								};

								// Apply the file change
								if (!diffService.applyFileChange(fileChange)) {
									console.error(`Failed to create file: ${path}`);
									return false;
								}
							}
						}

						// Process file deletions
						if (payload.files.delete && payload.files.delete.length > 0) {
							for (const path of payload.files.delete) {
								// Delete the file
								if (!diffService.deleteFile(path)) {
									console.error(`Failed to delete file: ${path}`);
									return false;
								}
							}
						}

						return true;
					} catch (error) {
						console.error('Error applying changes:', error);
						throw error;
					}
				},
				'APPLY_CHANGES',
				'Apply code changes to workspace files',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.CREATE_CHANGE_GROUP,
			errorWrapper(
				async (payload: CreateChangeGroupPayload): Promise<string> => {
					console.log(`Creating change group: ${payload.title}`);

					// Generate a unique ID for the change group
					const groupId = `group-${Date.now()}`;

					// Create file changes with hunks for modified files
					const modifyChanges = await Promise.all(
						(payload.filesToModify || []).map(async (file: { path: string; content: string }) => {
							// Get the original content if the file exists
							const originalContent = diffService.getFileContent(file.path) || '';

							// Generate a FileChange object with hunks
							return {
								...diffService.generateFileChange(file.path, originalContent, file.content),
								type: 'modify' as const,
							};
						}),
					);

					// Create file changes for new files
					const createChanges = (payload.filesToCreate || []).map(
						(file: { path: string; content: string }) => ({
							path: file.path,
							content: file.content,
							type: 'create' as const,
							explanation: `Created new file: ${file.path}`,
						}),
					);

					// Create delete file changes
					const deleteChanges = (payload.filesToDelete || []).map((path: string) => ({
						path,
						content: '',
						type: 'delete' as const,
					}));

					// Create the change group
					const changeGroup = {
						id: groupId,
						title: payload.title,
						description: payload.description,
						agentId: payload.agentId,
						agentName: payload.agentName,
						timestamp: new Date().toISOString(),
						files: [...modifyChanges, ...createChanges, ...deleteChanges],
						status: 'pending' as const,
					};

					// Save the change group
					await storageService.saveChangeGroup(changeGroup);

					return groupId;
				},
				'CREATE_CHANGE_GROUP',
				'Create a change group from a set of changes',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.ACCEPT_CHANGE_GROUP,
			errorWrapper(
				async (groupId: string): Promise<boolean> => {
					console.log('Accepting change group:', groupId);

					// Get the change group from storage
					const group = await storageService.getChangeGroup(groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Apply all changes in the group
					const payload: ApplyChangesPayload = {
						files: {
							modify: {},
							create: {},
							delete: [],
						},
					};

					// Categorize files by type
					for (const file of group.files) {
						if (file.type === 'modify') {
							payload.files.modify[file.path] = file.content;
						} else if (file.type === 'create') {
							payload.files.create[file.path] = file.content;
						} else if (file.type === 'delete') {
							payload.files.delete.push(file.path);
						}
					}

					const result = await vscode.commands.executeCommand(COMMANDS.APPLY_CHANGES, payload);

					// If successful, remove the group from storage
					if (result) {
						await storageService.deleteChangeGroup(groupId);
					}

					return !!result;
				},
				'ACCEPT_CHANGE_GROUP',
				'Accept all changes in a change group',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.REJECT_CHANGE_GROUP,
			errorWrapper(
				async (groupId: string): Promise<boolean> => {
					console.log('Rejecting change group:', groupId);

					// Remove the group from storage
					await storageService.deleteChangeGroup(groupId);
					return true;
				},
				'REJECT_CHANGE_GROUP',
				'Reject all changes in a change group',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.ACCEPT_FILE,
			errorWrapper(
				async (
					groupId: string,
					filePath: string,
					fileType: 'modify' | 'create' | 'delete',
				): Promise<boolean> => {
					console.log(`Accepting file: ${filePath} (${fileType}) from group: ${groupId}`);

					// Get the change group from storage
					const group = await storageService.getChangeGroup(groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Find the file in the appropriate list
					let fileToApply;
					let result = false;

					if (fileType === 'modify') {
						fileToApply = group.files.find((f) => f.path === filePath && f.type === 'modify');
						if (fileToApply) {
							const payload: ApplyChangesPayload = {
								files: {
									modify: { [fileToApply.path]: fileToApply.content },
									create: {},
									delete: [],
								},
							};
							result = await vscode.commands.executeCommand(COMMANDS.APPLY_CHANGES, payload);
						}
					} else if (fileType === 'create') {
						fileToApply = group.files.find((f) => f.path === filePath && f.type === 'create');
						if (fileToApply) {
							const payload: ApplyChangesPayload = {
								files: {
									modify: {},
									create: { [fileToApply.path]: fileToApply.content },
									delete: [],
								},
							};
							result = await vscode.commands.executeCommand(COMMANDS.APPLY_CHANGES, payload);
						}
					} else if (fileType === 'delete') {
						fileToApply = group.files.find((f) => f.path === filePath && f.type === 'delete');
						if (fileToApply) {
							const payload: ApplyChangesPayload = {
								files: {
									modify: {},
									create: {},
									delete: [fileToApply.path],
								},
							};
							result = await vscode.commands.executeCommand(COMMANDS.APPLY_CHANGES, payload);
						}
					}

					// If the group is now empty, remove it from storage
					if (group.files.length === 0) {
						await storageService.deleteChangeGroup(groupId);
					} else {
						// Otherwise, update the group in storage
						await storageService.saveChangeGroup(group);
					}

					return result;
				},
				'ACCEPT_FILE',
				'Accept changes for a specific file',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.REJECT_FILE,
			errorWrapper(
				async (
					groupId: string,
					filePath: string,
					fileType: 'modify' | 'create' | 'delete',
				): Promise<boolean> => {
					console.log(`Rejecting file: ${filePath} (${fileType}) from group: ${groupId}`);

					// Get the change group from storage
					const group = await storageService.getChangeGroup(groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Remove the file from the appropriate list
					group.files = group.files.filter((file) => {
						if (fileType === 'modify') {
							return !(file.path === filePath && file.type === 'modify');
						} else if (fileType === 'create') {
							return !(file.path === filePath && file.type === 'create');
						} else if (fileType === 'delete') {
							return !(file.path === filePath && file.type === 'delete');
						}
						return true;
					});

					// If the group is now empty, remove it from storage
					if (group.files.length === 0) {
						await storageService.deleteChangeGroup(groupId);
					} else {
						// Otherwise, update the group in storage
						await storageService.saveChangeGroup(group);
					}

					return true;
				},
				'REJECT_FILE',
				'Reject changes for a specific file',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.MODIFY_CHANGE,
			errorWrapper(
				async (groupId: string, filePath: string, newContent: string): Promise<boolean> => {
					console.log(`Modifying change: ${filePath} in group: ${groupId}`);

					// Get the change group from storage
					const group = await storageService.getChangeGroup(groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Find the file in the appropriate list and update its content
					let fileUpdated = false;

					// Find the file and update its content
					const fileIndex = group.files.findIndex(
						(f) => f.path === filePath && (f.type === 'modify' || f.type === 'create'),
					);
					if (fileIndex >= 0) {
						group.files[fileIndex].content = newContent;
						fileUpdated = true;
					}

					// If the file was updated, save the group to storage
					if (fileUpdated) {
						await storageService.saveChangeGroup(group);
					}

					return fileUpdated;
				},
				'MODIFY_CHANGE',
				'Modify content of a pending change',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.REQUEST_EXPLANATION,
			errorWrapper(
				async (groupId: string, filePath: string): Promise<string> => {
					console.log(`Requesting explanation for: ${filePath} in group: ${groupId}`);

					// Get the change group from storage
					const group = await storageService.getChangeGroup(groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return "Couldn't find the file to explain.";
					}

					// Find the file in the appropriate list
					let fileToExplain = group.files.find((f) => f.path === filePath);
					let fileType: 'modify' | 'create' | 'delete' = 'modify';

					if (fileToExplain) {
						fileType = fileToExplain.type;
					} else {
						return "Couldn't find the file to explain.";
					}

					// If the file already has an explanation, return it
					if (fileToExplain && fileToExplain.explanation) {
						return fileToExplain.explanation;
					}

					// Otherwise, generate an explanation
					let explanation = '';
					if (fileType === 'modify') {
						explanation = `This change to ${filePath} implements the requested functionality by:
                    
1. Adding necessary imports and dependencies
2. Implementing the core logic for the feature
3. Ensuring proper error handling and edge cases
4. Optimizing performance where possible
5. Adding appropriate documentation

The key changes include updating function signatures, adding error handling, and improving the overall code structure.`;
					} else if (fileType === 'create') {
						explanation = `This new file ${filePath} is created to:
                    
1. Implement a new feature or component
2. Provide utility functions for the application
3. Enhance the overall architecture
4. Support the existing codebase with additional functionality
5. Improve maintainability and code organization

The file contains all necessary imports, proper error handling, and comprehensive documentation.`;
					} else if (fileType === 'delete') {
						explanation = `The file ${filePath} is being deleted because:
                    
1. Its functionality has been deprecated
2. It has been replaced by a more efficient implementation
3. It's no longer needed in the current architecture
4. Its functionality has been merged into other files
5. It contained outdated or redundant code`;
					}

					// If we found a file to explain, update its explanation
					if (fileToExplain) {
						fileToExplain.explanation = explanation;
						await storageService.saveChangeGroup(group);
					}

					return explanation;
				},
				'REQUEST_EXPLANATION',
				'Request explanation for a specific file change',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GET_PENDING_CHANGES,
			errorWrapper(
				async (): Promise<any[]> => {
					// Get all change groups from storage
					return storageService.getChangeGroups();
				},
				'GET_PENDING_CHANGES',
				'Get all pending changes',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.VIEW_DIFF,
			errorWrapper(
				async (originalContent: string, newContent: string, title: string): Promise<void> => {
					// Use the DiffService to show the diff
					await diffService.showDiff(originalContent, newContent, title);
				},
				'VIEW_DIFF',
				'View diff between original and new content',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GENERATE_HUNKS,
			errorWrapper(
				async (filePath: string, originalContent: string, modifiedContent: string): Promise<any[]> => {
					console.log(`Generating hunks for file: ${filePath}`);

					// Use DiffService to generate hunks
					return diffService.generateHunks(originalContent, modifiedContent);
				},
				'GENERATE_HUNKS',
				'Generate hunks for a file change',
			),
		),
	];

	// Add commands to context subscriptions
	context.subscriptions.push(...commands);
}
