"use client";

import React, { useState } from "react";
import { ListLayout } from "@/components/layouts";

interface TestItem {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
}

export default function TestListLayout() {
  const [items, setItems] = useState<TestItem[]>([
    { id: "1", name: "Item 1", status: "active", createdAt: "2024-01-01" },
    { id: "2", name: "Item 2", status: "inactive", createdAt: "2024-01-02" },
    { id: "3", name: "Item 3", status: "active", createdAt: "2024-01-03" },
  ]);
  const [loading, setLoading] = useState(false);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleToggleStatus = (id: string) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, status: item.status === "active" ? "inactive" : "active" }
        : item
    ));
  };

  const actions = [
    {
      label: "Add Item",
      onClick: () => {
        const newItem: TestItem = {
          id: Date.now().toString(),
          name: `Item ${items.length + 1}`,
          status: "active",
          createdAt: new Date().toISOString().split('T')[0],
        };
        setItems([...items, newItem]);
      },
      variant: "primary" as const,
    },
    {
      label: "Refresh",
      onClick: () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 1000);
      },
      variant: "secondary" as const,
    },
  ];

  return (
    <ListLayout
      title="Test List"
      subtitle="Demonstrating the ListLayout component with sample data"
      actions={actions}
      isLoading={loading}
      isEmpty={items.length === 0}
      emptyMessage="No items found. Click 'Add Item' to create one."
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {item.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleToggleStatus(item.id)}
                    className={`px-3 py-1 rounded text-xs font-semibold ${
                      item.status === "active"
                        ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {item.status}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {item.createdAt}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ListLayout>
  );
}