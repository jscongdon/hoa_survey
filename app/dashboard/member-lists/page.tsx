"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dateFormatter";
import { ListLayout } from "@/components/layouts";
import { useMemberLists } from "@/lib/hooks";
import { FormField, Input, FileInput } from "@/components/forms";
import { DataTable, Column } from "@/components/data";

export default function MemberListsPage() {
  const router = useRouter();
  const {
    lists,
    loading,
    showUpload,
    newListName,
    csvFile,
    uploading,
    editingId,
    editingName,
    setShowUpload,
    setNewListName,
    setCsvFile,
    setEditingName,
    handleUpload,
    handleDelete,
    handleEditStart,
    handleEditSave,
    handleEditCancel,
  } = useMemberLists();

  if (loading) {
    return (
      <ListLayout
        title="Member Lists"
        subtitle="Manage member lists for surveys"
        isLoading={true}
      >
        <div />
      </ListLayout>
    );
  }

  const actions = [
    {
      label: showUpload ? "Cancel" : "Create New List",
      onClick: () => setShowUpload(!showUpload),
      variant: "primary" as const,
    },
    {
      label: "Back to Settings",
      href: "/dashboard/settings",
      variant: "secondary" as const,
    },
  ];

  return (
    <ListLayout
      title="Member Lists"
      subtitle="Manage member lists for surveys"
      actions={actions}
      isLoading={loading}
      isEmpty={lists.length === 0 && !showUpload}
      emptyMessage="No member lists yet. Create your first list to get started."
    >
      {showUpload && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Create New Member List
          </h2>
          <form onSubmit={handleUpload}>
            <FormField label="List Name" required className="mb-4">
              <Input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Active Members 2025"
              />
            </FormField>

            <FormField
              label="CSV File (Optional - can add members later)"
              help="CSV should have columns: lot, name, email, address (optional). You can create an empty list and add members manually later."
              className="mb-4"
            >
              <FileInput
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              />
            </FormField>

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50"
            >
              {uploading ? "Creating..." : "Create List"}
            </button>
          </form>
        </div>
      )}

      {lists.length > 0 && (
        <DataTable
          data={lists}
          keyField="id"
          columns={[
            {
              key: "name",
              header: "Name",
              render: (value, list) =>
                editingId === list.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium">{value}</span>
                ),
            },
            {
              key: "members",
              header: "Members",
              className: "text-center",
              render: (value, list) => (
                <span className="text-gray-600 dark:text-gray-400">
                  {list._count.members}
                </span>
              ),
            },
            {
              key: "surveys",
              header: "Surveys",
              className: "text-center",
              render: (value, list) => (
                <span className="text-gray-600 dark:text-gray-400">
                  {list._count.surveys}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Created",
              className: "text-center",
              render: (value) => (
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {formatDate(value)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              render: (value, list) => (
                <div className="flex gap-3 justify-center items-center">
                  {editingId === list.id ? (
                    <>
                      <button
                        onClick={() => handleEditSave(list.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleEditCancel}
                        className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() =>
                          router.push(`/dashboard/member-lists/${list.id}`)
                        }
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditStart(list.id, list.name)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(list.id, list.name)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </ListLayout>
  );
}
