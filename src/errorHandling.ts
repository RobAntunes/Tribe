export enum ErrorSeverity {
	INFO = 'INFO',
	WARNING = 'WARNING',
	ERROR = 'ERROR',
	CRITICAL = 'CRITICAL',
}

export interface ExtensionError extends Error {
	severity: ErrorSeverity;
	code: string;
	details?: any;
	timestamp: string;
}

export class ExtensionErrorHandler {
	private static instance: ExtensionErrorHandler;
	private errorListeners: ((error: ExtensionError) => void)[] = [];

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

	public handleError(error: Error | ExtensionError, context?: string): void {
		const extensionError = this.normalizeError(error, context);
		this.notifyListeners(extensionError);
		this.logError(extensionError);
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
			code: 'UNKNOWN_ERROR',
			details: { context },
			timestamp: new Date().toISOString(),
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
	details?: any,
): ExtensionError {
	return {
		name: 'ExtensionError',
		message,
		severity,
		code,
		details,
		timestamp: new Date().toISOString(),
		stack: new Error().stack,
	};
}

export function errorWrapper<T>(
	fn: (...args: any[]) => Promise<T> | T,
	errorCode: string,
	context?: string,
): (...args: any[]) => Promise<T> | T {
	// Check if the function is async (returns a Promise)
	const isAsync = fn.constructor.name === 'AsyncFunction' || fn.toString().includes('Promise');

	if (isAsync) {
		return async (...args: any[]): Promise<T> => {
			try {
				return await (fn(...args) as Promise<T>);
			} catch (error) {
				const handler = ExtensionErrorHandler.getInstance();
				if (error instanceof Error) {
					handler.handleError(
						createError(error.message, errorCode, ErrorSeverity.ERROR, { context, originalError: error }),
					);
				} else {
					handler.handleError(
						createError('An unknown error occurred', errorCode, ErrorSeverity.ERROR, {
							context,
							originalError: error,
						}),
					);
				}
				throw error;
			}
		};
	} else {
		// Handle synchronous functions
		return (...args: any[]): T => {
			try {
				return fn(...args) as T;
			} catch (error) {
				const handler = ExtensionErrorHandler.getInstance();
				if (error instanceof Error) {
					handler.handleError(
						createError(error.message, errorCode, ErrorSeverity.ERROR, { context, originalError: error }),
					);
				} else {
					handler.handleError(
						createError('An unknown error occurred', errorCode, ErrorSeverity.ERROR, {
							context,
							originalError: error,
						}),
					);
				}
				throw error;
			}
		};
	}
}
