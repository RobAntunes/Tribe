/* eslint-disable header/header */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

/**
 * API endpoints for the extension
 */
export const API_ENDPOINTS = {
    // Using crew ai's native LLM functionality instead of external endpoint
    MODEL: process.env.TRIBE_MODEL || 'claude-3-7-sonnet-20250219',
    ANALYTICS: 'https://analytics.example.com/api',
    GENERATE_EXPLANATION: '/api/generate-explanation',
    GENERATE_IMPLEMENTATION: '/api/generate-implementation',
    RESOLVE_CONFLICT: '/api/resolve-conflict',
};

/**
 * Storage paths for the extension
 */
export const STORAGE_PATHS = {
    BASE_DIR: '.tribe',
    CHANGE_GROUPS: 'changeGroups',
    CHECKPOINTS: 'checkpoints',
    ANNOTATIONS: 'annotations',
    IMPLEMENTATIONS: 'implementations',
    CONFLICTS: 'conflicts',
    HISTORY: 'history',
    AGENTS: 'agents',
    TEAMS: 'teams',
    PROJECTS: 'projects',
};

/**
 * Command identifiers for the extension
 */
export const COMMANDS = {
    // Change management commands
    APPLY_CHANGES: 'tribe.applyChanges',
    CREATE_CHANGE_GROUP: 'tribe.createChangeGroup',
    ACCEPT_CHANGE_GROUP: 'tribe.acceptChangeGroup',
    REJECT_CHANGE_GROUP: 'tribe.rejectChangeGroup',
    ACCEPT_FILE: 'tribe.acceptFile',
    REJECT_FILE: 'tribe.rejectFile',
    MODIFY_CHANGE: 'tribe.modifyChange',
    REQUEST_EXPLANATION: 'tribe.requestExplanation',
    GET_PENDING_CHANGES: 'tribe.getPendingChanges',
    VIEW_DIFF: 'tribe.viewDiff',
    GENERATE_HUNKS: 'tribe.generateHunks',

    // Checkpoint commands
    CREATE_CHECKPOINT: 'tribe.createCheckpoint',
    GET_CHECKPOINTS: 'tribe.getCheckpoints',
    RESTORE_CHECKPOINT: 'tribe.restoreCheckpoint',
    DELETE_CHECKPOINT: 'tribe.deleteCheckpoint',
    VIEW_CHECKPOINT_DIFF: 'tribe.viewCheckpointDiff',
    CREATE_SUB_CHECKPOINT: 'tribe.createSubCheckpoint',
    REVERT_TO_SUB_CHECKPOINT: 'tribe.revertToSubCheckpoint',

    // Annotation commands
    CREATE_ANNOTATION: 'tribe.createAnnotation',
    GET_ANNOTATIONS: 'tribe.getAnnotations',
    DELETE_ANNOTATION: 'tribe.deleteAnnotation',
    RESOLVE_ANNOTATION: 'tribe.resolveAnnotation',
    ADD_REPLY: 'tribe.addReply',
    SHOW_ANNOTATIONS_IN_FILE: 'tribe.showAnnotationsInFile',

    // Implementation commands
    CREATE_IMPLEMENTATION: 'tribe.createImplementation',
    GET_IMPLEMENTATIONS: 'tribe.getImplementations',
    DELETE_IMPLEMENTATION: 'tribe.deleteImplementation',
    APPLY_IMPLEMENTATION: 'tribe.applyImplementation',
    VIEW_IMPLEMENTATION_DIFF: 'tribe.viewImplementationDiff',
    UPDATE_IMPLEMENTATION_STATUS: 'tribe.updateImplementationStatus',

    // Conflict commands
    CREATE_CONFLICT: 'tribe.createConflict',
    GET_CONFLICTS: 'tribe.getConflicts',
    DELETE_CONFLICT: 'tribe.deleteConflict',
    RESOLVE_CONFLICT: 'tribe.resolveConflict',
    RESOLVE_CONFLICT_WITH_AGENT: 'tribe.resolveConflictWithAgent',
    RESOLVE_CONFLICT_WITH_USER: 'tribe.resolveConflictWithUser',
    VIEW_CONFLICT_DIFF: 'tribe.viewConflictDiff',
    MERGE_CONFLICT_CHANGES: 'tribe.mergeConflictChanges',

    // History commands
    RECORD_HISTORY_ENTRY: 'tribe.recordHistoryEntry',
    GET_HISTORY: 'tribe.getHistory',
    CLEAR_HISTORY: 'tribe.clearHistory',
    VIEW_HISTORY_DIFF: 'tribe.viewHistoryDiff',
    REVERT_HISTORY_ENTRY: 'tribe.revertHistoryEntry',
    SHOW_HISTORY_VIEW: 'tribe.showHistoryView',

    // Workspace management
    GET_WORKSPACE_SNAPSHOT: 'tribe.getWorkspaceSnapshot',

    // Semantic grouping
    GROUP_CHANGES_BY_FEATURE: 'tribe.groupChangesByFeature',

    // UI commands
    SHOW_CREW_PANEL: 'tribe.showCrewPanel',
    RESTART_SERVER: 'tribe.restart',

    // New commands
    INITIALIZE: 'tribe.initialize',
    CREATE_TEAM: 'tribe.createTeam',
    CREATE_AGENT: 'tribe.createAgent',
    SEND_AGENT_MESSAGE: 'tribe.sendAgentMessage',
    SEND_CREW_MESSAGE: 'tribe.sendCrewMessage',
    ANALYZE_REQUIREMENTS: 'tribe.analyzeRequirements',
    GET_AGENTS: 'tribe.getAgents',
};

/**
 * Storage directory names
 */
export const STORAGE_DIRS = {
    CHANGE_GROUPS: 'change_groups',
    CHECKPOINTS: 'checkpoints',
    ANNOTATIONS: 'annotations',
    IMPLEMENTATIONS: 'implementations',
    CONFLICTS: 'conflicts',
    HISTORY: 'history',
};

/**
 * Get configuration value from VS Code settings
 * @param section Configuration section
 * @param defaultValue Default value if not found
 * @returns Configuration value
 */
export function getConfiguration<T>(section: string, defaultValue: T): T {
    return vscode.workspace.getConfiguration('tribe').get<T>(section, defaultValue);
}

/**
 * Update configuration value in VS Code settings
 * @param section Configuration section
 * @param value New value
 * @param configurationTarget Target scope
 * @returns Promise that resolves when the update is complete
 */
export async function updateConfiguration<T>(
    section: string,
    value: T,
    configurationTarget: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global,
): Promise<void> {
    return vscode.workspace.getConfiguration('tribe').update(section, value, configurationTarget);
}

/**
 * Extension settings with default values
 */
export const DEFAULT_SETTINGS = {
    STORAGE_DIR: path.join(os.homedir(), '.tribe'),
    LOG_LEVEL: 'info',
    AUTO_APPLY_CHANGES: false,
    SHOW_NOTIFICATIONS: true,
    CONFLICT_RESOLUTION_STRATEGY: 'manual',
    MAX_HISTORY_ENTRIES: 100,
    CHECKPOINT_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
};

/**
 * Get the extension's storage directory
 * @returns Path to the storage directory
 */
export function getStorageDirectory(): string {
    return getConfiguration<string>('storageDir', DEFAULT_SETTINGS.STORAGE_DIR);
}
