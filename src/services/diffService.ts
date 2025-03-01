/* eslint-disable header/header */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileChange } from '../models/types';

/**
 * Service for generating and managing diffs between files
 */
export class DiffService {
	private static instance: DiffService | null = null;

	private constructor() {}

	/**
	 * Get the singleton instance of the DiffService
	 * @returns DiffService instance
	 */
	public static getInstance(): DiffService {
		if (!DiffService.instance) {
			DiffService.instance = new DiffService();
		}
		return DiffService.instance;
	}

	/**
	 * Generate hunks for a file change by comparing original and modified content using Myers diff algorithm
	 * @param originalContent The original file content
	 * @param modifiedContent The modified file content
	 * @returns An array of hunks representing the changes
	 */
	public generateHunks(
		originalContent: string,
		modifiedContent: string,
	): Array<{
		startLine: number;
		endLine: number;
		content: string;
		originalContent: string;
		semanticGroup?: string;
	}> {
		// Split the content into lines
		const originalLines = originalContent.split('\n');
		const modifiedLines = modifiedContent.split('\n');

		// Compute the diff using Myers algorithm
		const diff = this.myersDiff(originalLines, modifiedLines);

		// Convert diff to hunks
		const hunks: Array<{
			startLine: number;
			endLine: number;
			content: string;
			originalContent: string;
			semanticGroup?: string;
		}> = [];

		let currentHunk: {
			startLine: number;
			endLine: number;
			content: string[];
			originalContent: string[];
		} | null = null;

		let i = 0;
		let j = 0;

		for (const d of diff) {
			if (d.type === 'equal') {
				// If we have a current hunk, finalize it
				if (currentHunk) {
					hunks.push({
						startLine: currentHunk.startLine,
						endLine: currentHunk.endLine,
						content: currentHunk.content.join('\n'),
						originalContent: currentHunk.originalContent.join('\n'),
					});
					currentHunk = null;
				}

				// Skip equal lines
				i += d.count;
				j += d.count;
			} else if (d.type === 'insert') {
				// Start a new hunk if needed
				if (!currentHunk) {
					currentHunk = {
						startLine: i + 1, // 1-indexed
						endLine: i + 1,
						content: [],
						originalContent: [],
					};
				}

				// Add inserted lines to the hunk
				for (let k = 0; k < d.count; k++) {
					currentHunk.content.push(modifiedLines[j + k]);
					currentHunk.originalContent.push('');
				}

				// Update the end line
				currentHunk.endLine = i + 1;

				// Move the modified content pointer
				j += d.count;
			} else if (d.type === 'delete') {
				// Start a new hunk if needed
				if (!currentHunk) {
					currentHunk = {
						startLine: i + 1, // 1-indexed
						endLine: i + d.count,
						content: [],
						originalContent: [],
					};
				}

				// Add deleted lines to the hunk
				for (let k = 0; k < d.count; k++) {
					currentHunk.content.push('');
					currentHunk.originalContent.push(originalLines[i + k]);
				}

				// Update the end line
				currentHunk.endLine = i + d.count;

				// Move the original content pointer
				i += d.count;
			} else if (d.type === 'replace') {
				// Start a new hunk if needed
				if (!currentHunk) {
					currentHunk = {
						startLine: i + 1, // 1-indexed
						endLine: i + d.count,
						content: [],
						originalContent: [],
					};
				}

				// Add replaced lines to the hunk
				for (let k = 0; k < d.count; k++) {
					currentHunk.content.push(modifiedLines[j + k]);
					currentHunk.originalContent.push(originalLines[i + k]);
				}

				// Update the end line
				currentHunk.endLine = i + d.count;

				// Move both pointers
				i += d.count;
				j += d.count;
			}
		}

		// Finalize the last hunk if needed
		if (currentHunk) {
			hunks.push({
				startLine: currentHunk.startLine,
				endLine: currentHunk.endLine,
				content: currentHunk.content.join('\n'),
				originalContent: currentHunk.originalContent.join('\n'),
			});
		}

		// Apply semantic grouping to the hunks
		return this.applySemanticGrouping(hunks, originalContent, modifiedContent);
	}

	/**
	 * Generate a FileChange object for a file
	 * @param filePath Path to the file
	 * @param originalContent Original content of the file
	 * @param modifiedContent Modified content of the file
	 * @returns FileChange object
	 */
	public generateFileChange(filePath: string, originalContent: string, modifiedContent: string): FileChange {
		const hunks = this.generateHunks(originalContent, modifiedContent);

		return {
			path: filePath,
			content: modifiedContent,
			originalContent,
			type: 'modify',
		};
	}

	/**
	 * Show a diff between two contents in VS Code
	 * @param originalContent Original content
	 * @param modifiedContent Modified content
	 * @param title Title for the diff view
	 */
	public async showDiff(originalContent: string, modifiedContent: string, title: string): Promise<void> {
		// Create temporary URIs for the diff
		const originalUri = vscode.Uri.parse(`untitled:Original-${title}`);
		const modifiedUri = vscode.Uri.parse(`untitled:Modified-${title}`);

		// Show the diff
		const diff = await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, `Diff: ${title}`, {
			preview: true,
		});

		// Create the documents with the content
		const originalDoc = await vscode.workspace.openTextDocument(originalUri);
		const modifiedDoc = await vscode.workspace.openTextDocument(modifiedUri);

		// Edit the documents to add the content
		const originalEdit = new vscode.WorkspaceEdit();
		const modifiedEdit = new vscode.WorkspaceEdit();

		originalEdit.insert(originalUri, new vscode.Position(0, 0), originalContent);
		modifiedEdit.insert(modifiedUri, new vscode.Position(0, 0), modifiedContent);

		await vscode.workspace.applyEdit(originalEdit);
		await vscode.workspace.applyEdit(modifiedEdit);
	}

	/**
	 * Get the content of a file
	 * @param filePath Path to the file
	 * @returns File content or null if the file doesn't exist
	 */
	public getFileContent(filePath: string): string | null {
		try {
			// Get the workspace folder
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				return null;
			}

			// Resolve the file path
			const absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);

			// Check if the file exists
			if (!fs.existsSync(absolutePath)) {
				return null;
			}

			// Read the file content
			return fs.readFileSync(absolutePath, 'utf8');
		} catch (error) {
			console.error(`Error reading file ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * Apply a file change to the workspace
	 * @param fileChange FileChange object
	 * @returns True if the change was applied successfully
	 */
	public applyFileChange(fileChange: FileChange): boolean {
		try {
			// Get the workspace folder
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				return false;
			}

			// Resolve the file path
			const absolutePath = path.join(workspaceFolders[0].uri.fsPath, fileChange.path);

			// Create the directory if it doesn't exist
			const directory = path.dirname(absolutePath);
			if (!fs.existsSync(directory)) {
				fs.mkdirSync(directory, { recursive: true });
			}

			// Write the file content
			fs.writeFileSync(absolutePath, fileChange.content, 'utf8');

			return true;
		} catch (error) {
			console.error(`Error applying file change to ${fileChange.path}:`, error);
			return false;
		}
	}

	/**
	 * Delete a file from the workspace
	 * @param filePath Path to the file
	 * @returns True if the file was deleted successfully
	 */
	public deleteFile(filePath: string): boolean {
		try {
			// Get the workspace folder
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				return false;
			}

			// Resolve the file path
			const absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);

			// Check if the file exists
			if (!fs.existsSync(absolutePath)) {
				return false;
			}

			// Delete the file
			fs.unlinkSync(absolutePath);

			return true;
		} catch (error) {
			console.error(`Error deleting file ${filePath}:`, error);
			return false;
		}
	}

	/**
	 * Group changes by feature
	 * @param changeGroups Array of change groups
	 * @returns Record of feature names to change groups
	 */
	public groupChangesByFeature(changeGroups: any[]): Record<string, any[]> {
		const groupedChanges: Record<string, any[]> = {};

		for (const group of changeGroups) {
			// Extract feature names from the title and description
			const featureNames = this.extractFeatureNames(group.title, group.description);

			// If no features were extracted, use a default feature
			if (featureNames.length === 0) {
				featureNames.push('General');
			}

			// Add the group to each feature
			for (const feature of featureNames) {
				if (!groupedChanges[feature]) {
					groupedChanges[feature] = [];
				}
				groupedChanges[feature].push(group);
			}
		}

		return groupedChanges;
	}

	/**
	 * Apply semantic grouping to hunks
	 * @param hunks Array of hunks
	 * @param originalContent Original content
	 * @param modifiedContent Modified content
	 * @returns Array of hunks with semantic grouping
	 */
	private applySemanticGrouping(
		hunks: Array<{
			startLine: number;
			endLine: number;
			content: string;
			originalContent: string;
			semanticGroup?: string;
		}>,
		originalContent: string,
		modifiedContent: string,
	): Array<{
		startLine: number;
		endLine: number;
		content: string;
		originalContent: string;
		semanticGroup?: string;
	}> {
		// Identify code structures in the original content
		const codeStructures = this.identifyCodeStructures(originalContent, modifiedContent);

		// Apply semantic grouping to hunks
		for (const hunk of hunks) {
			// Find the code structure that contains this hunk
			for (const structure of codeStructures) {
				if (hunk.startLine >= structure.startLine && hunk.endLine <= structure.endLine) {
					hunk.semanticGroup = structure.name;
					break;
				}
			}

			// If no semantic group was assigned, use a default
			if (!hunk.semanticGroup) {
				hunk.semanticGroup = 'General';
			}
		}

		return hunks;
	}

	/**
	 * Identify code structures in the content
	 * @param originalContent Original content
	 * @param modifiedContent Modified content
	 * @returns Array of code structures
	 */
	private identifyCodeStructures(
		originalContent: string,
		modifiedContent: string,
	): Array<{ name: string; startLine: number; endLine: number }> {
		const structures: Array<{ name: string; startLine: number; endLine: number }> = [];
		const lines = originalContent.split('\n');

		// Simple regex patterns to identify common code structures
		const patterns = [
			{ type: 'function', regex: /^\s*(function|const|let|var|async)\s+(\w+)\s*\(.*\)\s*{/i },
			{ type: 'class', regex: /^\s*class\s+(\w+)/ },
			{ type: 'method', regex: /^\s*(\w+)\s*\(.*\)\s*{/i },
			{ type: 'import', regex: /^\s*import\s+.*/ },
			{ type: 'export', regex: /^\s*export\s+.*/ },
			{ type: 'interface', regex: /^\s*interface\s+(\w+)/ },
			{ type: 'type', regex: /^\s*type\s+(\w+)/ },
			{ type: 'enum', regex: /^\s*enum\s+(\w+)/ },
		];

		// Stack to track nested structures
		const stack: Array<{ type: string; name: string; startLine: number }> = [];

		// Process each line
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check for structure start
			for (const pattern of patterns) {
				const match = line.match(pattern.regex);
				if (match) {
					const name = match[1] || match[0];
					stack.push({ type: pattern.type, name, startLine: i + 1 });
					break;
				}
			}

			// Check for structure end (simple heuristic: closing brace at the same indentation level)
			if (line.match(/^\s*}\s*$/) && stack.length > 0) {
				const structure = stack.pop();
				if (structure) {
					structures.push({
						name: `${structure.type}:${structure.name}`,
						startLine: structure.startLine,
						endLine: i + 1,
					});
				}
			}
		}

		return structures;
	}

	/**
	 * Compute the diff between two arrays using Myers diff algorithm
	 * @param a First array
	 * @param b Second array
	 * @returns Array of diff operations
	 */
	private myersDiff(
		a: string[],
		b: string[],
	): Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> {
		const n = a.length;
		const m = b.length;
		const max = n + m;
		const v = new Array(2 * max + 1).fill(0);
		const trace: number[][] = [];

		// Compute the shortest edit script
		for (let d = 0; d <= max; d++) {
			trace.push([...v]);
			for (let k = -d; k <= d; k += 2) {
				let x;
				if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
					x = v[max + k + 1];
				} else {
					x = v[max + k - 1] + 1;
				}
				let y = x - k;
				while (x < n && y < m && a[x] === b[y]) {
					x++;
					y++;
				}
				v[max + k] = x;
				if (x >= n && y >= m) {
					// Found the shortest edit script
					return this.backtrack(a, b, trace, d);
				}
			}
		}

		// Fallback: return a simple replace operation
		return [{ type: 'replace', count: Math.max(n, m) }];
	}

	/**
	 * Backtrack through the trace to build the diff
	 * @param a First array
	 * @param b Second array
	 * @param trace Trace of the diff computation
	 * @param d Final edit distance
	 * @returns Array of diff operations
	 */
	private backtrack(
		a: string[],
		b: string[],
		trace: number[][],
		d: number,
	): Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> {
		const result: Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> = [];
		const max = a.length + b.length;
		let x = a.length;
		let y = b.length;

		// Backtrack through the trace
		for (let i = d; i > 0; i--) {
			const v = trace[i];
			const k = x - y;
			let prevK;

			if (k === -i || (k !== i && v[max + k - 1] < v[max + k + 1])) {
				prevK = k + 1;
			} else {
				prevK = k - 1;
			}

			const prevX = v[max + prevK];
			const prevY = prevX - prevK;

			while (x > prevX && y > prevY) {
				// Equal elements
				result.unshift({ type: 'equal', count: 1 });
				x--;
				y--;
			}

			if (i > 0) {
				if (x === prevX) {
					// Insert
					result.unshift({ type: 'insert', count: 1 });
					y--;
				} else {
					// Delete
					result.unshift({ type: 'delete', count: 1 });
					x--;
				}
			}
		}

		// Handle remaining equal elements
		while (x > 0 && y > 0) {
			if (a[x - 1] === b[y - 1]) {
				result.unshift({ type: 'equal', count: 1 });
				x--;
				y--;
			} else {
				// Replace
				result.unshift({ type: 'replace', count: 1 });
				x--;
				y--;
			}
		}

		// Handle remaining elements
		if (x > 0) {
			result.unshift({ type: 'delete', count: x });
		}
		if (y > 0) {
			result.unshift({ type: 'insert', count: y });
		}

		// Merge consecutive operations of the same type
		const merged: Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> = [];
		let current: { type: 'equal' | 'insert' | 'delete' | 'replace'; count: number } | null = null;

		for (const op of result) {
			if (!current) {
				current = { ...op };
			} else if (current.type === op.type) {
				current.count += op.count;
			} else {
				merged.push(current);
				current = { ...op };
			}
		}

		if (current) {
			merged.push(current);
		}

		return merged;
	}

	/**
	 * Extract feature names from title and description
	 * @param title Title of the change
	 * @param description Description of the change
	 * @returns Array of feature names
	 */
	private extractFeatureNames(title: string, description: string): string[] {
		const featureNames: string[] = [];
		const combinedText = `${title} ${description}`;

		// Extract feature names using common patterns
		const patterns = [
			/feature[:\s]+([a-z0-9\s_-]+)/i,
			/implement[:\s]+([a-z0-9\s_-]+)/i,
			/add[:\s]+([a-z0-9\s_-]+)/i,
			/enhance[:\s]+([a-z0-9\s_-]+)/i,
			/improve[:\s]+([a-z0-9\s_-]+)/i,
			/refactor[:\s]+([a-z0-9\s_-]+)/i,
			/fix[:\s]+([a-z0-9\s_-]+)/i,
		];

		for (const pattern of patterns) {
			const match = combinedText.match(pattern);
			if (match && match[1]) {
				featureNames.push(match[1].trim());
			}
		}

		// If no features were extracted, use the title as a feature
		if (featureNames.length === 0 && title) {
			featureNames.push(title);
		}

		return featureNames;
	}
}
