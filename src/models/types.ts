/* eslint-disable header/header */

import * as vscode from 'vscode';

/**
 * Types for change management
 */
export interface FileChange {
	path: string;
	content: string;
	type: 'create' | 'modify' | 'delete';
	originalContent?: string;
	explanation?: string;
}

export interface ChangeGroup {
	id: string;
	timestamp: string;
	title: string;
	description: string;
	files: FileChange[];
	status: 'pending' | 'accepted' | 'rejected' | 'partial';
	tags?: string[];
}

export interface ApplyChangesPayload {
	files: {
		modify: { [path: string]: string };
		create: { [path: string]: string };
		delete: string[];
	};
}

/**
 * Types for checkpoint management
 */
export interface Checkpoint {
	id: string;
	timestamp: string;
	description: string;
	changes: {
		modified: number;
		created: number;
		deleted: number;
	};
	snapshotPath: string;
	snapshot?: Record<string, string>; // Add snapshot property for direct access
	changeGroups?: string[];
	subCheckpoints?: SubCheckpoint[];
}

export interface SubCheckpoint {
	id: string;
	timestamp: string;
	description: string;
	changes: FileChange[];
	parentCheckpointId?: string;
}

export interface CreateCheckpointPayload {
	description: string;
	changeGroups?: string[];
}

export interface CreateSubCheckpointPayload {
	parentCheckpointId: string;
	description: string;
	changes: FileChange[];
}

export interface RevertToSubCheckpointPayload {
	checkpointId: string;
	subCheckpointId: string;
}

export interface WorkspaceSnapshot {
	[filePath: string]: string;
}

/**
 * Types for annotation management
 */
export interface AnnotationReply {
	id: string;
	timestamp: string;
	content: string;
	author: string | { id: string; name: string; type: 'human' | 'agent' };
	filePath?: string;
	lineNumber?: number;
	resolved?: boolean;
	replies?: AnnotationReply[];
}

export interface Annotation {
	id: string;
	timestamp: string;
	filePath: string;
	lineNumber: number;
	content: string;
	author: string | { id: string; name: string; type: 'human' | 'agent' };
	replies: AnnotationReply[];
	resolved: boolean;
	type?: string;
	tags?: string[];
}

export interface CreateAnnotationPayload {
	filePath: string;
	lineNumber: number;
	content: string;
	author?: string;
	tags?: string[];
}

export interface AddReplyPayload {
	parentId: string;
	content: string;
	author?: string;
}

/**
 * Types for implementation management
 */
export interface Implementation {
	id: string;
	timestamp: string;
	title: string;
	description: string;
	files: FileChange[];
	status: 'pending' | 'applied' | 'rejected';
	author: string;
	tags?: string[];
}

export interface CreateImplementationPayload {
	title: string;
	description: string;
	files?: FileChange[];
	author?: string;
	tags?: string[];
}

export interface ApplyImplementationPayload {
	implementationId: string;
}

/**
 * Types for conflict management
 */
export interface Conflict {
	id: string;
	timestamp: string;
	title: string;
	description: string;
	filePath: string;
	status: 'unresolved' | 'resolved';
	agentChanges: FileChange[];
	userChanges: FileChange[];
	resolvedContent: string | null;
	conflictingChanges?: Record<string, FileChange[]>;
	resolvedChanges?: FileChange[];
	resolutionStrategy?: 'auto' | 'manual';
	resolutionTimestamp?: string;
}

export interface CreateConflictPayload {
	title: string;
	description: string;
	filePath: string;
	agentChanges?: FileChange[];
	userChanges?: FileChange[];
}

export interface ResolveConflictPayload {
	conflictId: string;
	resolvedContent: string;
}

/**
 * Types for history management
 */
export interface HistoryEntry {
	id: string;
	timestamp: string;
	description: string;
	changes: FileChange[];
}

/**
 * Types for change group management
 */
export interface CreateChangeGroupPayload {
	title: string;
	description: string;
	files?: FileChange[];
	filesToModify?: { path: string; content: string }[];
	filesToCreate?: { path: string; content: string }[];
	filesToDelete?: string[];
	agentId?: string;
	agentName?: string;
}
