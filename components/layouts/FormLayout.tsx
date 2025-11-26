"use client";

import React from 'react';

export interface FormLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  success?: string | null;
  className?: string;
  maxWidth?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }>;
}

export default function FormLayout({
  children,
  title,
  subtitle,
  onSubmit,
  submitLabel = 'Submit',
  submitDisabled = false,
  cancelLabel = 'Cancel',
  onCancel,
  isLoading = false,
  error,
  success,
  className = '',
  maxWidth = 'max-w-2xl',
  actions,
}: FormLayoutProps) {


  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 py-8 ${className}`}>
      <div className={`mx-auto ${maxWidth} px-4 sm:px-6 lg:px-8`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-8 sm:px-8">
            {/* Header */}
            {(title || subtitle || actions) && (
              <div className="pt-4 mb-8">
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div className="flex items-center space-x-4">
                      <div>
                        {title && (
                          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                            {title}
                          </h1>
                        )}
                      </div>
                    </div>
                    {actions && actions.length > 0 && (
                      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
                        {actions.map((action, index) => {
                          const buttonClasses = action.variant === 'primary'
                            ? 'px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors'
                            : 'px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors';

                          return (
                            <button
                              key={index}
                              onClick={action.onClick}
                              className={buttonClasses}
                            >
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {subtitle && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    {success}
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}