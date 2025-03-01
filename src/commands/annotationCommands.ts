/* eslint-disable header/header */

import * as vscode from 'vscode';
import { StorageService } from '../services/storageService';
import { CreateAnnotationPayload, AddReplyPayload } from '../models/types';
import { errorWrapper } from '../errorHandling';
import { COMMANDS, API_ENDPOINTS } from '../config';

/**
 * Register annotation management commands
 * @param context Extension context
 */
export function registerAnnotationCommands(context: vscode.ExtensionContext): void {
	// Initialize services
	const storageService = StorageService.getInstance(context);

	// Register commands
	const commands = [
		vscode.commands.registerCommand(
			COMMANDS.CREATE_ANNOTATION,
			errorWrapper(
				async (payload: CreateAnnotationPayload): Promise<any> => {
					console.log('Creating annotation:', payload.content);

					try {
						// Create an annotation
						const annotation = {
							id: `annotation-${Date.now()}`,
							timestamp: new Date().toISOString(),
							filePath: payload.filePath,
							lineNumber: payload.lineNumber,
							content: payload.content,
							author: payload.author || 'User',
							replies: [],
							resolved: false,
							tags: payload.tags || [],
						};

						// Save the annotation
						await storageService.saveAnnotation(annotation);

						// Show a success message
						vscode.window.showInformationMessage(
							`Annotation created for ${payload.filePath}:${payload.lineNumber}`,
						);

						return {
							annotation,
							success: true,
						};
					} catch (error) {
						console.error('Error creating annotation:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'CREATE_ANNOTATION',
				'Create an annotation for a specific line in a file',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.GET_ANNOTATIONS,
			errorWrapper(
				async (filePath?: string): Promise<any[]> => {
					// Get all annotations from storage
					const annotations = await storageService.getAnnotations();

					// If filePath is provided, filter annotations for that file
					if (filePath) {
						return annotations.filter((a) => a.filePath === filePath);
					}

					return annotations;
				},
				'GET_ANNOTATIONS',
				'Get all annotations or annotations for a specific file',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.DELETE_ANNOTATION,
			errorWrapper(
				async (annotationId: string): Promise<boolean> => {
					console.log(`Deleting annotation: ${annotationId}`);

					// Delete the annotation from storage
					await storageService.deleteAnnotation(annotationId);

					// Show a success message
					vscode.window.showInformationMessage(`Annotation ${annotationId} deleted`);

					return true;
				},
				'DELETE_ANNOTATION',
				'Delete an annotation',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.RESOLVE_ANNOTATION,
			errorWrapper(
				async (annotationId: string): Promise<boolean> => {
					console.log(`Resolving annotation: ${annotationId}`);

					try {
						// Get all annotations
						const annotations = await storageService.getAnnotations();

						// Find the annotation to resolve
						const annotationIndex = annotations.findIndex((a) => a.id === annotationId);

						if (annotationIndex === -1) {
							throw new Error(`Annotation ${annotationId} not found`);
						}

						// Mark the annotation as resolved
						annotations[annotationIndex].resolved = true;

						// Save the updated annotation
						await storageService.saveAnnotation(annotations[annotationIndex]);

						// Show a success message
						vscode.window.showInformationMessage(`Annotation ${annotationId} resolved`);

						return true;
					} catch (error) {
						console.error(`Error resolving annotation: ${error}`);
						vscode.window.showErrorMessage(`Failed to resolve annotation: ${error}`);
						return false;
					}
				},
				'RESOLVE_ANNOTATION',
				'Mark an annotation as resolved',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.ADD_REPLY,
			errorWrapper(
				async (payload: AddReplyPayload): Promise<any> => {
					console.log(`Adding reply to annotation: ${payload.parentId}`);

					try {
						// Add reply to the annotation
						await storageService.addReplyToAnnotation(payload.parentId, {
							id: `reply-${Date.now()}`,
							timestamp: new Date().toISOString(),
							content: payload.content,
							author: payload.author || 'User',
						});

						// Show a success message
						vscode.window.showInformationMessage(`Reply added to annotation ${payload.parentId}`);

						return {
							success: true,
						};
					} catch (error) {
						console.error('Error adding reply:', error);
						return {
							error: error instanceof Error ? error.message : String(error),
							success: false,
						};
					}
				},
				'ADD_REPLY',
				'Add a reply to an annotation',
			),
		),

		vscode.commands.registerCommand(
			COMMANDS.SHOW_ANNOTATIONS_IN_FILE,
			errorWrapper(
				async (): Promise<void> => {
					// Get the active text editor
					const editor = vscode.window.activeTextEditor;

					if (!editor) {
						vscode.window.showWarningMessage('No active editor found');
						return;
					}

					const filePath = editor.document.uri.fsPath;

					// Get annotations for this file
					const annotations = (await vscode.commands.executeCommand(
						COMMANDS.GET_ANNOTATIONS,
						filePath,
					)) as any[];

					if (annotations.length === 0) {
						vscode.window.showInformationMessage('No annotations found for this file');
						return;
					}

					// Create decorations for annotations
					const decorationType = vscode.window.createTextEditorDecorationType({
						backgroundColor: 'rgba(255, 220, 0, 0.2)',
						isWholeLine: true,
						after: {
							contentText: '💬',
							margin: '0 0 0 1em',
						},
					});

					// Apply decorations
					const decorations = annotations.map((a) => {
						const line = a.lineNumber;
						const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));
						return { range };
					});

					editor.setDecorations(decorationType, decorations);

					// Show a message with the count
					vscode.window.showInformationMessage(`Found ${annotations.length} annotations in this file`);
				},
				'SHOW_ANNOTATIONS_IN_FILE',
				'Show annotations in the current file',
			),
		),
	];

	// Add commands to context subscriptions
	context.subscriptions.push(...commands);
}
