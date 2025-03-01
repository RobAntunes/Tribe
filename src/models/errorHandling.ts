/* eslint-disable header/header */

import * as vscode from 'vscode';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	INFO = 'info',
	WARNING = 'warning',
	ERROR = 'error',
	CRITICAL = 'critical',
}

/**
 * Extension error interface
 */
export interface ExtensionError {
	code: string;
	message: string;
	details?: any;
	severity: ErrorSeverity;
	timestamp: Date;
}

/**
 * Error listener function type
 */
export type ErrorListener = (error: ExtensionError) => void;

/**
 * Extension error handler class
 */
export class ExtensionErrorHandler {
	private static instance: ExtensionErrorHandler;
	private listeners: ErrorListener[] = [];
	private errorLog: ExtensionError[] = [];
	private outputChannel: vscode.OutputChannel | null = null;

	private constructor() {}

	/**
	 * Get the singleton instance of the error handler
	 */
	public static getInstance(): ExtensionErrorHandler {
		if (!ExtensionErrorHandler.instance) {
			ExtensionErrorHandler.instance = new ExtensionErrorHandler();
		}
		return ExtensionErrorHandler.instance;
	}

	/**
	 * Initialize the error handler with the extension context
	 * @param context Extension context
	 */
	public init(context: vscode.ExtensionContext): void {
		this.outputChannel = vscode.window.createOutputChannel('Tribe Error Log');
		context.subscriptions.push(this.outputChannel);
	}

	/**
	 * Add an error listener
	 * @param listener Error listener function
	 */
	public addErrorListener(listener: ErrorListener): void {
		this.listeners.push(listener);
	}

	/**
	 * Remove an error listener
	 * @param listener Error listener function to remove
	 */
	public removeErrorListener(listener: ErrorListener): void {
		this.listeners = this.listeners.filter((l) => l !== listener);
	}

	/**
	 * Handle an error
	 * @param error Extension error
	 */
	public handleError(error: ExtensionError): void {
		// Add to error log
		this.errorLog.push(error);

		// Log to output channel
		if (this.outputChannel) {
			this.outputChannel.appendLine(
				`[${error.timestamp.toISOString()}] [${error.severity}] [${error.code}] ${error.message}`,
			);
			if (error.details) {
				this.outputChannel.appendLine(`Details: ${JSON.stringify(error.details, null, 2)}`);
			}
		}

		// Notify listeners
		this.listeners.forEach((listener) => {
			try {
				listener(error);
			} catch (e) {
				console.error('Error in error listener:', e);
			}
		});

		// Show notification based on severity
		switch (error.severity) {
			case ErrorSeverity.INFO:
				vscode.window.showInformationMessage(`[${error.code}] ${error.message}`);
				break;
			case ErrorSeverity.WARNING:
				vscode.window.showWarningMessage(`[${error.code}] ${error.message}`);
				break;
			case ErrorSeverity.ERROR:
			case ErrorSeverity.CRITICAL:
				vscode.window.showErrorMessage(`[${error.code}] ${error.message}`);
				break;
		}
	}

	/**
	 * Get the error log
	 */
	public getErrorLog(): ExtensionError[] {
		return [...this.errorLog];
	}

	/**
	 * Clear the error log
	 */
	public clearErrorLog(): void {
		this.errorLog = [];
	}
}

/**
 * Create an extension error
 * @param code Error code
 * @param message Error message
 * @param severity Error severity
 * @param details Additional error details
 */
export function createError(
	code: string,
	message: string,
	severity: ErrorSeverity = ErrorSeverity.ERROR,
	details?: any,
): ExtensionError {
	return {
		code,
		message,
		details,
		severity,
		timestamp: new Date(),
	};
}

/**
 * Error wrapper for async functions
 * @param fn Function to wrap
 * @param code Error code prefix
 * @param description Function description
 */
export function errorWrapper<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	code: string,
	description: string,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
	return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
		try {
			return await fn(...args);
		} catch (error) {
			const errorHandler = ExtensionErrorHandler.getInstance();
			const extensionError = createError(
				`${code}_ERROR`,
				`Error in ${description}: ${error instanceof Error ? error.message : String(error)}`,
				ErrorSeverity.ERROR,
				{
					originalError: error,
					functionName: fn.name,
					arguments: args,
				},
			);
			errorHandler.handleError(extensionError);
			throw error;
		}
	};
}
