/* eslint-disable header/header */

import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { DiffService } from '../services/diffService';
import { CreateCheckpointPayload, CreateSubCheckpointPayload, RevertToSubCheckpointPayload } from '../models/types';
import { errorWrapper, ErrorCategory } from '../errorHandling';
import { COMMANDS, API_ENDPOINTS } from '../config';

/**
 * Register checkpoint management commands
 * @param context Extension context
 */
export function registerCheckpointCommands(context: vscode.ExtensionContext): void {
	// Initialize services
	const storageService = StorageService.getInstance(context);
	const diffService = DiffService.getInstance();

	// Register commands
	const commands = [
		vscode.commands.registerCommand(
			COMMANDS.CREATE_CHECKPOINT,
			errorWrapper(
				async (payload: CreateCheckpointPayload): Promise<any> => {
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
				'CREATE_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Create a checkpoint of the current workspace state',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GET_CHECKPOINTS,
			errorWrapper(
				async (): Promise<any[]> => {
					// Get all checkpoints from storage
					return storageService.getCheckpoints();
				},
				'GET_CHECKPOINTS',
				ErrorCategory.SYSTEM,
				'Get all checkpoints',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.RESTORE_CHECKPOINT,
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
				ErrorCategory.SYSTEM,
				'Restore workspace to a checkpoint',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.DELETE_CHECKPOINT,
			errorWrapper(
				async (checkpointId: string): Promise<boolean> => {
					console.log(`Deleting checkpoint: ${checkpointId}`);

					// Delete the checkpoint from storage
					await storageService.deleteCheckpoint(checkpointId);
					return true;
				},
				'DELETE_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Delete a checkpoint',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.VIEW_CHECKPOINT_DIFF,
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

							// Use DiffService to show the diff
							await diffService.showDiff(
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
				ErrorCategory.SYSTEM,
				'View diff between checkpoint and current state',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.CREATE_SUB_CHECKPOINT,
			errorWrapper(
				async (payload: CreateSubCheckpointPayload): Promise<any> => {
					console.log('Creating sub-checkpoint for:', payload.parentCheckpointId);

					try {
						const subCheckpoint = await storageService.createSubCheckpoint(
							payload.parentCheckpointId,
							payload.description,
							Array.isArray(payload.changes) ? payload.changes : [],
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
				'CREATE_SUB_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Create a sub-checkpoint',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.REVERT_TO_SUB_CHECKPOINT,
			errorWrapper(
				async (payload: RevertToSubCheckpointPayload): Promise<any> => {
					console.log('Reverting to sub-checkpoint:', payload.subCheckpointId);

					try {
						// Get the parent checkpoint
						const checkpoints = await storageService.getCheckpoints();
						const parentCheckpoint = checkpoints.find((c) => c.id === payload.checkpointId);

						if (!parentCheckpoint) {
							throw new Error(`Parent checkpoint ${payload.checkpointId} not found`);
						}

						// Find the sub-checkpoint
						const subCheckpoint = parentCheckpoint.subCheckpoints?.find(
							(sc) => sc.id === payload.subCheckpointId,
						);

						if (!subCheckpoint) {
							throw new Error(`Sub-checkpoint ${payload.subCheckpointId} not found`);
						}

						// Get the parent checkpoint snapshot
						const snapshot = await storageService.getCheckpointSnapshot(payload.checkpointId);

						// Restore the workspace from the snapshot
						await storageService.restoreWorkspaceFromSnapshot(snapshot);

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
				'REVERT_TO_SUB_CHECKPOINT',
				ErrorCategory.SYSTEM,
				'Revert to a sub-checkpoint',
			),
		),
	];

	// Add commands to context subscriptions
	context.subscriptions.push(...commands);
}
