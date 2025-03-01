import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileChange } from './storage';

/**
 * Utility functions for generating and managing diffs between files
 */
export class DiffUtils {
	/**
	 * Generate hunks for a file change by comparing original and modified content using Myers diff algorithm
	 * @param originalContent The original file content
	 * @param modifiedContent The modified file content
	 * @returns An array of hunks representing the changes
	 */
	static generateHunks(
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

		for (const edit of diff) {
			if (edit.type === 'equal') {
				// Lines are the same, close current hunk if any
				if (currentHunk) {
					hunks.push({
						startLine: currentHunk.startLine,
						endLine: currentHunk.endLine,
						content: currentHunk.content.join('\n'),
						originalContent: currentHunk.originalContent.join('\n'),
					});
					currentHunk = null;
				}
				i += edit.count;
				j += edit.count;
			} else {
				// Lines are different, start or continue a hunk
				if (!currentHunk) {
					currentHunk = {
						startLine: i + 1, // 1-indexed
						endLine: i + 1,
						content: [],
						originalContent: [],
					};
				}

				if (edit.type === 'delete') {
					// Add original lines
					for (let k = 0; k < edit.count; k++) {
						currentHunk.originalContent.push(originalLines[i]);
						i++;
					}
					currentHunk.endLine = i + 1;
				} else if (edit.type === 'insert') {
					// Add modified lines
					for (let k = 0; k < edit.count; k++) {
						currentHunk.content.push(modifiedLines[j]);
						j++;
					}
				} else if (edit.type === 'replace') {
					// Add both original and modified lines
					for (let k = 0; k < edit.count; k++) {
						if (i < originalLines.length) {
							currentHunk.originalContent.push(originalLines[i]);
							i++;
						}
						if (j < modifiedLines.length) {
							currentHunk.content.push(modifiedLines[j]);
							j++;
						}
					}
					currentHunk.endLine = i + 1;
				}
			}
		}

		// Close final hunk if any
		if (currentHunk) {
			hunks.push({
				startLine: currentHunk.startLine,
				endLine: currentHunk.endLine,
				content: currentHunk.content.join('\n'),
				originalContent: currentHunk.originalContent.join('\n'),
			});
		}

		// Apply semantic grouping to hunks
		return this.applySemanticGrouping(hunks, originalContent, modifiedContent);
	}

	/**
	 * Implements the Myers diff algorithm to find the shortest edit script between two sequences
	 * @param a First sequence
	 * @param b Second sequence
	 * @returns Array of edit operations
	 */
	private static myersDiff(
		a: string[],
		b: string[],
	): Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> {
		const n = a.length;
		const m = b.length;
		const max = n + m;
		const v = new Array(2 * max + 1).fill(0);
		const trace: number[][] = [];

		// Find the shortest edit script
		let d;
		for (d = 0; d <= max; d++) {
			trace.push([...v]);
			for (let k: number = -d; k <= d; k += 2) {
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
					break;
				}
			}
			if (v[max + (n - m)] >= n) {
				break;
			}
		}

		// Backtrack to find the edit script
		const edits: Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> = [];
		let x = n;
		let y = m;

		for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
			const v = trace[d];
			const k = x - y;

			let prevK;
			if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
				prevK = k + 1;
			} else {
				prevK = k - 1;
			}

			const prevX = v[max + prevK];
			const prevY = prevX - prevK;

			while (x > prevX && y > prevY) {
				// Equal elements
				edits.unshift({ type: 'equal', count: 1 });
				x--;
				y--;
			}

			if (d > 0) {
				if (x === prevX) {
					// Insertion
					edits.unshift({ type: 'insert', count: 1 });
					y--;
				} else if (y === prevY) {
					// Deletion
					edits.unshift({ type: 'delete', count: 1 });
					x--;
				} else {
					// Replacement
					edits.unshift({ type: 'replace', count: 1 });
					x--;
					y--;
				}
			}
		}

		// Consolidate consecutive operations of the same type
		const consolidatedEdits: Array<{ type: 'equal' | 'insert' | 'delete' | 'replace'; count: number }> = [];
		for (const edit of edits) {
			if (consolidatedEdits.length > 0 && consolidatedEdits[consolidatedEdits.length - 1].type === edit.type) {
				consolidatedEdits[consolidatedEdits.length - 1].count += edit.count;
			} else {
				consolidatedEdits.push({ ...edit });
			}
		}

		return consolidatedEdits;
	}

	/**
	 * Apply semantic grouping to hunks based on code structure
	 * @param hunks Array of hunks to group
	 * @param originalContent Original file content
	 * @param modifiedContent Modified file content
	 * @returns Hunks with semantic grouping applied
	 */
	private static applySemanticGrouping(
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
		// Identify semantic structures in the code
		const structures = this.identifyCodeStructures(originalContent, modifiedContent);

		// Apply semantic groups to hunks
		for (const hunk of hunks) {
			for (const structure of structures) {
				if (
					(hunk.startLine >= structure.startLine && hunk.startLine <= structure.endLine) ||
					(hunk.endLine >= structure.startLine && hunk.endLine <= structure.endLine)
				) {
					hunk.semanticGroup = structure.name;
					break;
				}
			}
		}

		return hunks;
	}

	/**
	 * Identify code structures in the content for semantic grouping
	 * @param originalContent Original file content
	 * @param modifiedContent Modified file content
	 * @returns Array of identified code structures
	 */
	private static identifyCodeStructures(
		originalContent: string,
		modifiedContent: string,
	): Array<{ name: string; startLine: number; endLine: number }> {
		const structures: Array<{ name: string; startLine: number; endLine: number }> = [];

		// Simple regex-based structure identification
		// Identify functions/methods
		const functionRegex =
			/\b(function|class|const|let|var|async|public|private|protected)\s+([a-zA-Z0-9_]+)\s*[({]/g;
		const lines = modifiedContent.split('\n');

		let match;
		let currentLine = 1;
		let inStructure = false;
		let structureStart = 0;
		let structureName = '';
		let braceCount = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check for structure start
			const lineMatch = functionRegex.exec(line);
			if (lineMatch && !inStructure) {
				inStructure = true;
				structureStart = i + 1;
				structureName = `${lineMatch[1]} ${lineMatch[2]}`;
				braceCount = 0;
			}

			// Count braces to track structure boundaries
			if (inStructure) {
				for (const char of line) {
					if (char === '{') braceCount++;
					if (char === '}') braceCount--;
				}

				// Structure end
				if (braceCount === 0 && structureStart > 0) {
					structures.push({
						name: structureName,
						startLine: structureStart,
						endLine: i + 1,
					});
					inStructure = false;
					structureStart = 0;
				}
			}

			currentLine++;
		}

		return structures;
	}

	/**
	 * Generate a FileChange object with hunks for a modified file
	 * @param filePath The path to the file
	 * @param originalContent The original file content
	 * @param modifiedContent The modified file content
	 * @returns A FileChange object with hunks
	 */
	static generateFileChange(filePath: string, originalContent: string, modifiedContent: string): FileChange {
		const hunks = this.generateHunks(originalContent, modifiedContent);

		return {
			path: filePath,
			content: modifiedContent,
			originalContent,
			hunks,
		};
	}

	/**
	 * Show a diff between two files in the VS Code diff editor
	 * @param originalContent The original file content
	 * @param modifiedContent The modified file content
	 * @param title The title for the diff editor
	 */
	static async showDiff(originalContent: string, modifiedContent: string, title: string): Promise<void> {
		// Create temporary files for the diff
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			throw new Error('No workspace folder found');
		}

		const tempDir = path.join(workspaceFolder.uri.fsPath, '.tribe-temp');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		const originalFile = path.join(tempDir, `original-${Date.now()}.txt`);
		const modifiedFile = path.join(tempDir, `modified-${Date.now()}.txt`);

		fs.writeFileSync(originalFile, originalContent, 'utf8');
		fs.writeFileSync(modifiedFile, modifiedContent, 'utf8');

		// Open diff view
		const originalUri = vscode.Uri.file(originalFile);
		const modifiedUri = vscode.Uri.file(modifiedFile);

		await vscode.commands.executeCommand('vscode.diff', originalUri, modifiedUri, title);
	}

	/**
	 * Get the current content of a file in the workspace
	 * @param filePath The path to the file, relative to the workspace root
	 * @returns The content of the file, or null if the file doesn't exist
	 */
	static getFileContent(filePath: string): string | null {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return null;
		}

		const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);

		if (!fs.existsSync(fullPath)) {
			return null;
		}

		return fs.readFileSync(fullPath, 'utf8');
	}

	/**
	 * Apply a file change to the workspace
	 * @param fileChange The file change to apply
	 * @returns True if the change was applied successfully, false otherwise
	 */
	static applyFileChange(fileChange: FileChange): boolean {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return false;
		}

		const fullPath = path.join(workspaceFolder.uri.fsPath, fileChange.path);
		const dirPath = path.dirname(fullPath);

		try {
			// Ensure directory exists
			if (!fs.existsSync(dirPath)) {
				fs.mkdirSync(dirPath, { recursive: true });
			}

			// Write file content
			fs.writeFileSync(fullPath, fileChange.content, 'utf8');

			return true;
		} catch (error) {
			console.error(`Error applying file change: ${error}`);
			return false;
		}
	}

	/**
	 * Delete a file from the workspace
	 * @param filePath The path to the file, relative to the workspace root
	 * @returns True if the file was deleted successfully, false otherwise
	 */
	static deleteFile(filePath: string): boolean {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return false;
		}

		const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);

		try {
			if (fs.existsSync(fullPath)) {
				fs.unlinkSync(fullPath);
				return true;
			}
			return false;
		} catch (error) {
			console.error(`Error deleting file: ${error}`);
			return false;
		}
	}

	/**
	 * Group related changes by feature or functionality
	 * @param changeGroups Array of change groups to analyze
	 * @returns Object mapping feature names to arrays of related file changes
	 */
	static groupChangesByFeature(changeGroups: any[]): Record<string, any[]> {
		const featureGroups: Record<string, any[]> = {};

		// Analyze change groups to identify related changes
		for (const group of changeGroups) {
			// Extract potential feature names from titles and descriptions
			const featureNames = this.extractFeatureNames(group.title, group.description);

			// If no feature names found, use a default group
			if (featureNames.length === 0) {
				if (!featureGroups['Uncategorized']) {
					featureGroups['Uncategorized'] = [];
				}
				featureGroups['Uncategorized'].push(group);
				continue;
			}

			// Add to each identified feature group
			for (const feature of featureNames) {
				if (!featureGroups[feature]) {
					featureGroups[feature] = [];
				}
				featureGroups[feature].push(group);
			}
		}

		return featureGroups;
	}

	/**
	 * Extract potential feature names from title and description
	 * @param title Change group title
	 * @param description Change group description
	 * @returns Array of potential feature names
	 */
	private static extractFeatureNames(title: string, description: string): string[] {
		const featureNames: string[] = [];

		// Common feature-related keywords
		const featureKeywords = [
			'feature',
			'functionality',
			'component',
			'module',
			'system',
			'service',
			'api',
			'endpoint',
			'interface',
			'ui',
			'ux',
		];

		// Extract potential feature names from title
		if (title) {
			for (const keyword of featureKeywords) {
				const regex = new RegExp(`(\\w+)\\s+${keyword}`, 'i');
				const match = title.match(regex);
				if (match && match[1]) {
					featureNames.push(`${match[1]} ${keyword}`);
				}
			}
		}

		// If no features found in title, try description
		if (featureNames.length === 0 && description) {
			for (const keyword of featureKeywords) {
				const regex = new RegExp(`(\\w+)\\s+${keyword}`, 'i');
				const match = description.match(regex);
				if (match && match[1]) {
					featureNames.push(`${match[1]} ${keyword}`);
				}
			}
		}

		// If still no features found, use the first part of the title as a feature name
		if (featureNames.length === 0 && title) {
			const words = title.split(' ');
			if (words.length >= 2) {
				featureNames.push(words.slice(0, 2).join(' '));
			} else if (words.length === 1) {
				featureNames.push(words[0]);
			}
		}

		return featureNames;
	}
}
