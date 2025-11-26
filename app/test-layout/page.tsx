"use client";

import React from "react";
import { PageLayout } from "@/components/layouts";

export default function TestPageLayout() {
  return (
    <PageLayout
      title="Test Page"
      subtitle="This is a test page demonstrating the PageLayout component"
      actions={[
        {
          label: "Action 1",
          onClick: () => alert("Action 1 clicked"),
          variant: "primary",
        },
        {
          label: "Action 2",
          href: "/dashboard",
          variant: "secondary",
        },
      ]}
    >
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">
          This is the content area of the page. The PageLayout component provides
          consistent styling and responsive behavior across all pages.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Features
          </h3>
          <ul className="list-disc list-inside text-blue-800 dark:text-blue-200 space-y-1">
            <li>Responsive design that works on all screen sizes</li>
            <li>Consistent header with title, subtitle, and actions</li>
            <li>Dark mode support</li>
            <li>TypeScript interfaces for type safety</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 dark:text-green-100">Column 1</h4>
            <p className="text-green-800 dark:text-green-200 text-sm mt-1">
              Content in the first column
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-900 dark:text-purple-100">Column 2</h4>
            <p className="text-purple-800 dark:text-purple-200 text-sm mt-1">
              Content in the second column
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}