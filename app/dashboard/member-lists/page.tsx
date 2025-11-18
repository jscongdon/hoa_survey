 'use client';

import React, { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/dateFormatter';

interface MemberList {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    members: number;
    surveys: number;
  };
}

export default function MemberListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<MemberList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const fetchLists = async () => {
      try {
        const res = await fetch('/api/member-lists');
        const data = await res.json();
        if (!res.ok) {
          console.error('Failed to fetch member lists:', data);
          setLists([]);
        } else if (Array.isArray(data)) {
          setLists(data);
        } else {
          setLists([]);
        }
      } catch (error) {
        console.error('Failed to fetch member lists:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLists();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) {
      alert('Please enter a list name');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', newListName);
      if (csvFile) {
        formData.append('csv', csvFile);
      }

      const res = await fetch('/api/member-lists', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error creating list: ${error.error}`);
        return;
      }

      const newList = await res.json();
      if (newList && newList.id) {
        // Ensure the list has the expected structure
        const listWithDefaults = {
          ...newList,
          _count: newList._count || { members: newList.members?.length || 0, surveys: 0 }
        };
        setLists([listWithDefaults, ...lists]);
        setNewListName('');
        setCsvFile(null);
        setShowUpload(false);
      } else {
        alert('Unexpected response from server');
        console.error('Invalid response:', newList);
      }
    } catch (error) {
      console.error('Failed to upload member list:', error);
      alert('Failed to upload member list');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/member-lists/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error deleting list: ${error.error}`);
        return;
      }

      setLists(lists.filter((l) => l.id !== id));
    } catch (error) {
      console.error('Failed to delete member list:', error);
      alert('Failed to delete member list');
    }
  };

  const handleEditStart = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleEditSave = async (id: string) => {
    if (!editingName.trim()) {
      alert('List name cannot be empty');
      return;
    }

    try {
      const res = await fetch(`/api/member-lists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error updating list: ${error.error}`);
        return;
      }

      const updatedList = await res.json();
      setLists(lists.map((l) => (l.id === id ? { ...l, name: updatedList.name } : l)));
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update member list:', error);
      alert('Failed to update member list');
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Member Lists" actions={(
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
        >
          {showUpload ? 'Cancel' : '+ Create New List'}
        </button>
      )} />

      {showUpload && (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create New Member List</h2>
          <form onSubmit={handleUpload}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                List Name *
              </label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Active Members 2025"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                CSV File (Optional - can add members later)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                CSV should have columns: lot, name, email, address (optional). You can create an empty list and add members manually later.
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50"
            >
              {uploading ? 'Creating...' : 'Create List'}
            </button>
          </form>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No member lists yet. Create your first list to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Name
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Members
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Surveys
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Created
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr
                  key={list.id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                    {editingId === list.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        autoFocus
                      />
                    ) : (
                      list.name
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    {list._count.members}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">
                    {list._count.surveys}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400 text-sm">
                    {formatDate(list.createdAt)}
                  </td>
                  <td className="px-6 py-4">
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
                            onClick={() => router.push(`/dashboard/member-lists/${list.id}`)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <Link href="/dashboard">
          <button className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium">
            ← Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
