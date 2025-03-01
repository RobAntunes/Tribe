/* eslint-disable header/header */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
	ChangeGroup,
	Checkpoint,
	Annotation,
	Implementation,
	Conflict,
	SubCheckpoint,
	FileChange,
	AnnotationReply,
} from '../models/types';
import { STORAGE_PATHS, getStorageDirectory } from '../config';

/**
 * Service for managing persistent storage of extension data
 */
export class StorageService {
	private static instance: StorageService | null = null;
	private context: vscode.ExtensionContext;
	private storageDir: string;

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.storageDir = getStorageDirectory();
		this.initializeStorage();
	}

	/**
	 * Get the singleton instance of the StorageService
	 * @param context Extension context
	 * @returns StorageService instance
	 */
	public static getInstance(context?: vscode.ExtensionContext): StorageService {
		if (!StorageService.instance) {
			if (!context) {
				throw new Error('StorageService must be initialized with an extension context');
			}
			StorageService.instance = new StorageService(context);
		}
		return StorageService.instance;
	}

	/**
	 * Initialize the storage directories
	 */
	private initializeStorage(): void {
		try {
			// Create the base storage directory if it doesn't exist
			if (!fs.existsSync(this.storageDir)) {
				fs.mkdirSync(this.storageDir, { recursive: true });
			}

			// Create subdirectories for different types of data
			const subdirs = [
				STORAGE_PATHS.CHANGE_GROUPS,
				STORAGE_PATHS.CHECKPOINTS,
				STORAGE_PATHS.ANNOTATIONS,
				STORAGE_PATHS.IMPLEMENTATIONS,
				STORAGE_PATHS.CONFLICTS,
				STORAGE_PATHS.HISTORY,
			];

			for (const subdir of subdirs) {
				const fullPath = path.join(this.storageDir, subdir);
				if (!fs.existsSync(fullPath)) {
					fs.mkdirSync(fullPath, { recursive: true });
				}
			}
		} catch (error) {
			console.error('Error initializing storage:', error);
			throw error;
		}
	}

	/**
	 * Get all change groups
	 * @returns Array of change groups
	 */
	public async getChangeGroups(): Promise<ChangeGroup[]> {
		try {
			const changeGroupsDir = path.join(this.storageDir, STORAGE_PATHS.CHANGE_GROUPS);
			const files = fs.readdirSync(changeGroupsDir);
			const changeGroups: ChangeGroup[] = [];

			for (const file of files) {
				if (file.endsWith('.json')) {
					const filePath = path.join(changeGroupsDir, file);
					const content = fs.readFileSync(filePath, 'utf8');
					const changeGroup = JSON.parse(content) as ChangeGroup;
					changeGroups.push(changeGroup);
				}
			}

			return changeGroups;
		} catch (error) {
			console.error('Error getting change groups:', error);
			return [];
		}
	}

	/**
	 * Save a change group
	 * @param changeGroup Change group to save
	 */
	public async saveChangeGroup(changeGroup: ChangeGroup): Promise<void> {
		try {
			const changeGroupsDir = path.join(this.storageDir, STORAGE_PATHS.CHANGE_GROUPS);
			const filePath = path.join(changeGroupsDir, `${changeGroup.id}.json`);
			fs.writeFileSync(filePath, JSON.stringify(changeGroup, null, 2), 'utf8');
		} catch (error) {
			console.error(`Error saving change group ${changeGroup.id}:`, error);
			throw error;
		}
	}

	/**
	 * Delete a change group
	 * @param groupId ID of the change group to delete
	 */
	public async deleteChangeGroup(groupId: string): Promise<void> {
		try {
			const changeGroupsDir = path.join(this.storageDir, STORAGE_PATHS.CHANGE_GROUPS);
			const filePath = path.join(changeGroupsDir, `${groupId}.json`);

			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (error) {
			console.error(`Error deleting change group ${groupId}:`, error);
			throw error;
		}
	}

	/**
	 * Get a change group by ID
	 * @param groupId ID of the change group
	 * @returns Change group or null if not found
	 */
	public async getChangeGroup(groupId: string): Promise<ChangeGroup | null> {
		try {
			const changeGroupsDir = path.join(this.storageDir, STORAGE_PATHS.CHANGE_GROUPS);
			const filePath = path.join(changeGroupsDir, `${groupId}.json`);

			if (!fs.existsSync(filePath)) {
				return null;
			}

			const content = fs.readFileSync(filePath, 'utf8');
			return JSON.parse(content) as ChangeGroup;
		} catch (error) {
			console.error(`Error getting change group ${groupId}:`, error);
			return null;
		}
	}

	/**
	 * Get all checkpoints
	 * @returns Array of checkpoints
	 */
	public async getCheckpoints(): Promise<Checkpoint[]> {
		try {
			const checkpointsDir = path.join(this.storageDir, STORAGE_PATHS.CHECKPOINTS);
			const files = fs.readdirSync(checkpointsDir);
			const checkpoints: Checkpoint[] = [];

			for (const file of files) {
				if (file.endsWith('.json') && !file.includes('snapshot')) {
					const filePath = path.join(checkpointsDir, file);
					const content = fs.readFileSync(filePath, 'utf8');
					const checkpoint = JSON.parse(content) as Checkpoint;
					checkpoints.push(checkpoint);
				}
			}

			return checkpoints;
		} catch (error) {
			console.error('Error getting checkpoints:', error);
			return [];
		}
	}

	/**
	 * Save a checkpoint
	 * @param checkpoint Checkpoint to save
	 * @param snapshot Snapshot data
	 */
	public async saveCheckpoint(checkpoint: Checkpoint, snapshot: Record<string, string>): Promise<void> {
		try {
			const checkpointsDir = path.join(this.storageDir, STORAGE_PATHS.CHECKPOINTS);

			// Save the checkpoint metadata
			const metadataPath = path.join(checkpointsDir, `${checkpoint.id}.json`);

			// Save the snapshot data
			const snapshotPath = path.join(checkpointsDir, `${checkpoint.id}-snapshot.json`);
			fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');

			// Update the checkpoint with the snapshot path
			checkpoint.snapshotPath = snapshotPath;

			// Save the updated checkpoint metadata
			fs.writeFileSync(metadataPath, JSON.stringify(checkpoint, null, 2), 'utf8');
		} catch (error) {
			console.error(`Error saving checkpoint ${checkpoint.id}:`, error);
			throw error;
		}
	}

	/**
	 * Delete a checkpoint
	 * @param checkpointId ID of the checkpoint to delete
	 */
	public async deleteCheckpoint(checkpointId: string): Promise<void> {
		try {
			const checkpointsDir = path.join(this.storageDir, STORAGE_PATHS.CHECKPOINTS);
			const metadataPath = path.join(checkpointsDir, `${checkpointId}.json`);
			const snapshotPath = path.join(checkpointsDir, `${checkpointId}-snapshot.json`);

			// Delete the checkpoint metadata
			if (fs.existsSync(metadataPath)) {
				fs.unlinkSync(metadataPath);
			}

			// Delete the snapshot data
			if (fs.existsSync(snapshotPath)) {
				fs.unlinkSync(snapshotPath);
			}
		} catch (error) {
			console.error(`Error deleting checkpoint ${checkpointId}:`, error);
			throw error;
		}
	}

	/**
	 * Get a checkpoint snapshot
	 * @param checkpointId ID of the checkpoint
	 * @returns Snapshot data
	 */
	public async getCheckpointSnapshot(checkpointId: string): Promise<Record<string, string>> {
		try {
			const checkpointsDir = path.join(this.storageDir, STORAGE_PATHS.CHECKPOINTS);
			const snapshotPath = path.join(checkpointsDir, `${checkpointId}-snapshot.json`);

			if (!fs.existsSync(snapshotPath)) {
				throw new Error(`Snapshot not found for checkpoint ${checkpointId}`);
			}

			const content = fs.readFileSync(snapshotPath, 'utf8');
			return JSON.parse(content) as Record<string, string>;
		} catch (error) {
			console.error(`Error getting checkpoint snapshot ${checkpointId}:`, error);
			throw error;
		}
	}

	/**
	 * Create a workspace snapshot
	 * @returns Snapshot data
	 */
	public async createWorkspaceSnapshot(): Promise<Record<string, string>> {
		try {
			const snapshot: Record<string, string> = {};
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				throw new Error('No workspace folder is open');
			}

			const workspaceRoot = workspaceFolders[0].uri.fsPath;

			// Recursively scan the workspace
			this.scanDirectory(workspaceRoot, '', snapshot);

			return snapshot;
		} catch (error) {
			console.error('Error creating workspace snapshot:', error);
			throw error;
		}
	}

	/**
	 * Restore workspace from a snapshot
	 * @param snapshot Snapshot data
	 */
	public async restoreWorkspaceFromSnapshot(snapshot: Record<string, string>): Promise<void> {
		try {
			const workspaceFolders = vscode.workspace.workspaceFolders;

			if (!workspaceFolders || workspaceFolders.length === 0) {
				throw new Error('No workspace folder is open');
			}

			const workspaceRoot = workspaceFolders[0].uri.fsPath;

			// Restore each file in the snapshot
			for (const [relativePath, content] of Object.entries(snapshot)) {
				const absolutePath = path.join(workspaceRoot, relativePath);
				const directory = path.dirname(absolutePath);

				// Create the directory if it doesn't exist
				if (!fs.existsSync(directory)) {
					fs.mkdirSync(directory, { recursive: true });
				}

				// Write the file content
				fs.writeFileSync(absolutePath, content, 'utf8');
			}
		} catch (error) {
			console.error('Error restoring workspace from snapshot:', error);
			throw error;
		}
	}

	/**
	 * Create a sub-checkpoint
	 * @param parentCheckpointId ID of the parent checkpoint
	 * @param description Description of the sub-checkpoint
	 * @param changes Changes to include in the sub-checkpoint
	 * @returns Created sub-checkpoint
	 */
	public async createSubCheckpoint(
		parentCheckpointId: string,
		description: string,
		changes: FileChange[] | { modified: string[]; created: string[]; deleted: string[] },
	): Promise<SubCheckpoint> {
		try {
			// Get the parent checkpoint
			const metadataPath = path.join(
				getStorageDirectory(),
				STORAGE_PATHS.CHECKPOINTS,
				`${parentCheckpointId}.json`,
			);

			if (!fs.existsSync(metadataPath)) {
				throw new Error(`Parent checkpoint ${parentCheckpointId} not found`);
			}

			const content = fs.readFileSync(metadataPath, 'utf8');
			const parentCheckpoint = JSON.parse(content) as Checkpoint;

			// Convert changes to FileChange[] if needed
			let fileChanges: FileChange[] = [];
			if (Array.isArray(changes)) {
				fileChanges = changes;
			} else {
				// Convert the changes object to FileChange[]
				const { modified, created, deleted } = changes;

				// Add modified files
				if (modified && Array.isArray(modified)) {
					for (const path of modified) {
						fileChanges.push({
							path,
							content: '',
							type: 'modify',
						});
					}
				}

				// Add created files
				if (created && Array.isArray(created)) {
					for (const path of created) {
						fileChanges.push({
							path,
							content: '',
							type: 'create',
						});
					}
				}

				// Add deleted files
				if (deleted && Array.isArray(deleted)) {
					for (const path of deleted) {
						fileChanges.push({
							path,
							content: '',
							type: 'delete',
						});
					}
				}
			}

			// Create the sub-checkpoint
			const subCheckpoint: SubCheckpoint = {
				id: `sub-${Date.now()}`,
				timestamp: new Date().toISOString(),
				description,
				parentCheckpointId,
				changes: fileChanges,
			};

			// Add the sub-checkpoint to the parent
			if (!parentCheckpoint.subCheckpoints) {
				parentCheckpoint.subCheckpoints = [];
			}

			parentCheckpoint.subCheckpoints.push(subCheckpoint);

			// Save the updated parent checkpoint
			await fs.promises.writeFile(metadataPath, JSON.stringify(parentCheckpoint, null, 2));

			return subCheckpoint;
		} catch (error) {
			console.error(`Error creating sub-checkpoint for ${parentCheckpointId}:`, error);
			throw error;
		}
	}

	/**
	 * Get all annotations
	 * @returns Array of annotations
	 */
	public async getAnnotations(): Promise<Annotation[]> {
		try {
			const annotationsDir = path.join(this.storageDir, STORAGE_PATHS.ANNOTATIONS);
			const files = fs.readdirSync(annotationsDir);
			const annotations: Annotation[] = [];

			for (const file of files) {
				if (file.endsWith('.json')) {
					const filePath = path.join(annotationsDir, file);
					const content = fs.readFileSync(filePath, 'utf8');
					const annotation = JSON.parse(content) as Annotation;
					annotations.push(annotation);
				}
			}

			return annotations;
		} catch (error) {
			console.error('Error getting annotations:', error);
			return [];
		}
	}

	/**
	 * Save an annotation
	 * @param annotation Annotation to save
	 */
	public async saveAnnotation(annotation: Annotation): Promise<void> {
		try {
			const annotationsDir = path.join(this.storageDir, STORAGE_PATHS.ANNOTATIONS);
			const filePath = path.join(annotationsDir, `${annotation.id}.json`);
			fs.writeFileSync(filePath, JSON.stringify(annotation, null, 2), 'utf8');
		} catch (error) {
			console.error(`Error saving annotation ${annotation.id}:`, error);
			throw error;
		}
	}

	/**
	 * Delete an annotation
	 * @param annotationId ID of the annotation to delete
	 */
	public async deleteAnnotation(annotationId: string): Promise<void> {
		try {
			const annotationsDir = path.join(this.storageDir, STORAGE_PATHS.ANNOTATIONS);
			const filePath = path.join(annotationsDir, `${annotationId}.json`);

			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (error) {
			console.error(`Error deleting annotation ${annotationId}:`, error);
			throw error;
		}
	}

	/**
	 * Save all annotations to storage
	 * @param annotations Annotations to save
	 */
	public async saveAnnotations(annotations: Annotation[]): Promise<void> {
		try {
			const annotationsPath = path.join(getStorageDirectory(), STORAGE_PATHS.ANNOTATIONS);
			await fs.promises.writeFile(annotationsPath, JSON.stringify(annotations, null, 2));
		} catch (error) {
			console.error('Error saving annotations:', error);
			throw error;
		}
	}

	/**
	 * Add a reply to an annotation
	 * @param parentId ID of the parent annotation
	 * @param reply Reply to add
	 */
	public async addReplyToAnnotation(parentId: string, reply: AnnotationReply): Promise<void> {
		try {
			// Helper function to find and update an annotation
			const findAndUpdate = (annotations: Annotation[]): boolean => {
				for (const annotation of annotations) {
					if (annotation.id === parentId) {
						if (!annotation.replies) {
							annotation.replies = [];
						}
						annotation.replies.push(reply);
						return true;
					}
					// Check if this annotation has replies that might contain our target
					if (annotation.replies && annotation.replies.length > 0) {
						// We need to check if any of the replies is our target parent
						// Since replies can also be annotations (with nested replies)
						const nestedAnnotations = annotation.replies.filter((r): r is Annotation => 'replies' in r);

						if (nestedAnnotations.length > 0 && findAndUpdate(nestedAnnotations)) {
							return true;
						}
					}
				}
				return false;
			};

			// Get all annotations
			const annotations = await this.getAnnotations();

			// Find and update the parent annotation
			if (findAndUpdate(annotations)) {
				// Save the updated annotations
				await this.saveAnnotations(annotations);
			}
		} catch (error) {
			console.error('Error adding reply to annotation:', error);
			throw error;
		}
	}

	/**
	 * Get all implementations
	 * @returns Array of implementations
	 */
	public async getImplementations(): Promise<Implementation[]> {
		try {
			const implementationsDir = path.join(this.storageDir, STORAGE_PATHS.IMPLEMENTATIONS);
			const files = fs.readdirSync(implementationsDir);
			const implementations: Implementation[] = [];

			for (const file of files) {
				if (file.endsWith('.json')) {
					const filePath = path.join(implementationsDir, file);
					const content = fs.readFileSync(filePath, 'utf8');
					const implementation = JSON.parse(content) as Implementation;
					implementations.push(implementation);
				}
			}

			return implementations;
		} catch (error) {
			console.error('Error getting implementations:', error);
			return [];
		}
	}

	/**
	 * Save an implementation
	 * @param implementation Implementation to save
	 */
	public async saveImplementation(implementation: Implementation): Promise<void> {
		try {
			const implementationsDir = path.join(this.storageDir, STORAGE_PATHS.IMPLEMENTATIONS);
			const filePath = path.join(implementationsDir, `${implementation.id}.json`);
			fs.writeFileSync(filePath, JSON.stringify(implementation, null, 2), 'utf8');
		} catch (error) {
			console.error(`Error saving implementation ${implementation.id}:`, error);
			throw error;
		}
	}

	/**
	 * Delete an implementation
	 * @param implementationId ID of the implementation to delete
	 */
	public async deleteImplementation(implementationId: string): Promise<void> {
		try {
			const implementationsDir = path.join(this.storageDir, STORAGE_PATHS.IMPLEMENTATIONS);
			const filePath = path.join(implementationsDir, `${implementationId}.json`);

			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (error) {
			console.error(`Error deleting implementation ${implementationId}:`, error);
			throw error;
		}
	}

	/**
	 * Get all conflicts
	 * @returns Array of conflicts
	 */
	public async getConflicts(): Promise<Conflict[]> {
		try {
			const conflictsDir = path.join(this.storageDir, STORAGE_PATHS.CONFLICTS);
			const files = fs.readdirSync(conflictsDir);
			const conflicts: Conflict[] = [];

			for (const file of files) {
				if (file.endsWith('.json')) {
					const filePath = path.join(conflictsDir, file);
					const content = fs.readFileSync(filePath, 'utf8');
					const conflict = JSON.parse(content) as Conflict;
					conflicts.push(conflict);
				}
			}

			return conflicts;
		} catch (error) {
			console.error('Error getting conflicts:', error);
			return [];
		}
	}

	/**
	 * Save a conflict
	 * @param conflict Conflict to save
	 */
	public async saveConflict(conflict: Conflict): Promise<void> {
		try {
			const conflictsDir = path.join(this.storageDir, STORAGE_PATHS.CONFLICTS);
			const filePath = path.join(conflictsDir, `${conflict.id}.json`);
			fs.writeFileSync(filePath, JSON.stringify(conflict, null, 2), 'utf8');
		} catch (error) {
			console.error(`Error saving conflict ${conflict.id}:`, error);
			throw error;
		}
	}

	/**
	 * Delete a conflict
	 * @param conflictId ID of the conflict to delete
	 */
	public async deleteConflict(conflictId: string): Promise<void> {
		try {
			const conflictsDir = path.join(this.storageDir, STORAGE_PATHS.CONFLICTS);
			const filePath = path.join(conflictsDir, `${conflictId}.json`);

			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch (error) {
			console.error(`Error deleting conflict ${conflictId}:`, error);
			throw error;
		}
	}

	/**
	 * Resolve a conflict automatically
	 * @param conflictId ID of the conflict to resolve
	 * @param preference Preference for resolution ('agent' or 'user')
	 * @returns Resolved conflict with changes
	 */
	public async resolveConflictAutomatically(
		conflictId: string,
		preference: 'agent' | 'user' = 'agent',
	): Promise<FileChange[]> {
		try {
			// Get the conflict
			const conflicts = await this.getConflicts();
			const conflict = conflicts.find((c) => c.id === conflictId);

			if (!conflict) {
				throw new Error(`Conflict ${conflictId} not found`);
			}

			// Determine which changes to use based on preference
			const resolvedChanges: FileChange[] =
				preference === 'agent' ? [...conflict.agentChanges] : [...conflict.userChanges];

			// Update the conflict with resolved information
			conflict.resolvedChanges = resolvedChanges;
			conflict.resolutionStrategy = 'auto';
			conflict.resolutionTimestamp = new Date().toISOString();
			conflict.status = 'resolved' as const;
			conflict.resolvedContent =
				preference === 'agent'
					? conflict.agentChanges[0]?.content || null
					: conflict.userChanges[0]?.content || null;

			// Save the updated conflict
			await this.saveConflict(conflict);

			return resolvedChanges;
		} catch (error) {
			console.error(`Error resolving conflict ${conflictId}:`, error);
			throw error;
		}
	}

	/**
	 * Calculate diff between two snapshots
	 * @param snapshot1 First snapshot
	 * @param snapshot2 Second snapshot
	 * @returns Diff result
	 */
	public calculateDiff(
		snapshot1: Record<string, string>,
		snapshot2: Record<string, string>,
	): {
		modified: string[];
		created: string[];
		deleted: string[];
	} {
		const modified: string[] = [];
		const created: string[] = [];
		const deleted: string[] = [];

		// Find modified and deleted files
		for (const [path, content] of Object.entries(snapshot1)) {
			if (path in snapshot2) {
				if (content !== snapshot2[path]) {
					modified.push(path);
				}
			} else {
				deleted.push(path);
			}
		}

		// Find created files
		for (const path of Object.keys(snapshot2)) {
			if (!(path in snapshot1)) {
				created.push(path);
			}
		}

		return { modified, created, deleted };
	}

	/**
	 * Group file changes by feature
	 * @param fileChanges Array of file changes
	 * @returns Grouped file changes
	 */
	public groupFileChangesByFeature(fileChanges: FileChange[]): Record<string, FileChange[]> {
		const groupedChanges: Record<string, FileChange[]> = {};

		for (const fileChange of fileChanges) {
			// Extract feature names from the file path
			const featureNames = this.extractFeatureNames(fileChange.path);

			// If no features were extracted, use a default feature
			if (featureNames.length === 0) {
				featureNames.push('General');
			}

			// Add the file change to each feature
			for (const feature of featureNames) {
				if (!groupedChanges[feature]) {
					groupedChanges[feature] = [];
				}
				groupedChanges[feature].push(fileChange);
			}
		}

		return groupedChanges;
	}

	/**
	 * Extract feature names from a file path
	 * @param filePath File path
	 * @returns Array of feature names
	 */
	private extractFeatureNames(filePath: string): string[] {
		const featureNames: string[] = [];

		// Extract feature names from directory structure
		const parts = filePath.split('/');

		// Common feature directories
		const featureDirs = ['features', 'modules', 'components', 'services', 'utils', 'helpers'];

		for (let i = 0; i < parts.length - 1; i++) {
			if (featureDirs.includes(parts[i]) && i + 1 < parts.length) {
				featureNames.push(parts[i + 1]);
			}
		}

		return featureNames;
	}

	/**
	 * Scan a directory recursively and add files to the snapshot
	 * @param absolutePath Absolute path to the directory
	 * @param relativePath Relative path to the directory
	 * @param snapshot Snapshot data
	 */
	private scanDirectory(absolutePath: string, relativePath: string, snapshot: Record<string, string>): void {
		const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

		for (const entry of entries) {
			const entryRelativePath = path.join(relativePath, entry.name);
			const entryAbsolutePath = path.join(absolutePath, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules, .git, and other common directories to ignore
				if (
					entry.name === 'node_modules' ||
					entry.name === '.git' ||
					entry.name === 'dist' ||
					entry.name === 'out'
				) {
					continue;
				}

				// Recursively scan subdirectories
				this.scanDirectory(entryAbsolutePath, entryRelativePath, snapshot);
			} else if (entry.isFile()) {
				// Skip binary files and other files to ignore
				if (
					entry.name.endsWith('.exe') ||
					entry.name.endsWith('.dll') ||
					entry.name.endsWith('.so') ||
					entry.name.endsWith('.dylib')
				) {
					continue;
				}

				// Add the file to the snapshot
				try {
					const content = fs.readFileSync(entryAbsolutePath, 'utf8');
					snapshot[entryRelativePath] = content;
				} catch (error) {
					console.warn(`Skipping binary file: ${entryRelativePath}`);
				}
			}
		}
	}

	/**
	 * Save a history entry
	 * @param historyEntry History entry to save
	 */
	public async saveHistoryEntry(historyEntry: any): Promise<void> {
		try {
			// Get existing history entries
			const historyEntries = await this.getHistoryEntries();

			// Add the new entry
			historyEntries.push(historyEntry);

			// Save the updated history
			const historyPath = path.join(getStorageDirectory(), STORAGE_PATHS.HISTORY);
			await fs.promises.writeFile(historyPath, JSON.stringify(historyEntries, null, 2));
		} catch (error) {
			console.error('Error saving history entry:', error);
			throw error;
		}
	}

	/**
	 * Get all history entries
	 * @returns Array of history entries
	 */
	public async getHistoryEntries(): Promise<any[]> {
		try {
			const historyPath = path.join(getStorageDirectory(), STORAGE_PATHS.HISTORY);

			// Check if the history file exists
			if (!fs.existsSync(historyPath)) {
				return [];
			}

			// Read and parse the history file
			const historyData = await fs.promises.readFile(historyPath, 'utf8');
			return JSON.parse(historyData);
		} catch (error) {
			console.error('Error getting history entries:', error);
			return [];
		}
	}

	/**
	 * Clear all history entries
	 */
	public async clearHistory(): Promise<void> {
		try {
			const historyPath = path.join(getStorageDirectory(), STORAGE_PATHS.HISTORY);

			// Create an empty history file
			await fs.promises.writeFile(historyPath, JSON.stringify([], null, 2));
		} catch (error) {
			console.error('Error clearing history:', error);
			throw error;
		}
	}
}
