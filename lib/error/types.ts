export type ErrorSeverity = 'error' | 'warning' | 'info' | 'success';

export interface AppError {
  id: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, any>;
  dismissible?: boolean;
}

export interface ErrorContextType {
  errors: AppError[];
  addError: (message: string, severity?: ErrorSeverity, context?: Record<string, any>) => void;
  addSuccess: (message: string, context?: Record<string, any>) => void;
  addWarning: (message: string, context?: Record<string, any>) => void;
  addInfo: (message: string, context?: Record<string, any>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

export class ErrorHandler {
  static handleApiError(error: any, context?: Record<string, any>): AppError {
    let message = 'An unexpected error occurred';

    if (typeof error === 'string') {
      message = error;
    } else if (error?.error) {
      message = error.error;
    } else if (error?.message) {
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    return {
      id: crypto.randomUUID(),
      message,
      severity: 'error',
      timestamp: new Date(),
      context,
      dismissible: true,
    };
  }

  static handleNetworkError(context?: Record<string, any>): AppError {
    return {
      id: crypto.randomUUID(),
      message: 'Network error. Please check your connection and try again.',
      severity: 'error',
      timestamp: new Date(),
      context,
      dismissible: true,
    };
  }

  static handleValidationError(message: string, context?: Record<string, any>): AppError {
    return {
      id: crypto.randomUUID(),
      message,
      severity: 'warning',
      timestamp: new Date(),
      context,
      dismissible: true,
    };
  }

  static handleSuccess(message: string, context?: Record<string, any>): AppError {
    return {
      id: crypto.randomUUID(),
      message,
      severity: 'success',
      timestamp: new Date(),
      context,
      dismissible: true,
    };
  }
}