/* eslint-disable header/header */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DiffUtils } from './diffUtils';

// Define interfaces for our data types
export interface FileChange {
	path: string;
	content: string;
	originalContent?: string;
	explanation?: string;
	timestamp?: string;
	hunks?: Array<{
		startLine: number;
		endLine: number;
		content: string;
		originalContent?: string;
		semanticGroup?: string;
	}>;
}

export interface ChangeGroup {
	id: string;
	title: string;
	description: string;
	agentId: string;
	agentName: string;
	timestamp: string;
	files: {
		modify: FileChange[];
		create: FileChange[];
		delete: string[];
	};
}

export interface Checkpoint {
	id: string;
	timestamp: string;
	description: string;
	changes: {
		modified: number;
		created: number;
		deleted: number;
	};
	// Reference to file containing the actual snapshot data
	snapshotPath: string;
	// List of change groups included in this checkpoint
	changeGroups?: string[];
	// Sub-checkpoints for more granular history
	subCheckpoints?: SubCheckpoint[];
}

// New interface for sub-checkpoints
export interface SubCheckpoint {
	id: string;
	timestamp: string;
	description: string;
	parentCheckpointId: string;
	changes: {
		modified: string[];
		created: string[];
		deleted: string[];
	};
}

export interface Annotation {
	id: string;
	content: string;
	author: {
		id: string;
		name: string;
		type: 'human' | 'agent';
	};
	timestamp: string;
	filePath?: string;
	lineStart?: number;
	lineEnd?: number;
	codeSnippet?: string;
	replies: Annotation[];
}

export interface Implementation {
	id: string;
	title: string;
	description: string;
	tradeoffs: {
		pros: string[];
		cons: string[];
	};
	files: {
		modify: FileChange[];
		create: FileChange[];
		delete: string[];
	};
}

export interface Conflict {
	id: string;
	type: 'merge' | 'dependency' | 'logic' | 'other';
	description: string;
	status: 'pending' | 'resolving' | 'resolved' | 'failed';
	files: string[];
	agentId?: string;
	agentName?: string;
	// New fields for conflict resolution
	resolutionStrategy?: 'auto' | 'manual';
	conflictingChanges?: {
		[agentId: string]: FileChange[];
	};
	resolvedChanges?: FileChange[];
	resolutionTimestamp?: string;
}

// New interface for change history
export interface ChangeHistoryEntry {
	id: string;
	timestamp: string;
	description: string;
	changeGroupId?: string;
	checkpointId?: string;
	changes: {
		modified: string[];
		created: string[];
		deleted: string[];
	};
	semanticGroups?: Record<string, string[]>;
}

/**
 * Service for managing storage of change groups, checkpoints, annotations, etc.
 */
export class StorageService {
	private context: vscode.ExtensionContext;
	private tribeDir: string | null = null;
	private static instance: StorageService | null = null;
	private changeHistory: ChangeHistoryEntry[] = [];

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.initializeTribeDirectory();
	}

	/**
	 * Get the singleton instance of the StorageService
	 */
	public static getInstance(context?: vscode.ExtensionContext): StorageService {
		if (!StorageService.instance) {
			if (!context) {
				throw new Error('Context must be provided when initializing StorageService');
			}
			StorageService.instance = new StorageService(context);
		}
		return StorageService.instance;
	}

	/**
	 * Initialize the .tribe directory in the workspace
	 */
	private initializeTribeDirectory() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (workspaceFolder) {
			this.tribeDir = path.join(workspaceFolder.uri.fsPath, '.tribe');
			if (!fs.existsSync(this.tribeDir)) {
				fs.mkdirSync(this.tribeDir, { recursive: true });
			}
		}
	}

	/**
	 * Save a change group to storage
	 */
	async saveChangeGroup(group: ChangeGroup): Promise<void> {
		const groups = await this.getChangeGroups();
		const existingIndex = groups.findIndex((g) => g.id === group.id);

		if (existingIndex >= 0) {
			groups[existingIndex] = group;
		} else {
			groups.push(group);
		}

		await this.context.workspaceState.update('changeGroups', groups);
	}

	/**
	 * Get all change groups from storage
	 */
	async getChangeGroups(): Promise<ChangeGroup[]> {
		return this.context.workspaceState.get('changeGroups', []);
	}

	/**
	 * Delete a change group from storage
	 */
	async deleteChangeGroup(groupId: string): Promise<void> {
		const groups = await this.getChangeGroups();
		const updatedGroups = groups.filter((g) => g.id !== groupId);
		await this.context.workspaceState.update('changeGroups', updatedGroups);
	}

	/**
	 * Save a checkpoint to storage
	 */
	async saveCheckpoint(checkpoint: Checkpoint, snapshotData: any): Promise<void> {
		if (!this.tribeDir) {
			throw new Error('No workspace folder found');
		}

		// Save checkpoint metadata
		const checkpoints = await this.getCheckpoints();
		const existingIndex = checkpoints.findIndex((c) => c.id === checkpoint.id);

		// Create snapshot file
		const snapshotPath = path.join(this.tribeDir, `checkpoint-${checkpoint.id}.json`);
		fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), 'utf8');

		// Update checkpoint with snapshot path
		checkpoint.snapshotPath = snapshotPath;

		// Initialize sub-checkpoints array if not present
		if (!checkpoint.subCheckpoints) {
			checkpoint.subCheckpoints = [];
		}

		if (existingIndex >= 0) {
			checkpoints[existingIndex] = checkpoint;
		} else {
			checkpoints.push(checkpoint);
		}

		await this.context.workspaceState.update('checkpoints', checkpoints);

		// Add to change history
		const historyEntry: ChangeHistoryEntry = {
			id: `history-${Date.now()}`,
			timestamp: new Date().toISOString(),
			description: `Checkpoint: ${checkpoint.description}`,
			checkpointId: checkpoint.id,
			changes: {
				modified: Object.keys(snapshotData).filter(
					(path) =>
						checkpoint.changes.modified > 0 &&
						fs.existsSync(path) &&
						fs.readFileSync(path, 'utf8') !== snapshotData[path],
				),
				created: Object.keys(snapshotData).filter((path) => !fs.existsSync(path)),
				deleted: [],
			},
			semanticGroups: this.groupChangesBySemanticFeature(checkpoint.changes),
		};

		this.changeHistory.push(historyEntry);
		await this.saveChangeHistory();
	}

	/**
	 * Get all checkpoints from storage
	 */
	async getCheckpoints(): Promise<Checkpoint[]> {
		return this.context.workspaceState.get('checkpoints', []);
	}

	/**
	 * Get a checkpoint snapshot from storage
	 */
	async getCheckpointSnapshot(checkpointId: string): Promise<any> {
		const checkpoints = await this.getCheckpoints();
		const checkpoint = checkpoints.find((c) => c.id === checkpointId);

		if (!checkpoint || !checkpoint.snapshotPath) {
			throw new Error(`Checkpoint not found: ${checkpointId}`);
		}

		const snapshotData = fs.readFileSync(checkpoint.snapshotPath, 'utf8');
		return JSON.parse(snapshotData);
	}

	/**
	 * Delete a checkpoint from storage
	 */
	async deleteCheckpoint(checkpointId: string): Promise<void> {
		const checkpoints = await this.getCheckpoints();
		const checkpoint = checkpoints.find((c) => c.id === checkpointId);

		if (checkpoint && checkpoint.snapshotPath && fs.existsSync(checkpoint.snapshotPath)) {
			fs.unlinkSync(checkpoint.snapshotPath);
		}

		const updatedCheckpoints = checkpoints.filter((c) => c.id !== checkpointId);
		await this.context.workspaceState.update('checkpoints', updatedCheckpoints);
	}

	/**
	 * Save an annotation to storage
	 */
	async saveAnnotation(annotation: Annotation): Promise<void> {
		const annotations = await this.getAnnotations();
		const existingIndex = annotations.findIndex((a) => a.id === annotation.id);

		if (existingIndex >= 0) {
			annotations[existingIndex] = annotation;
		} else {
			annotations.push(annotation);
		}

		await this.context.workspaceState.update('annotations', annotations);
	}

	/**
	 * Get all annotations from storage
	 */
	async getAnnotations(): Promise<Annotation[]> {
		return this.context.workspaceState.get('annotations', []);
	}

	/**
	 * Delete an annotation from storage
	 */
	async deleteAnnotation(annotationId: string): Promise<void> {
		const annotations = await this.getAnnotations();

		// Helper function to recursively remove annotations
		const removeAnnotation = (items: Annotation[]): Annotation[] => {
			return items.filter((item) => {
				if (item.id === annotationId) {
					return false;
				}
				if (item.replies.length > 0) {
					item.replies = removeAnnotation(item.replies);
				}
				return true;
			});
		};

		const updatedAnnotations = removeAnnotation(annotations);
		await this.context.workspaceState.update('annotations', updatedAnnotations);
	}

	/**
	 * Add a reply to an annotation
	 */
	async addReplyToAnnotation(parentId: string, reply: Annotation): Promise<void> {
		const annotations = await this.getAnnotations();

		// Helper function to recursively find and update the parent annotation
		const addReply = (items: Annotation[]): boolean => {
			for (const item of items) {
				if (item.id === parentId) {
					item.replies.push(reply);
					return true;
				}
				if (item.replies.length > 0 && addReply(item.replies)) {
					return true;
				}
			}
			return false;
		};

		if (addReply(annotations)) {
			await this.context.workspaceState.update('annotations', annotations);
		} else {
			throw new Error(`Parent annotation not found: ${parentId}`);
		}
	}

	/**
	 * Save an alternative implementation to storage
	 */
	async saveImplementation(implementation: Implementation): Promise<void> {
		const implementations = await this.getImplementations();
		const existingIndex = implementations.findIndex((i) => i.id === implementation.id);

		if (existingIndex >= 0) {
			implementations[existingIndex] = implementation;
		} else {
			implementations.push(implementation);
		}

		await this.context.workspaceState.update('implementations', implementations);
	}

	/**
	 * Get all alternative implementations from storage
	 */
	async getImplementations(): Promise<Implementation[]> {
		return this.context.workspaceState.get('implementations', []);
	}

	/**
	 * Delete an alternative implementation from storage
	 */
	async deleteImplementation(implementationId: string): Promise<void> {
		const implementations = await this.getImplementations();
		const updatedImplementations = implementations.filter((i) => i.id !== implementationId);
		await this.context.workspaceState.update('implementations', updatedImplementations);
	}

	/**
	 * Save a conflict to storage
	 */
	async saveConflict(conflict: Conflict): Promise<void> {
		const conflicts = await this.getConflicts();
		const existingIndex = conflicts.findIndex((c) => c.id === conflict.id);

		if (existingIndex >= 0) {
			conflicts[existingIndex] = conflict;
		} else {
			conflicts.push(conflict);
		}

		await this.context.workspaceState.update('conflicts', conflicts);
	}

	/**
	 * Get all conflicts from storage
	 */
	async getConflicts(): Promise<Conflict[]> {
		return this.context.workspaceState.get('conflicts', []);
	}

	/**
	 * Delete a conflict from storage
	 */
	async deleteConflict(conflictId: string): Promise<void> {
		const conflicts = await this.getConflicts();
		const updatedConflicts = conflicts.filter((c) => c.id !== conflictId);
		await this.context.workspaceState.update('conflicts', updatedConflicts);
	}

	/**
	 * Create a snapshot of the current workspace
	 */
	async createWorkspaceSnapshot(): Promise<any> {
		if (!this.tribeDir) {
			throw new Error('No workspace folder found');
		}

		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error('No workspace folder found');
		}

		const snapshot: Record<string, string> = {};

		// Helper function to recursively read files
		const readFilesRecursively = (dir: string, baseDir: string) => {
			const entries = fs.readdirSync(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				const relativePath = path.relative(baseDir, fullPath);

				// Skip .tribe directory and node_modules
				if (entry.name === '.tribe' || entry.name === 'node_modules' || entry.name === '.git') {
					continue;
				}

				if (entry.isDirectory()) {
					readFilesRecursively(fullPath, baseDir);
				} else {
					try {
						const content = fs.readFileSync(fullPath, 'utf8');
						snapshot[relativePath] = content;
					} catch (error) {
						console.warn(`Failed to read file: ${fullPath}`, error);
					}
				}
			}
		};

		readFilesRecursively(workspaceFolder.uri.fsPath, workspaceFolder.uri.fsPath);

		return snapshot;
	}

	/**
	 * Restore workspace from a snapshot
	 */
	async restoreWorkspaceFromSnapshot(snapshot: Record<string, string>): Promise<void> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error('No workspace folder found');
		}

		for (const [relativePath, content] of Object.entries(snapshot)) {
			const fullPath = path.join(workspaceFolder.uri.fsPath, relativePath);
			const dirPath = path.dirname(fullPath);

			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}

			fs.writeFileSync(fullPath, content, 'utf8');
		}
	}

	/**
	 * Calculate the diff between two snapshots using the Myers diff algorithm
	 */
	calculateDiff(
		oldSnapshot: Record<string, string>,
		newSnapshot: Record<string, string>,
	): {
		modified: string[];
		created: string[];
		deleted: string[];
		fileChanges: FileChange[];
	} {
		const modified: string[] = [];
		const created: string[] = [];
		const deleted: string[] = [];
		const fileChanges: FileChange[] = [];

		// Find modified and deleted files
		for (const path in oldSnapshot) {
			if (path in newSnapshot) {
				if (oldSnapshot[path] !== newSnapshot[path]) {
					modified.push(path);

					// Generate detailed file change with hunks
					const fileChange = DiffUtils.generateFileChange(path, oldSnapshot[path], newSnapshot[path]);

					fileChanges.push(fileChange);
				}
			} else {
				deleted.push(path);

				// Add deleted file to file changes
				fileChanges.push({
					path,
					content: '',
					originalContent: oldSnapshot[path],
					explanation: 'File deleted',
				});
			}
		}

		// Find created files
		for (const path in newSnapshot) {
			if (!(path in oldSnapshot)) {
				created.push(path);

				// Add created file to file changes
				fileChanges.push({
					path,
					content: newSnapshot[path],
					explanation: 'File created',
				});
			}
		}

		return { modified, created, deleted, fileChanges };
	}

	/**
	 * Group file changes by semantic features
	 */
	groupFileChangesByFeature(fileChanges: FileChange[]): Record<string, FileChange[]> {
		// Use DiffUtils to group changes by feature
		const groupedChanges: Record<string, FileChange[]> = {};

		// Group by file extension as a simple heuristic
		for (const change of fileChanges) {
			const ext = path.extname(change.path).toLowerCase();
			const featureGroup = ext ? ext.substring(1) : 'other'; // Remove the dot

			if (!groupedChanges[featureGroup]) {
				groupedChanges[featureGroup] = [];
			}

			groupedChanges[featureGroup].push(change);
		}

		// If we have hunks with semantic groups, use those for more detailed grouping
		const semanticGroups: Record<string, FileChange[]> = {};

		for (const change of fileChanges) {
			if (change.hunks) {
				for (const hunk of change.hunks) {
					if (hunk.semanticGroup) {
						if (!semanticGroups[hunk.semanticGroup]) {
							semanticGroups[hunk.semanticGroup] = [];
						}

						// Check if we already have this file change in this group
						const existingChange = semanticGroups[hunk.semanticGroup].find((c) => c.path === change.path);

						if (existingChange) {
							// Add the hunk to the existing change
							if (!existingChange.hunks) {
								existingChange.hunks = [];
							}
							existingChange.hunks.push(hunk);
						} else {
							// Create a new file change with just this hunk
							semanticGroups[hunk.semanticGroup].push({
								path: change.path,
								content: change.content,
								originalContent: change.originalContent,
								hunks: [hunk],
							});
						}
					}
				}
			}
		}

		// Merge the extension-based groups and semantic groups
		const result = { ...groupedChanges, ...semanticGroups };

		// If we have no semantic groups, add an "Uncategorized" group with all changes
		if (Object.keys(result).length === 0) {
			result['Uncategorized'] = [...fileChanges];
		}

		return result;
	}

	/**
	 * Create a sub-checkpoint within a parent checkpoint
	 */
	async createSubCheckpoint(
		parentCheckpointId: string,
		description: string,
		changes: { modified: string[]; created: string[]; deleted: string[] },
	): Promise<SubCheckpoint> {
		const checkpoints = await this.getCheckpoints();
		const parentIndex = checkpoints.findIndex((c) => c.id === parentCheckpointId);

		if (parentIndex < 0) {
			throw new Error(`Parent checkpoint not found: ${parentCheckpointId}`);
		}

		const subCheckpoint: SubCheckpoint = {
			id: `sub-${Date.now()}`,
			timestamp: new Date().toISOString(),
			description,
			parentCheckpointId,
			changes,
		};

		if (!checkpoints[parentIndex].subCheckpoints) {
			checkpoints[parentIndex].subCheckpoints = [];
		}

		checkpoints[parentIndex].subCheckpoints!.push(subCheckpoint);
		await this.context.workspaceState.update('checkpoints', checkpoints);

		// Add to change history
		const historyEntry: ChangeHistoryEntry = {
			id: `history-${Date.now()}`,
			timestamp: new Date().toISOString(),
			description: `Sub-checkpoint: ${description}`,
			checkpointId: parentCheckpointId,
			changes,
			semanticGroups: this.groupChangesBySemanticFeature({
				modified: changes.modified.length,
				created: changes.created.length,
				deleted: changes.deleted.length,
			}),
		};

		this.changeHistory.push(historyEntry);
		await this.saveChangeHistory();

		return subCheckpoint;
	}

	/**
	 * Revert to a specific sub-checkpoint
	 */
	async revertToSubCheckpoint(parentCheckpointId: string, subCheckpointId: string): Promise<void> {
		const checkpoints = await this.getCheckpoints();
		const parentCheckpoint = checkpoints.find((c) => c.id === parentCheckpointId);

		if (!parentCheckpoint || !parentCheckpoint.subCheckpoints) {
			throw new Error(`Parent checkpoint not found: ${parentCheckpointId}`);
		}

		const subCheckpoint = parentCheckpoint.subCheckpoints.find((sc) => sc.id === subCheckpointId);
		if (!subCheckpoint) {
			throw new Error(`Sub-checkpoint not found: ${subCheckpointId}`);
		}

		// Get the parent checkpoint snapshot
		const snapshotData = await this.getCheckpointSnapshot(parentCheckpointId);

		// Apply the changes from the sub-checkpoint
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error('No workspace folder found');
		}

		// Restore files from the sub-checkpoint
		for (const filePath of subCheckpoint.changes.modified) {
			const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
			if (snapshotData[filePath] && fs.existsSync(path.dirname(fullPath))) {
				fs.writeFileSync(fullPath, snapshotData[filePath], 'utf8');
			}
		}

		for (const filePath of subCheckpoint.changes.created) {
			const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
			if (snapshotData[filePath]) {
				const dirPath = path.dirname(fullPath);
				if (!fs.existsSync(dirPath)) {
					fs.mkdirSync(dirPath, { recursive: true });
				}
				fs.writeFileSync(fullPath, snapshotData[filePath], 'utf8');
			}
		}

		for (const filePath of subCheckpoint.changes.deleted) {
			const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
			if (fs.existsSync(fullPath)) {
				fs.unlinkSync(fullPath);
			}
		}

		// Add to change history
		const historyEntry: ChangeHistoryEntry = {
			id: `history-${Date.now()}`,
			timestamp: new Date().toISOString(),
			description: `Reverted to sub-checkpoint: ${subCheckpoint.description}`,
			checkpointId: parentCheckpointId,
			changes: subCheckpoint.changes,
		};

		this.changeHistory.push(historyEntry);
		await this.saveChangeHistory();
	}

	/**
	 * Save change history to storage
	 */
	private async saveChangeHistory(): Promise<void> {
		await this.context.workspaceState.update('changeHistory', this.changeHistory);
	}

	/**
	 * Get change history from storage
	 */
	async getChangeHistory(): Promise<ChangeHistoryEntry[]> {
		const history = await this.context.workspaceState.get('changeHistory', []);
		this.changeHistory = history;
		return history;
	}

	/**
	 * Group changes by semantic feature
	 */
	private groupChangesBySemanticFeature(changes: {
		modified: number;
		created: number;
		deleted: number;
	}): Record<string, string[]> {
		// This is a placeholder implementation
		// In a real implementation, we would analyze the files and group them by semantic features
		return {
			Uncategorized: [`${changes.modified} modified, ${changes.created} created, ${changes.deleted} deleted`],
		};
	}

	/**
	 * Resolve a conflict automatically using agent-based resolution
	 */
	async resolveConflictAutomatically(conflictId: string): Promise<FileChange[]> {
		const conflicts = await this.getConflicts();
		const conflictIndex = conflicts.findIndex((c) => c.id === conflictId);

		if (conflictIndex < 0) {
			throw new Error(`Conflict not found: ${conflictId}`);
		}

		const conflict = conflicts[conflictIndex];

		if (!conflict.conflictingChanges || Object.keys(conflict.conflictingChanges).length === 0) {
			throw new Error('No conflicting changes to resolve');
		}

		// Set conflict status to resolving
		conflict.status = 'resolving';
		conflict.resolutionStrategy = 'auto';
		await this.saveConflict(conflict);

		// Merge the conflicting changes
		// This is a simple implementation that just takes the most recent changes
		// In a real implementation, we would use a more sophisticated algorithm
		const resolvedChanges: FileChange[] = [];
		const allChanges: FileChange[] = [];

		// Collect all changes from all agents
		for (const agentId in conflict.conflictingChanges) {
			allChanges.push(...conflict.conflictingChanges[agentId]);
		}

		// Group changes by file path
		const changesByFile: Record<string, FileChange[]> = {};
		for (const change of allChanges) {
			if (!changesByFile[change.path]) {
				changesByFile[change.path] = [];
			}
			changesByFile[change.path].push(change);
		}

		// For each file, merge the changes
		for (const filePath in changesByFile) {
			const fileChanges = changesByFile[filePath];

			// Sort by timestamp (assuming the most recent change is the best)
			fileChanges.sort((a, b) => {
				const aTime = new Date(a.timestamp || '0').getTime();
				const bTime = new Date(b.timestamp || '0').getTime();
				return bTime - aTime;
			});

			// Take the most recent change
			const mostRecentChange = fileChanges[0];

			// If there are hunks, merge them
			if (fileChanges.some((fc) => fc.hunks && fc.hunks.length > 0)) {
				// Collect all hunks
				const allHunks: Array<{
					startLine: number;
					endLine: number;
					content: string;
					originalContent?: string;
					semanticGroup?: string;
				}> = [];

				for (const change of fileChanges) {
					if (change.hunks) {
						allHunks.push(...change.hunks);
					}
				}

				// Sort hunks by start line
				allHunks.sort((a, b) => a.startLine - b.startLine);

				// Merge overlapping hunks
				const mergedHunks: Array<{
					startLine: number;
					endLine: number;
					content: string;
					originalContent?: string;
					semanticGroup?: string;
				}> = [];

				for (const hunk of allHunks) {
					// Check if this hunk overlaps with any existing merged hunk
					let overlapped = false;
					for (let i = 0; i < mergedHunks.length; i++) {
						const mergedHunk = mergedHunks[i];

						// Check for overlap
						if (
							(hunk.startLine >= mergedHunk.startLine && hunk.startLine <= mergedHunk.endLine) ||
							(hunk.endLine >= mergedHunk.startLine && hunk.endLine <= mergedHunk.endLine) ||
							(mergedHunk.startLine >= hunk.startLine && mergedHunk.startLine <= hunk.endLine)
						) {
							// Merge the hunks
							mergedHunk.startLine = Math.min(mergedHunk.startLine, hunk.startLine);
							mergedHunk.endLine = Math.max(mergedHunk.endLine, hunk.endLine);
							mergedHunk.content = hunk.content; // Take the content from the most recent hunk
							mergedHunk.originalContent = mergedHunk.originalContent || hunk.originalContent;
							overlapped = true;
							break;
						}
					}

					if (!overlapped) {
						mergedHunks.push({ ...hunk });
					}
				}

				// Create a new file change with the merged hunks
				mostRecentChange.hunks = mergedHunks;
			}

			resolvedChanges.push(mostRecentChange);
		}

		// Update the conflict with the resolved changes
		conflict.resolvedChanges = resolvedChanges;
		conflict.status = 'resolved';
		conflict.resolutionTimestamp = new Date().toISOString();
		await this.saveConflict(conflict);

		return resolvedChanges;
	}
}
