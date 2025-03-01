/* eslint-disable header/header */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { errorWrapper, ErrorSeverity } from './errorHandling';
import { StorageService } from './storage';
import { DiffUtils } from './diffUtils';

/**
 * Register all commands for the extension
 * @param context Extension context
 */
export function registerCommands(context: vscode.ExtensionContext) {
	// Initialize the storage service
	const storageService = StorageService.getInstance(context);

	// Register diff and code management commands
	const commands = [
		vscode.commands.registerCommand(
			'tribe.applyChanges',
			errorWrapper(
				async (payload: {
					filesToModify: Array<{ path: string; content: string }>;
					filesToCreate: Array<{ path: string; content: string }>;
					filesToDelete: string[];
				}): Promise<boolean> => {
					console.log('Applying changes:', payload);

					try {
						// Process file modifications
						if (payload.filesToModify && payload.filesToModify.length > 0) {
							for (const file of payload.filesToModify) {
								// Get the original content if the file exists
								const originalContent = DiffUtils.getFileContent(file.path) || '';

								// Generate a FileChange object with hunks
								const fileChange = DiffUtils.generateFileChange(
									file.path,
									originalContent,
									file.content,
								);

								// Apply the file change
								if (!DiffUtils.applyFileChange(fileChange)) {
									console.error(`Failed to apply changes to file: ${file.path}`);
									return false;
								}

								console.log(`Modified file: ${file.path}`);
							}
						}

						// Process file creations
						if (payload.filesToCreate && payload.filesToCreate.length > 0) {
							for (const file of payload.filesToCreate) {
								// Generate a FileChange object
								const fileChange = {
									path: file.path,
									content: file.content,
								};

								// Apply the file change
								if (!DiffUtils.applyFileChange(fileChange)) {
									console.error(`Failed to create file: ${file.path}`);
									return false;
								}

								console.log(`Created file: ${file.path}`);
							}
						}

						// Process file deletions
						if (payload.filesToDelete && payload.filesToDelete.length > 0) {
							for (const filePath of payload.filesToDelete) {
								// Delete the file
								if (!DiffUtils.deleteFile(filePath)) {
									console.warn(`File not found for deletion or deletion failed: ${filePath}`);
								} else {
									console.log(`Deleted file: ${filePath}`);
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
			'tribe.acceptChangeGroup',
			errorWrapper(
				async (groupId: string): Promise<boolean> => {
					console.log('Accepting change group:', groupId);

					// Get the change group from storage
					const groups = await storageService.getChangeGroups();
					const group = groups.find((g) => g.id === groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Apply all changes in the group
					const payload = {
						filesToModify: group.files.modify || [],
						filesToCreate: group.files.create || [],
						filesToDelete: group.files.delete || [],
					};

					const result = await vscode.commands.executeCommand('tribe.applyChanges', payload);

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
			'tribe.rejectChangeGroup',
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
			'tribe.acceptFile',
			errorWrapper(
				async (
					groupId: string,
					filePath: string,
					fileType: 'modify' | 'create' | 'delete',
				): Promise<boolean> => {
					console.log(`Accepting file: ${filePath} (${fileType}) from group: ${groupId}`);

					// Get the change group from storage
					const groups = await storageService.getChangeGroups();
					const group = groups.find((g) => g.id === groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Find the file in the appropriate list
					let fileToApply;
					let result = false;

					if (fileType === 'modify') {
						fileToApply = group.files.modify.find((f) => f.path === filePath);
						if (fileToApply) {
							result = await vscode.commands.executeCommand('tribe.applyChanges', {
								filesToModify: [fileToApply],
								filesToCreate: [],
								filesToDelete: [],
							});

							// If successful, remove the file from the group
							if (result) {
								group.files.modify = group.files.modify.filter((f) => f.path !== filePath);
							}
						}
					} else if (fileType === 'create') {
						fileToApply = group.files.create.find((f) => f.path === filePath);
						if (fileToApply) {
							result = await vscode.commands.executeCommand('tribe.applyChanges', {
								filesToModify: [],
								filesToCreate: [fileToApply],
								filesToDelete: [],
							});

							// If successful, remove the file from the group
							if (result) {
								group.files.create = group.files.create.filter((f) => f.path !== filePath);
							}
						}
					} else if (fileType === 'delete') {
						if (group.files.delete.includes(filePath)) {
							result = await vscode.commands.executeCommand('tribe.applyChanges', {
								filesToModify: [],
								filesToCreate: [],
								filesToDelete: [filePath],
							});

							// If successful, remove the file from the group
							if (result) {
								group.files.delete = group.files.delete.filter((p) => p !== filePath);
							}
						}
					}

					// If the group is now empty, remove it from storage
					if (
						group.files.modify.length === 0 &&
						group.files.create.length === 0 &&
						group.files.delete.length === 0
					) {
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
			'tribe.rejectFile',
			errorWrapper(
				async (
					groupId: string,
					filePath: string,
					fileType: 'modify' | 'create' | 'delete',
				): Promise<boolean> => {
					console.log(`Rejecting file: ${filePath} (${fileType}) from group: ${groupId}`);

					// Get the change group from storage
					const groups = await storageService.getChangeGroups();
					const group = groups.find((g) => g.id === groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Remove the file from the appropriate list
					if (fileType === 'modify') {
						group.files.modify = group.files.modify.filter((f) => f.path !== filePath);
					} else if (fileType === 'create') {
						group.files.create = group.files.create.filter((f) => f.path !== filePath);
					} else if (fileType === 'delete') {
						group.files.delete = group.files.delete.filter((p) => p !== filePath);
					}

					// If the group is now empty, remove it from storage
					if (
						group.files.modify.length === 0 &&
						group.files.create.length === 0 &&
						group.files.delete.length === 0
					) {
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
			'tribe.modifyChange',
			errorWrapper(
				async (groupId: string, filePath: string, newContent: string): Promise<boolean> => {
					console.log(`Modifying change: ${filePath} in group: ${groupId}`);

					// Get the change group from storage
					const groups = await storageService.getChangeGroups();
					const group = groups.find((g) => g.id === groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return false;
					}

					// Find the file in the appropriate list and update its content
					let fileUpdated = false;

					// Check in modify list
					const modifyIndex = group.files.modify.findIndex((f) => f.path === filePath);
					if (modifyIndex >= 0) {
						group.files.modify[modifyIndex].content = newContent;
						fileUpdated = true;
					}

					// Check in create list
					const createIndex = group.files.create.findIndex((f) => f.path === filePath);
					if (createIndex >= 0) {
						group.files.create[createIndex].content = newContent;
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
			'tribe.requestExplanation',
			errorWrapper(
				async (groupId: string, filePath: string): Promise<string> => {
					console.log(`Requesting explanation for: ${filePath} in group: ${groupId}`);

					// Get the change group from storage
					const groups = await storageService.getChangeGroups();
					const group = groups.find((g) => g.id === groupId);

					if (!group) {
						console.warn(`Change group not found: ${groupId}`);
						return "Couldn't find the change group to explain.";
					}

					// Find the file in the appropriate list
					let fileToExplain;
					let fileType: 'modify' | 'create' | 'delete' = 'modify';

					// Check in modify list
					fileToExplain = group.files.modify.find((f) => f.path === filePath);
					if (fileToExplain) {
						fileType = 'modify';
					} else {
						// Check in create list
						fileToExplain = group.files.create.find((f) => f.path === filePath);
						if (fileToExplain) {
							fileType = 'create';
						} else {
							// Check in delete list
							if (group.files.delete.includes(filePath)) {
								fileType = 'delete';
							}
						}
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
			'tribe.getPendingChanges',
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
			'tribe.viewDiff',
			errorWrapper(
				async (originalContent: string, newContent: string, title: string): Promise<void> => {
					// Use the DiffUtils class to show the diff
					await DiffUtils.showDiff(originalContent, newContent, title);
				},
				'VIEW_DIFF',
				'View diff between original and new content',
			),
		),

		vscode.commands.registerCommand(
			'tribe.createCheckpoint',
			errorWrapper(
				async (description: string): Promise<any> => {
					console.log(`Creating checkpoint: ${description}`);

					// Create a checkpoint ID
					const checkpointId = `checkpoint-${Date.now()}`;

					// Create a snapshot of the current workspace
					const snapshot = await storageService.createWorkspaceSnapshot();

					// Create the checkpoint object
					const checkpoint = {
						id: checkpointId,
						timestamp: new Date().toISOString(),
						description,
						changes: {
							modified: 0,
							created: 0,
							deleted: 0,
						},
						snapshotPath: '', // This will be set by saveCheckpoint
					};

					// Save the checkpoint to storage
					await storageService.saveCheckpoint(checkpoint, snapshot);

					return checkpoint;
				},
				'CREATE_CHECKPOINT',
				'Create a checkpoint of the current workspace state',
			),
		),

		vscode.commands.registerCommand(
			'tribe.getCheckpoints',
			errorWrapper(
				async (): Promise<any[]> => {
					// Get all checkpoints from storage
					return storageService.getCheckpoints();
				},
				'GET_CHECKPOINTS',
				'Get all checkpoints',
			),
		),

		vscode.commands.registerCommand(
			'tribe.restoreCheckpoint',
			errorWrapper(
				async (checkpointId: string): Promise<boolean> => {
					console.log(`Restoring checkpoint: ${checkpointId}`);

					try {
						// Get the checkpoint snapshot
						const snapshot = await storageService.getCheckpointSnapshot(checkpointId);

						// Restore the workspace from the snapshot
						await storageService.restoreWorkspaceFromSnapshot(snapshot);

						return true;
					} catch (error) {
						console.error(`Error restoring checkpoint: ${error}`);
						return false;
					}
				},
				'RESTORE_CHECKPOINT',
				'Restore workspace to a checkpoint',
			),
		),

		vscode.commands.registerCommand(
			'tribe.deleteCheckpoint',
			errorWrapper(
				async (checkpointId: string): Promise<boolean> => {
					console.log(`Deleting checkpoint: ${checkpointId}`);

					// Delete the checkpoint from storage
					await storageService.deleteCheckpoint(checkpointId);
					return true;
				},
				'DELETE_CHECKPOINT',
				'Delete a checkpoint',
			),
		),

		vscode.commands.registerCommand(
			'tribe.viewCheckpointDiff',
			errorWrapper(
				async (checkpointId: string): Promise<void> => {
					console.log(`Viewing diff for checkpoint: ${checkpointId}`);

					try {
						// Get the checkpoint snapshot
						const checkpointSnapshot = await storageService.getCheckpointSnapshot(checkpointId);

						// Create a snapshot of the current workspace
						const currentSnapshot = await storageService.createWorkspaceSnapshot();

						// Calculate the diff between the two snapshots
						const diff = storageService.calculateDiff(checkpointSnapshot, currentSnapshot);

						// Show a summary of the diff
						const message = `Changes since checkpoint:
- Modified: ${diff.modified.length} files
- Created: ${diff.created.length} files
- Deleted: ${diff.deleted.length} files`;

						vscode.window.showInformationMessage(message);

						// If there are modified files, show the first one
						if (diff.modified.length > 0) {
							const filePath = diff.modified[0];
							const originalContent = checkpointSnapshot[filePath] || '';
							const newContent = currentSnapshot[filePath] || '';

							// Use DiffUtils to show the diff
							await DiffUtils.showDiff(
								originalContent,
								newContent,
								`Diff for ${filePath} (Checkpoint vs Current)`,
							);
						}
					} catch (error) {
						console.error(`Error viewing checkpoint diff: ${error}`);
						vscode.window.showErrorMessage(`Failed to view checkpoint diff: ${error}`);
					}
				},
				'VIEW_CHECKPOINT_DIFF',
				'View diff between checkpoint and current state',
			),
		),

		vscode.commands.registerCommand(
			'tribe.getAnnotations',
			errorWrapper(
				async (): Promise<any[]> => {
					// Get all annotations from storage
					return storageService.getAnnotations();
				},
				'GET_ANNOTATIONS',
				'Get all annotations',
			),
		),

		vscode.commands.registerCommand(
			'tribe.addAnnotation',
			errorWrapper(
				async (annotation: any): Promise<any> => {
					console.log(`Adding annotation: ${JSON.stringify(annotation)}`);

					// Create an annotation ID if not provided
					if (!annotation.id) {
						annotation.id = `annotation-${Date.now()}`;
					}

					// Set timestamp if not provided
					if (!annotation.timestamp) {
						annotation.timestamp = new Date().toISOString();
					}

					// Initialize replies if not provided
					if (!annotation.replies) {
						annotation.replies = [];
					}

					// Save the annotation to storage
					await storageService.saveAnnotation(annotation);

					return annotation;
				},
				'ADD_ANNOTATION',
				'Add an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.editAnnotation',
			errorWrapper(
				async (id: string, content: string): Promise<boolean> => {
					console.log(`Editing annotation: ${id} with content: ${content}`);

					// Get all annotations from storage
					const annotations = await storageService.getAnnotations();

					// Helper function to recursively find and update the annotation
					const updateAnnotation = (items: any[]): boolean => {
						for (const item of items) {
							if (item.id === id) {
								item.content = content;
								return true;
							}
							if (item.replies && item.replies.length > 0) {
								if (updateAnnotation(item.replies)) {
									return true;
								}
							}
						}
						return false;
					};

					// Update the annotation
					if (updateAnnotation(annotations)) {
						// Save the updated annotations to storage
						await storageService.getAnnotations().then(async () => {
							for (const annotation of annotations) {
								await storageService.saveAnnotation(annotation);
							}
						});
						return true;
					}

					return false;
				},
				'EDIT_ANNOTATION',
				'Edit an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.deleteAnnotation',
			errorWrapper(
				async (id: string): Promise<boolean> => {
					console.log(`Deleting annotation: ${id}`);

					// Delete the annotation from storage
					await storageService.deleteAnnotation(id);
					return true;
				},
				'DELETE_ANNOTATION',
				'Delete an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.replyToAnnotation',
			errorWrapper(
				async (parentId: string, reply: any): Promise<any> => {
					console.log(`Replying to annotation: ${parentId} with: ${JSON.stringify(reply)}`);

					// Create a reply ID if not provided
					if (!reply.id) {
						reply.id = `reply-${Date.now()}`;
					}

					// Set timestamp if not provided
					if (!reply.timestamp) {
						reply.timestamp = new Date().toISOString();
					}

					// Initialize replies if not provided
					if (!reply.replies) {
						reply.replies = [];
					}

					// Add the reply to the parent annotation
					await storageService.addReplyToAnnotation(parentId, reply);

					return reply;
				},
				'REPLY_TO_ANNOTATION',
				'Reply to an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.selectImplementation',
			errorWrapper(
				async (implementationId: string): Promise<boolean> => {
					console.log(`Selecting implementation: ${implementationId}`);

					// Get the implementation from storage
					const implementations = await storageService.getImplementations();
					const implementation = implementations.find((i) => i.id === implementationId);

					if (!implementation) {
						console.warn(`Implementation not found: ${implementationId}`);
						return false;
					}

					// Convert the implementation to a change group
					const changeGroup = {
						id: `group-${Date.now()}`,
						title: implementation.title,
						description: implementation.description,
						agentId: 'system',
						agentName: 'System',
						timestamp: new Date().toISOString(),
						files: implementation.files,
					};

					// Save the change group to storage
					await storageService.saveChangeGroup(changeGroup);

					// Delete the implementation from storage
					await storageService.deleteImplementation(implementationId);

					return true;
				},
				'SELECT_IMPLEMENTATION',
				'Select an alternative implementation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.generateHunks',
			errorWrapper(
				async (filePath: string, originalContent: string, modifiedContent: string): Promise<any[]> => {
					console.log(`Generating hunks for file: ${filePath}`);

					// Use DiffUtils to generate hunks
					return DiffUtils.generateHunks(originalContent, modifiedContent);
				},
				'GENERATE_HUNKS',
				'Generate hunks for a file change',
			),
		),

		vscode.commands.registerCommand(
			'tribe.createChangeGroup',
			errorWrapper(
				async (payload: {
					title: string;
					description: string;
					agentId: string;
					agentName: string;
					filesToModify: Array<{ path: string; content: string }>;
					filesToCreate: Array<{ path: string; content: string }>;
					filesToDelete: string[];
				}): Promise<string> => {
					console.log(`Creating change group: ${payload.title}`);

					// Generate a unique ID for the change group
					const groupId = `group-${Date.now()}`;

					// Create file changes with hunks for modified files
					const modifyChanges = await Promise.all(
						payload.filesToModify.map(async (file) => {
							// Get the original content if the file exists
							const originalContent = DiffUtils.getFileContent(file.path) || '';

							// Generate a FileChange object with hunks
							return DiffUtils.generateFileChange(file.path, originalContent, file.content);
						}),
					);

					// Create file changes for new files
					const createChanges = payload.filesToCreate.map((file) => ({
						path: file.path,
						content: file.content,
						explanation: `Created new file: ${file.path}`,
					}));

					// Create the change group
					const changeGroup = {
						id: groupId,
						title: payload.title,
						description: payload.description,
						agentId: payload.agentId,
						agentName: payload.agentName,
						timestamp: new Date().toISOString(),
						files: {
							modify: modifyChanges,
							create: createChanges,
							delete: payload.filesToDelete,
						},
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
			'tribe.getWorkspaceSnapshot',
			errorWrapper(
				async (): Promise<Record<string, string>> => {
					console.log('Getting workspace snapshot');

					// Use the storage service to create a workspace snapshot
					return storageService.createWorkspaceSnapshot();
				},
				'GET_WORKSPACE_SNAPSHOT',
				'Get a snapshot of the current workspace',
			),
		),

		// Enhanced diff algorithm commands
		vscode.commands.registerCommand(
			'tribe.calculateDetailedDiff',
			errorWrapper(
				async (payload: { oldContent: string; newContent: string; filePath: string }): Promise<any> => {
					console.log('Calculating detailed diff for:', payload.filePath);

					try {
						// Generate a FileChange object with hunks using Myers diff algorithm
						const fileChange = DiffUtils.generateFileChange(
							payload.filePath,
							payload.oldContent,
							payload.newContent,
						);

						return {
							fileChange,
							success: true,
						};
					} catch (error) {
						console.error('Error calculating detailed diff:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Calculate detailed diff',
				ErrorSeverity.ERROR,
			),
		),

		// Conflict resolution commands
		vscode.commands.registerCommand(
			'tribe.detectConflicts',
			errorWrapper(
				async (payload: {
					changes: Array<{
						agentId: string;
						agentName: string;
						files: {
							modify: Array<{ path: string; content: string; originalContent?: string }>;
							create: Array<{ path: string; content: string }>;
							delete: string[];
						};
					}>;
				}): Promise<any> => {
					console.log('Detecting conflicts in changes from multiple agents');

					try {
						const conflicts: Array<{
							id: string;
							type: 'merge' | 'dependency' | 'logic' | 'other';
							description: string;
							status: 'pending';
							files: string[];
							conflictingChanges: Record<string, any[]>;
						}> = [];

						// Group changes by file path
						const fileChanges: Record<
							string,
							Array<{
								agentId: string;
								agentName: string;
								content: string;
								originalContent?: string;
							}>
						> = {};

						// Collect all file modifications
						for (const change of payload.changes) {
							for (const file of change.files.modify) {
								if (!fileChanges[file.path]) {
									fileChanges[file.path] = [];
								}

								fileChanges[file.path].push({
									agentId: change.agentId,
									agentName: change.agentName,
									content: file.content,
									originalContent: file.originalContent,
								});
							}
						}

						// Detect conflicts in file modifications
						for (const [filePath, changes] of Object.entries(fileChanges)) {
							if (changes.length > 1) {
								// Check if the changes are identical
								const firstContent = changes[0].content;
								const hasConflict = changes.some((change) => change.content !== firstContent);

								if (hasConflict) {
									// Create a conflict
									const conflictId = `conflict-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
									const conflictingChanges: Record<string, any[]> = {};

									for (const change of changes) {
										if (!conflictingChanges[change.agentId]) {
											conflictingChanges[change.agentId] = [];
										}

										conflictingChanges[change.agentId].push({
											path: filePath,
											content: change.content,
											originalContent: change.originalContent,
											timestamp: new Date().toISOString(),
										});
									}

									conflicts.push({
										id: conflictId,
										type: 'merge',
										description: `Multiple agents modified ${filePath}`,
										status: 'pending',
										files: [filePath],
										conflictingChanges,
									});

									// Save the conflict to storage
									await storageService.saveConflict({
										id: conflictId,
										type: 'merge',
										description: `Multiple agents modified ${filePath}`,
										status: 'pending',
										files: [filePath],
										conflictingChanges,
									});
								}
							}
						}

						return {
							conflicts,
							success: true,
						};
					} catch (error) {
						console.error('Error detecting conflicts:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Detect conflicts',
				ErrorSeverity.ERROR,
			),
		),

		vscode.commands.registerCommand(
			'tribe.resolveConflict',
			errorWrapper(
				async (payload: {
					conflictId: string;
					resolution: 'auto' | 'manual';
					manualResolution?: {
						path: string;
						content: string;
					}[];
				}): Promise<any> => {
					console.log('Resolving conflict:', payload.conflictId);

					try {
						if (payload.resolution === 'auto') {
							// Use the automatic conflict resolution
							const resolvedChanges = await storageService.resolveConflictAutomatically(
								payload.conflictId,
							);

							return {
								resolvedChanges,
								success: true,
							};
						} else if (payload.resolution === 'manual' && payload.manualResolution) {
							// Apply the manual resolution
							const conflicts = await storageService.getConflicts();
							const conflict = conflicts.find((c) => c.id === payload.conflictId);

							if (!conflict) {
								throw new Error(`Conflict not found: ${payload.conflictId}`);
							}

							// Update the conflict with the resolved changes
							conflict.resolvedChanges = payload.manualResolution.map((file) => ({
								path: file.path,
								content: file.content,
								timestamp: new Date().toISOString(),
							}));

							conflict.status = 'resolved';
							conflict.resolutionStrategy = 'manual';
							conflict.resolutionTimestamp = new Date().toISOString();

							await storageService.saveConflict(conflict);

							return {
								resolvedChanges: conflict.resolvedChanges,
								success: true,
							};
						} else {
							throw new Error('Invalid resolution strategy or missing manual resolution');
						}
					} catch (error) {
						console.error('Error resolving conflict:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Resolve conflict',
				ErrorSeverity.ERROR,
			),
		),

		// Change history commands
		vscode.commands.registerCommand(
			'tribe.getChangeHistory',
			errorWrapper(
				async (): Promise<any> => {
					console.log('Getting change history');

					try {
						const history = await storageService.getChangeHistory();
						return {
							history,
							success: true,
						};
					} catch (error) {
						console.error('Error getting change history:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Get change history',
				ErrorSeverity.ERROR,
			),
		),

		// Checkpoint and sub-checkpoint commands
		vscode.commands.registerCommand(
			'tribe.createCheckpoint',
			errorWrapper(
				async (payload: { description: string; changeGroups?: string[] }): Promise<any> => {
					console.log('Creating checkpoint:', payload.description);

					try {
						// Create a snapshot of the current workspace
						const snapshotData = await storageService.createWorkspaceSnapshot();

						// Create a checkpoint
						const checkpoint = {
							id: `checkpoint-${Date.now()}`,
							timestamp: new Date().toISOString(),
							description: payload.description,
							changes: {
								modified: 0,
								created: 0,
								deleted: 0,
							},
							snapshotPath: '',
							changeGroups: payload.changeGroups || [],
						};

						// Save the checkpoint
						await storageService.saveCheckpoint(checkpoint, snapshotData);

						return {
							checkpoint,
							success: true,
						};
					} catch (error) {
						console.error('Error creating checkpoint:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Create checkpoint',
				ErrorSeverity.ERROR,
			),
		),

		vscode.commands.registerCommand(
			'tribe.createSubCheckpoint',
			errorWrapper(
				async (payload: {
					parentCheckpointId: string;
					description: string;
					changes: {
						modified: string[];
						created: string[];
						deleted: string[];
					};
				}): Promise<any> => {
					console.log('Creating sub-checkpoint for:', payload.parentCheckpointId);

					try {
						const subCheckpoint = await storageService.createSubCheckpoint(
							payload.parentCheckpointId,
							payload.description,
							payload.changes,
						);

						return {
							subCheckpoint,
							success: true,
						};
					} catch (error) {
						console.error('Error creating sub-checkpoint:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Create sub-checkpoint',
				ErrorSeverity.ERROR,
			),
		),

		vscode.commands.registerCommand(
			'tribe.revertToSubCheckpoint',
			errorWrapper(
				async (payload: { parentCheckpointId: string; subCheckpointId: string }): Promise<any> => {
					console.log('Reverting to sub-checkpoint:', payload.subCheckpointId);

					try {
						await storageService.revertToSubCheckpoint(payload.parentCheckpointId, payload.subCheckpointId);

						return {
							success: true,
						};
					} catch (error) {
						console.error('Error reverting to sub-checkpoint:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Revert to sub-checkpoint',
				ErrorSeverity.ERROR,
			),
		),

		// Semantic grouping commands
		vscode.commands.registerCommand(
			'tribe.groupChangesByFeature',
			errorWrapper(
				async (payload: {
					fileChanges: Array<{
						path: string;
						content: string;
						originalContent?: string;
						hunks?: Array<{
							startLine: number;
							endLine: number;
							content: string;
							originalContent?: string;
							semanticGroup?: string;
						}>;
					}>;
				}): Promise<any> => {
					console.log('Grouping changes by feature');

					try {
						const groupedChanges = storageService.groupFileChangesByFeature(payload.fileChanges);

						return {
							groupedChanges,
							success: true,
						};
					} catch (error) {
						console.error('Error grouping changes by feature:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'Group changes by feature',
				ErrorSeverity.ERROR,
			),
		),
	];

	// Register all commands
	context.subscriptions.push(...commands);
}
