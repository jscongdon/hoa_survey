"use client";

import React from "react";

export interface DashboardCard {
  id: string;
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export interface DashboardLayoutProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  cards?: DashboardCard[];
  className?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

function DashboardCard({ card }: { card: DashboardCard }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 ${card.className || ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            {card.icon && <div className="flex-shrink-0">{card.icon}</div>}
            <div className={card.icon ? "ml-4" : ""}>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {card.title}
              </p>
              {card.value !== undefined && (
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {card.value}
                </p>
              )}
              {card.subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {card.subtitle}
                </p>
              )}
              {card.trend && (
                <div className="flex items-center mt-2">
                  <span
                    className={`text-sm font-medium ${
                      card.trend.isPositive
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {card.trend.isPositive ? "+" : ""}
                    {card.trend.value}%
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    {card.trend.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {card.action && (
          <div className="ml-4">
            <button
              onClick={card.action.onClick}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {card.action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  actions,
  cards = [],
  className = "",
  showBackButton = false,
  onBack,
  breadcrumbs,
}: DashboardLayoutProps) {
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
          <div className="mb-8">
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
                  {subtitle && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {actions && (
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard Cards */}
        {cards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {cards.map((card) => (
              <DashboardCard key={card.id} card={card} />
            ))}
          </div>
        )}

        {/* Main Content */}
        {children && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}
