"use client";

import React from "react";
import Link from "next/link";

export interface ActionButton {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export interface ListLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ActionButton[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function ListLayout({
  children,
  title,
  subtitle,
  actions,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No items found",
  emptyAction,
  className = "",
  showBackButton = false,
  onBack,
  breadcrumbs,
}: ListLayoutProps) {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex mb-4" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && (
                    <svg
                      className="w-4 h-4 mx-2 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-900 dark:text-white font-medium">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Header Section */}
        {(title || subtitle || actions || showBackButton) && (
          <div className="pt-4 mb-8">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-4">
                  {showBackButton && onBack && (
                    <button
                      onClick={onBack}
                      className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      aria-label="Go back"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      <span className="hidden sm:inline">Back</span>
                    </button>
                  )}
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
                      const buttonClasses =
                        action.variant === "primary"
                          ? "px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          : "px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

                      if (action.href) {
                        return (
                          <Link key={index} href={action.href}>
                            <button
                              className={buttonClasses}
                              disabled={action.disabled}
                            >
                              {action.label}
                            </button>
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={index}
                          onClick={action.onClick}
                          className={buttonClasses}
                          disabled={action.disabled}
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

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg
                  className="animate-spin h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-gray-600 dark:text-gray-400">
                  Loading...
                </span>
              </div>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 px-6">
              <svg
                className="w-12 h-12 text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {emptyMessage}
              </h3>
              {emptyAction && <div className="mt-4">{emptyAction}</div>}
            </div>
          ) : (
            <div className="p-6">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
