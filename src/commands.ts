/* eslint-disable header/header */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { errorWrapper, ErrorSeverity, ErrorCategory } from './errorHandling';
import { StorageService, FileChange, ChangeGroup } from './storage';
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
				ErrorCategory.SYSTEM,
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
				ErrorCategory.SYSTEM,
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
				ErrorCategory.SYSTEM,
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
								group.files.delete = group.files.delete.filter((f) => f !== filePath);
							}
						}
					}

					if (!result) {
						console.warn(`Failed to apply changes for file: ${filePath}`);
						return false;
					}

					// If all files in the group have been processed, remove the group
					if (
						group.files.modify.length === 0 &&
						group.files.create.length === 0 &&
						group.files.delete.length === 0
					) {
						await storageService.deleteChangeGroup(groupId);
					} else {
						// Otherwise, update the group
						await storageService.updateChangeGroup(group);
					}

					return true;
				},
				'ACCEPT_FILE',
				ErrorCategory.SYSTEM,
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
						group.files.delete = group.files.delete.filter((f) => f !== filePath);
					}

					// If all files in the group have been processed, remove the group
					if (
						group.files.modify.length === 0 &&
						group.files.create.length === 0 &&
						group.files.delete.length === 0
					) {
						await storageService.deleteChangeGroup(groupId);
					} else {
						// Otherwise, update the group
						await storageService.updateChangeGroup(group);
					}

					return true;
				},
				'REJECT_FILE',
				ErrorCategory.SYSTEM,
				'Reject changes for a specific file',
			),
		),

		vscode.commands.registerCommand(
			'tribe.modifyChange',
			errorWrapper(
				async (
					changeId: string,
					newContent: string,
				): Promise<boolean> => {
					console.log(`Modifying change: ${changeId}`);

					// Get the change from storage
					const changes = await storageService.getPendingChanges();
					const changeIndex = changes.findIndex((c) => c.id === changeId);

					if (changeIndex === -1) {
						console.warn(`Change not found: ${changeId}`);
						return false;
					}

					// Update the change content
					changes[changeIndex].newContent = newContent;

					// Regenerate hunks
					changes[changeIndex] = DiffUtils.regenerateHunks(changes[changeIndex]);

					// Save the updated change
					await storageService.updatePendingChange(changes[changeIndex]);

					return true;
				},
				'MODIFY_CHANGE',
				ErrorCategory.SYSTEM,
				'Modify content of a pending change',
			),
		),

		vscode.commands.registerCommand(
			'tribe.explainChange',
			errorWrapper(
				async (changeId: string): Promise<string> => {
					console.log(`Explaining change: ${changeId}`);

					// Get the change from storage
					const changes = await storageService.getPendingChanges();
					const change = changes.find((c) => c.id === changeId);

					if (!change) {
						console.warn(`Change not found: ${changeId}`);
						return 'Change not found';
					}

					// TODO: Implement AI-powered explanation
					return 'Change explanation not yet implemented';
				},
				'EXPLAIN_CHANGE',
				ErrorCategory.SYSTEM,
				'Request explanation for a specific file change',
			),
		),

		vscode.commands.registerCommand(
			'tribe.getChanges',
			errorWrapper(
				async (): Promise<any[]> => {
					return await storageService.getPendingChanges();
				},
				'GET_CHANGES',
				ErrorCategory.SYSTEM,
				'Get all pending changes',
			),
		),

		vscode.commands.registerCommand(
			'tribe.viewDiff',
			errorWrapper(
				async (changeId: string): Promise<void> => {
					// Get the change from storage
					const changes = await storageService.getPendingChanges();
					const change = changes.find((c) => c.id === changeId);

					if (!change) {
						console.warn(`Change not found: ${changeId}`);
						return;
					}

					// Show diff in editor
					await DiffUtils.showDiff(change.path, change.originalContent, change.content);
				},
				'VIEW_DIFF',
				ErrorCategory.SYSTEM,
				'View diff between original and new content',
			),
		),

		vscode.commands.registerCommand(
			'tribe.createCheckpoint',
			errorWrapper(
				async (name?: string): Promise<string> => {
					// Generate checkpoint name if not provided
					if (!name) {
						name = `Checkpoint ${new Date().toLocaleString()}`;
					}

					// Create a snapshot of the workspace
					const snapshot = await DiffUtils.createWorkspaceSnapshot();

					// Save the checkpoint
					const checkpoint = {
						id: `checkpoint-${Date.now()}`,
						description: name || 'Checkpoint',
						timestamp: new Date().toISOString(),
						changes: {
							modified: 0,
							created: 0,
							deleted: 0
						},
						snapshotPath: '',
						snapshot,
					};

					await storageService.saveCheckpoint(checkpoint, snapshot);

					return checkpoint.id;
				},
				'CREATE_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Create a checkpoint of the current workspace state',
			),
		),

		vscode.commands.registerCommand(
			'tribe.getCheckpoints',
			errorWrapper(
				async (): Promise<any[]> => {
					return await storageService.getCheckpoints();
				},
				'GET_CHECKPOINTS',
				ErrorCategory.SYSTEM,
				'Get all checkpoints',
			),
		),

		vscode.commands.registerCommand(
			'tribe.restoreCheckpoint',
			errorWrapper(
				async (checkpointId: string): Promise<boolean> => {
					// Get the checkpoint from storage
					const checkpoints = await storageService.getCheckpoints();
					const checkpoint = checkpoints.find((c) => c.id === checkpointId);

					if (!checkpoint) {
						console.warn(`Checkpoint not found: ${checkpointId}`);
						return false;
					}

					// Get the snapshot data
					const snapshotData = await storageService.getCheckpointSnapshot(checkpoint.id);
					
					// Restore the workspace to the checkpoint
					await DiffUtils.restoreWorkspaceSnapshot(snapshotData);

					return true;
				},
				'RESTORE_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Restore workspace to a checkpoint',
			),
		),

		vscode.commands.registerCommand(
			'tribe.deleteCheckpoint',
			errorWrapper(
				async (checkpointId: string): Promise<boolean> => {
					await storageService.deleteCheckpoint(checkpointId);
					return true;
				},
				'DELETE_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Delete a checkpoint',
			),
		),

		vscode.commands.registerCommand(
			'tribe.viewCheckpointDiff',
			errorWrapper(
				async (checkpointId: string): Promise<void> => {
					// Get the checkpoint from storage
					const checkpoints = await storageService.getCheckpoints();
					const checkpoint = checkpoints.find((c) => c.id === checkpointId);

					if (!checkpoint) {
						console.warn(`Checkpoint not found: ${checkpointId}`);
						return;
					}

					// Create a snapshot of the current workspace
					const currentSnapshot = await DiffUtils.createWorkspaceSnapshot();

					// Get the snapshot data
					const snapshotData = await storageService.getCheckpointSnapshot(checkpoint.id);
					
					// Compare the snapshots and generate diffs
					const diffs = DiffUtils.compareSnapshots(snapshotData, currentSnapshot);

					// Show diffs in editor
					for (const diff of diffs) {
						await DiffUtils.showDiff(diff.path, diff.originalContent, diff.content);
					}
				},
				'VIEW_CHECKPOINT_DIFF',
				ErrorCategory.SYSTEM,
				'View diff between checkpoint and current state',
			),
		),

		vscode.commands.registerCommand(
			'tribe.getAnnotations',
			errorWrapper(
				async (): Promise<any[]> => {
					return await storageService.getAnnotations();
				},
				'GET_ANNOTATIONS',
				ErrorCategory.SYSTEM,
				'Get all annotations',
			),
		),

		vscode.commands.registerCommand(
			'tribe.addAnnotation',
			errorWrapper(
				async (annotation: {
					filePath: string;
					lineNumber: number;
					content: string;
					author?: string;
					timestamp?: string;
					type?: string;
				}): Promise<string> => {
					// Generate an ID for the annotation
					const id = `annotation-${Date.now()}`;

					// Create the annotation object
					const newAnnotation = {
						id,
						filePath: annotation.filePath,
						lineNumber: ('lineNumber' in annotation) ? annotation.lineNumber : (annotation as any).lineStart,
						content: annotation.content,
						author: {
							id: 'user-1',
							name: annotation.author || 'User',
							type: 'human' as const
						},
						timestamp: annotation.timestamp || new Date().toISOString(),
						type: annotation.type || 'comment',
						resolved: false,
						replies: [],
					};

					// Save the annotation
					await storageService.saveAnnotation(newAnnotation);

					// Decorate the editor with the annotation
					// TODO: Implement editor decoration

					return id;
				},
				'ADD_ANNOTATION',
				ErrorCategory.SYSTEM,
				'Add an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.editAnnotation',
			errorWrapper(
				async (annotationId: string, content: string): Promise<boolean> => {
					// Get the annotation from storage
					const annotations = await storageService.getAnnotations();
					const annotation = annotations.find((a) => a.id === annotationId);

					if (!annotation) {
						console.warn(`Annotation not found: ${annotationId}`);
						return false;
					}

					// Update the annotation
					annotation.content = content;
					annotation.timestamp = new Date().toISOString();

					// Save the updated annotation
					await storageService.updateAnnotation(annotation);

					return true;
				},
				'EDIT_ANNOTATION',
				ErrorCategory.SYSTEM,
				'Edit an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.deleteAnnotation',
			errorWrapper(
				async (annotationId: string): Promise<boolean> => {
					await storageService.deleteAnnotation(annotationId);
					return true;
				},
				'DELETE_ANNOTATION',
				ErrorCategory.SYSTEM,
				'Delete an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.replyToAnnotation',
			errorWrapper(
				async (
					annotationId: string,
					content: string,
					author?: string,
				): Promise<boolean> => {
					// Get the annotation from storage
					const annotations = await storageService.getAnnotations();
					const annotation = annotations.find((a) => a.id === annotationId);

					if (!annotation) {
						console.warn(`Annotation not found: ${annotationId}`);
						return false;
					}

					// Create the reply
					const reply = {
						id: `reply-${Date.now()}`,
						content,
						author: {
							id: 'user-1',
							name: author || 'User',
							type: 'human' as const
						},
						timestamp: new Date().toISOString(),
						filePath: annotation.filePath,
						lineNumber: ('lineNumber' in annotation) ? annotation.lineNumber : (annotation as any).lineStart,
						resolved: false,
						replies: []
					};

					// Add the reply to the annotation
					annotation.replies.push(reply);

					// Save the updated annotation
					await storageService.updateAnnotation(annotation);

					return true;
				},
				'REPLY_TO_ANNOTATION',
				ErrorCategory.SYSTEM,
				'Reply to an annotation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.selectAlternative',
			errorWrapper(
				async (implementationId: string): Promise<boolean> => {
					// Get the implementation from storage
					const implementations = await storageService.getImplementations();
					const implementation = implementations.find((i) => i.id === implementationId);

					if (!implementation) {
						console.warn(`Implementation not found: ${implementationId}`);
						return false;
					}

					// Apply the implementation
					await vscode.commands.executeCommand('tribe.applyChanges', {
						filesToModify: implementation.files.modify || [],
						filesToCreate: implementation.files.create || [],
						filesToDelete: implementation.files.delete || [],
					});

					return true;
				},
				'SELECT_ALTERNATIVE',
				ErrorCategory.SYSTEM,
				'Select an alternative implementation',
			),
		),

		vscode.commands.registerCommand(
			'tribe.generateHunks',
			errorWrapper(
				async (changeId: string): Promise<boolean> => {
					// Get the change from storage
					const changes = await storageService.getPendingChanges();
					const change = changes.find((c) => c.id === changeId);

					if (!change) {
						console.warn(`Change not found: ${changeId}`);
						return false;
					}

					// Regenerate hunks
					const updatedChange = DiffUtils.regenerateHunks(change);

					// Save the updated change
					await storageService.updatePendingChange(updatedChange);

					return true;
				},
				'GENERATE_HUNKS',
				ErrorCategory.SYSTEM,
				'Generate hunks for a file change',
			),
		),

		vscode.commands.registerCommand(
			'tribe.createChangeGroup',
			errorWrapper(
				async (changes: string[], name?: string): Promise<string> => {
					// Get the changes from storage
					const allChanges = await storageService.getPendingChanges();
					const selectedChanges = allChanges.filter((c) => changes.includes(c.id));

					if (selectedChanges.length === 0) {
						console.warn('No changes selected for group creation');
						return '';
					}

					// Generate a name if not provided
					if (!name) {
						name = `Change Group ${new Date().toLocaleString()}`;
					}

					// Create the change group
					const changeGroup: ChangeGroup = {
						id: `group-${Date.now()}`,
						title: name,
						description: `Changes created on ${new Date().toLocaleString()}`,
						agentId: 'system-1',
						agentName: 'System',
						timestamp: new Date().toISOString(),
						files: {
							modify: [] as FileChange[],
							create: [] as FileChange[],
							delete: [],
						},
					};

					// Organize changes by file operation
					for (const change of selectedChanges) {
						if (change.type === 'modify') {
							changeGroup.files.modify.push({
								path: change.path,
								content: change.content,
								type: 'modify',
							});
						} else if (change.type === 'create') {
							changeGroup.files.create.push({
								path: change.path,
								content: change.content,
								type: 'create',
							});
						} else if (change.type === 'delete') {
							changeGroup.files.delete.push(change.path);
						}
					}

					// Save the change group
					await storageService.saveChangeGroup(changeGroup);

					return changeGroup.id;
				},
				'CREATE_CHANGE_GROUP',
				ErrorCategory.SYSTEM,
				'Create a change group from a set of changes',
			),
		),

		vscode.commands.registerCommand(
			'tribe.getWorkspaceSnapshot',
			errorWrapper(
				async (): Promise<any> => {
					return await DiffUtils.createWorkspaceSnapshot();
				},
				'GET_WORKSPACE_SNAPSHOT',
				ErrorCategory.SYSTEM,
				'Get a snapshot of the current workspace',
			),
		),
	];

	// Register collaborative commands
	const collaborativeCommands = [
		vscode.commands.registerCommand(
			'tribe.shareWorkspace',
			errorWrapper(
				async (): Promise<string> => {
					try {
						// Create a workspace snapshot
						const snapshot = await DiffUtils.createWorkspaceSnapshot();

						// Generate a unique session ID
						const sessionId = `session-${Date.now()}`;

						// TODO: Implement sharing logic with collaboration service

						return sessionId;
					} catch (error) {
						console.error('Error sharing workspace:', error);
						throw new Error('Failed to share workspace: ' + (error as Error).message);
					}
				},
				'SHARE_WORKSPACE',
				ErrorCategory.SYSTEM,
			),
		),

		vscode.commands.registerCommand(
			'tribe.joinWorkspace',
			errorWrapper(
				async (sessionId: string): Promise<boolean> => {
					try {
						console.log(`Joining workspace session: ${sessionId}`);

						// TODO: Implement join logic with collaboration service

						// Fetch the workspace snapshot
						// const snapshot = await collaborationService.getSnapshot(sessionId);

						// Restore the workspace to the snapshot
						// await DiffUtils.restoreWorkspaceSnapshot(snapshot);

						return true;
					} catch (error) {
						console.error('Error joining workspace:', error);
						throw new Error('Failed to join workspace: ' + (error as Error).message);
					}
				},
				'JOIN_WORKSPACE',
				ErrorCategory.SYSTEM,
			),
		),

		vscode.commands.registerCommand(
			'tribe.syncWorkspace',
			errorWrapper(
				async (sessionId: string): Promise<boolean> => {
					try {
						console.log(`Syncing workspace session: ${sessionId}`);

						// TODO: Implement sync logic with collaboration service

						// Create a new snapshot of the local workspace
						const localSnapshot = await DiffUtils.createWorkspaceSnapshot();

						// Send the snapshot to the collaboration service
						// await collaborationService.updateSnapshot(sessionId, localSnapshot);

						// Get the latest snapshot from the collaboration service
						// const remoteSnapshot = await collaborationService.getSnapshot(sessionId);

						// Compare snapshots and generate diffs
						// const diffs = DiffUtils.compareSnapshots(localSnapshot, remoteSnapshot);

						// Apply changes as needed

						return true;
					} catch (error) {
						console.error('Error syncing workspace:', error);
						throw new Error('Failed to sync workspace: ' + (error as Error).message);
					}
				},
				'SYNC_WORKSPACE',
				ErrorCategory.SYSTEM,
			),
		),

		vscode.commands.registerCommand(
			'tribe.endSession',
			errorWrapper(
				async (sessionId: string): Promise<boolean> => {
					try {
						console.log(`Ending workspace session: ${sessionId}`);

						// TODO: Implement end session logic with collaboration service

						return true;
					} catch (error) {
						console.error('Error ending workspace session:', error);
						throw new Error('Failed to end workspace session: ' + (error as Error).message);
					}
				},
				'END_SESSION',
				ErrorCategory.SYSTEM,
			),
		),

		vscode.commands.registerCommand(
			'tribe.sendMessage',
			errorWrapper(
				async (sessionId: string, message: string): Promise<boolean> => {
					try {
						console.log(`Sending message to session: ${sessionId}`);

						// TODO: Implement message sending logic with collaboration service

						return true;
					} catch (error) {
						console.error('Error sending message:', error);
						throw new Error('Failed to send message: ' + (error as Error).message);
					}
				},
				'SEND_MESSAGE',
				ErrorCategory.SYSTEM,
			),
		),

		vscode.commands.registerCommand(
			'tribe.getMessages',
			errorWrapper(
				async (sessionId: string): Promise<any[]> => {
					try {
						console.log(`Getting messages for session: ${sessionId}`);

						// TODO: Implement get messages logic with collaboration service

						return [];
					} catch (error) {
						console.error('Error getting messages:', error);
						throw new Error('Failed to get messages: ' + (error as Error).message);
					}
				},
				'GET_MESSAGES',
				ErrorCategory.SYSTEM,
			),
		),

		vscode.commands.registerCommand(
			'tribe.shareFile',
			errorWrapper(
				async (sessionId: string, filePath: string): Promise<boolean> => {
					try {
						console.log(`Sharing file ${filePath} with session: ${sessionId}`);

						// TODO: Implement file sharing logic with collaboration service

						return true;
					} catch (error) {
						console.error('Error sharing file:', error);
						throw new Error('Failed to share file: ' + (error as Error).message);
					}
				},
				'SHARE_FILE',
				ErrorCategory.SYSTEM,
			),
		),
	];

	// Register all commands
	commands.forEach((command) => context.subscriptions.push(command));
	collaborativeCommands.forEach((command) => context.subscriptions.push(command));
}