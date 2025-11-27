"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  ErrorContextType,
  AppError,
  ErrorHandler,
  ErrorSeverity,
} from "./types";
import { ToastContainer } from "@/components/ui/ToastContainer";

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([]);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((error) => error.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const addError = useCallback(
    (
      message: string,
      severity: ErrorSeverity = "error",
      context?: Record<string, any>
    ) => {
      const error: AppError = {
        id: crypto.randomUUID(),
        message,
        severity,
        timestamp: new Date(),
        context,
        dismissible: true,
      };

      setErrors((prev) => [...prev, error]);

      // Auto-dismiss success messages after 5 seconds
      if (severity === "success") {
        setTimeout(() => {
          removeError(error.id);
        }, 5000);
      }

      // Auto-dismiss info messages after 4 seconds
      if (severity === "info") {
        setTimeout(() => {
          removeError(error.id);
        }, 4000);
      }
    },
    [removeError]
  );

  const addSuccess = useCallback(
    (message: string, context?: Record<string, any>) => {
      addError(message, "success", context);
    },
    [addError]
  );

  const addWarning = useCallback(
    (message: string, context?: Record<string, any>) => {
      addError(message, "warning", context);
    },
    [addError]
  );

  const addInfo = useCallback(
    (message: string, context?: Record<string, any>) => {
      addError(message, "info", context);
    },
    [addError]
  );

  

  const value: ErrorContextType = {
    errors,
    addError,
    addSuccess,
    addWarning,
    addInfo,
    removeError,
    clearErrors,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
      <ToastContainer errors={errors} onDismiss={removeError} />
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error("useError must be used within an ErrorProvider");
  }
  return context;
}

// Utility hook for handling async operations with error handling
export function useAsyncError() {
  const { addError } = useError();

  const handleAsync = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      errorMessage?: string,
      context?: Record<string, any>
    ): Promise<T | null> => {
      try {
        return await asyncFn();
      } catch (error) {
        const appError = ErrorHandler.handleApiError(error, context);
        addError(
          errorMessage || appError.message,
          appError.severity,
          appError.context
        );
        return null;
      }
    },
    [addError]
  );

  return { handleAsync };
}
