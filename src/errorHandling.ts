export enum ErrorSeverity {
	INFO = 'INFO',
	WARNING = 'WARNING',
	ERROR = 'ERROR',
	CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
	UI = 'UI',
	NETWORK = 'NETWORK',
	AGENT = 'AGENT',
	MODEL = 'MODEL',
	SYSTEM = 'SYSTEM',
	EXTENSION = 'EXTENSION'
}

export interface ExtensionError extends Error {
	severity: ErrorSeverity;
	category: ErrorCategory;
	code: string;
	details?: any;
	timestamp: string;
	userFriendlyMessage?: string;
	retryable?: boolean;
}

export class ExtensionErrorHandler {
	private static instance: ExtensionErrorHandler;
	private errorListeners: ((error: ExtensionError) => void)[] = [];
	private errorHistory: ExtensionError[] = [];
	private readonly MAX_HISTORY_SIZE = 50;

	private constructor() {}

	public static getInstance(): ExtensionErrorHandler {
		if (!ExtensionErrorHandler.instance) {
			ExtensionErrorHandler.instance = new ExtensionErrorHandler();
		}
		return ExtensionErrorHandler.instance;
	}

	public addErrorListener(listener: (error: ExtensionError) => void): void {
		this.errorListeners.push(listener);
	}

	public removeErrorListener(listener: (error: ExtensionError) => void): void {
		const index = this.errorListeners.indexOf(listener);
		if (index !== -1) {
			this.errorListeners.splice(index, 1);
		}
	}

	public handleError(error: Error | ExtensionError, context?: string): void {
		const extensionError = this.normalizeError(error, context);
		this.addToHistory(extensionError);
		this.notifyListeners(extensionError);
		this.logError(extensionError);
	}
	
	public getErrorHistory(): ExtensionError[] {
		return [...this.errorHistory];
	}
	
	public clearErrorHistory(): void {
		this.errorHistory = [];
	}
	
	private addToHistory(error: ExtensionError): void {
		this.errorHistory.unshift(error);
		if (this.errorHistory.length > this.MAX_HISTORY_SIZE) {
			this.errorHistory.pop();
		}
	}

	private normalizeError(error: Error | ExtensionError, context?: string): ExtensionError {
		if (this.isExtensionError(error)) {
			return error;
		}

		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			severity: ErrorSeverity.ERROR,
			category: ErrorCategory.SYSTEM,
			code: 'UNKNOWN_ERROR',
			details: { context },
			timestamp: new Date().toISOString(),
			userFriendlyMessage: 'An unexpected error occurred. Please try again.',
			retryable: true
		};
	}

	private isExtensionError(error: any): error is ExtensionError {
		return 'severity' in error && 'code' in error;
	}

	private notifyListeners(error: ExtensionError): void {
		this.errorListeners.forEach((listener) => {
			try {
				listener(error);
			} catch (listenerError) {
				console.error('Error in error listener:', listenerError);
			}
		});
	}

	private logError(error: ExtensionError): void {
		console.error(`[${error.severity}][${error.code}] ${error.message}`, {
			timestamp: error.timestamp,
			details: error.details,
			stack: error.stack,
		});
	}
}

export function createError(
	message: string,
	code: string,
	severity: ErrorSeverity = ErrorSeverity.ERROR,
	category: ErrorCategory = ErrorCategory.SYSTEM,
	details?: any,
	userFriendlyMessage?: string,
	retryable: boolean = false
): ExtensionError {
	return {
		name: 'ExtensionError',
		message,
		severity,
		category,
		code,
		details,
		timestamp: new Date().toISOString(),
		stack: new Error().stack,
		userFriendlyMessage,
		retryable
	};
}

export function errorWrapper<T>(
	fn: (...args: any[]) => Promise<T> | T,
	errorCode: string,
	category: ErrorCategory = ErrorCategory.SYSTEM,
	context?: string,
	userFriendlyMessage?: string,
	retryable: boolean = false,
	maxRetries: number = 3
): (...args: any[]) => Promise<T> | T {
	// Check if the function is async (returns a Promise)
	const isAsync = fn.constructor.name === 'AsyncFunction' || fn.toString().includes('Promise');

	if (isAsync) {
		return async (...args: any[]): Promise<T> => {
			let retries = 0;
			
			const executeWithRetry = async (): Promise<T> => {
				try {
					return await (fn(...args) as Promise<T>);
				} catch (error) {
					const handler = ExtensionErrorHandler.getInstance();
					let extensionError: ExtensionError;
					
					if (error instanceof Error) {
						extensionError = createError(
							error.message, 
							errorCode, 
							ErrorSeverity.ERROR,
							category,
							{ context, originalError: error },
							userFriendlyMessage || 'An error occurred',
							retryable
						);
					} else {
						extensionError = createError(
							'An unknown error occurred', 
							errorCode, 
							ErrorSeverity.ERROR,
							category,
							{ context, originalError: error },
							userFriendlyMessage || 'An unknown error occurred',
							retryable
						);
					}
					
					handler.handleError(extensionError);
					
					// Check if we should retry
					if (retryable && retries < maxRetries) {
						retries++;
						console.log(`Retrying operation (${retries}/${maxRetries})...`);
						// Exponential backoff: 1s, 2s, 4s, etc.
						await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
						return executeWithRetry();
					}
					
					throw error;
				}
			};
			
			return executeWithRetry();
		};
	} else {
		// Handle synchronous functions - these don't support retry
		return (...args: any[]): T => {
			try {
				return fn(...args) as T;
			} catch (error) {
				const handler = ExtensionErrorHandler.getInstance();
				let extensionError: ExtensionError;
				
				if (error instanceof Error) {
					extensionError = createError(
						error.message, 
						errorCode, 
						ErrorSeverity.ERROR,
						category,
						{ context, originalError: error },
						userFriendlyMessage || 'An error occurred',
						false // Sync functions can't retry
					);
				} else {
					extensionError = createError(
						'An unknown error occurred', 
						errorCode, 
						ErrorSeverity.ERROR,
						category,
						{ context, originalError: error },
						userFriendlyMessage || 'An unknown error occurred',
						false // Sync functions can't retry
					);
				}
				
				handler.handleError(extensionError);
				throw error;
			}
		};
	}
}
