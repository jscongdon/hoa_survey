"use client";

import React from 'react';
import Link from 'next/link';

export interface ActionButton {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ActionButton[];
  className?: string;
  maxWidth?: string;
  padding?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export default function PageLayout({
  children,
  title,
  subtitle,
  actions,
  className = '',
  maxWidth = 'max-w-7xl',
  padding = 'p-6',
  showBackButton = false,
  onBack,
  breadcrumbs,
}: PageLayoutProps) {
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
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
                      const buttonClasses = action.variant === 'primary'
                        ? 'px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        : 'px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

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

        {/* Main Content */}
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow ${padding}`}>
          {children}
        </div>
      </div>
    </div>
  );
}