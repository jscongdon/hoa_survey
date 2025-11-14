'use client';

import ThemeToggle from './ThemeToggle';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} HOA Survey System
          </div>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
