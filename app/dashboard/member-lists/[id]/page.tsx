"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data";

interface Member {
  id: string;
  lot?: string;
  name?: string;
  email?: string;
  address?: string;
}

interface MemberListDetail {
  id: string;
  name: string;
  createdAt: string;
  members: Member[];
}

export default function MemberListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const router = useRouter();
  const [list, setList] = useState<MemberListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Member>({
    id: "",
    lot: "",
    name: "",
    email: "",
    address: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newMember, setNewMember] = useState<Member>({
    id: "",
    lot: "",
    name: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await params;
      if (!active) return;
      setId(p.id);
    })();
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    const fetchList = async () => {
      if (!id) return;
      try {
        const res = await fetch(`/api/member-lists/${id}`);
        if (!res.ok) {
          console.error("Failed to fetch list");
          router.back();
          return;
        }
        const data = await res.json();
        setList(data);
      } catch (err) {
        console.error(err);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [id]);

  const startEdit = (member: Member) => {
    setEditingId(member.id);
    setEditingMember({ ...member });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingMember({ id: "", lot: "", name: "", email: "", address: "" });
  };

  const startAdd = () => {
    setIsAdding(true);
    setNewMember({ id: "", lot: "", name: "", email: "", address: "" });
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setNewMember({ id: "", lot: "", name: "", email: "", address: "" });
  };

  const saveAdd = async () => {
    if (!list) return;

    // Validate required fields
    if (!newMember.lot || !newMember.name || !newMember.email) {
      alert("Lot, name, and email are required");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMember.email)) {
      alert("Please enter a valid email address");
      return;
    }

    try {
      const res = await fetch(`/api/member-lists/${list.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot: newMember.lot,
          name: newMember.name,
          email: newMember.email,
          address: newMember.address,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error adding member: ${error.error}`);
        return;
      }

      const addedMember = await res.json();
      setList({
        ...list,
        members: [...list.members, addedMember],
      });
      cancelAdd();
    } catch (error) {
      console.error("Failed to add member:", error);
      alert("Failed to add member");
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!list) return;
    if (!window.confirm("Are you sure you want to delete this member?")) return;

    try {
      const res = await fetch(
        `/api/member-lists/${list.id}/members/${memberId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        alert(`Error deleting member: ${error.error}`);
        return;
      }

      setList({
        ...list,
        members: list.members.filter((m) => m.id !== memberId),
      });
    } catch (error) {
      console.error("Failed to delete member:", error);
      alert("Failed to delete member");
    }
  };

  const saveEdit = async () => {
    if (!editingId || !list) return;

    // Validate email format
    if (editingMember.email && editingMember.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editingMember.email)) {
        alert("Please enter a valid email address");
        return;
      }
    }

    try {
      const res = await fetch(
        `/api/member-lists/${list.id}/members/${editingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lot: editingMember.lot,
            name: editingMember.name,
            email: editingMember.email,
            address: editingMember.address,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        alert(`Error updating member: ${error.error}`);
        return;
      }

      const updatedMember = await res.json();
      setList({
        ...list,
        members: list.members.map((m) =>
          m.id === editingId ? updatedMember : m
        ),
      });
      cancelEdit();
    } catch (error) {
      console.error("Failed to update member:", error);
      alert("Failed to update member");
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (!list) return <div className="text-center py-8">List not found</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {list.name}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={startAdd}
            disabled={isAdding}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            ➕ Add Member
          </button>
          <button
            onClick={() => router.push("/dashboard/member-lists")}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            ← Back
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Lot
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Name
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Email
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Address
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900">
                <td className="px-6 py-4">
                  <input
                    type="text"
                    placeholder="Lot Number *"
                    value={newMember.lot || ""}
                    onChange={(e) =>
                      setNewMember({ ...newMember, lot: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newMember.name || ""}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="email"
                    placeholder="Email *"
                    value={newMember.email || ""}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="text"
                    placeholder="Address"
                    value={newMember.address || ""}
                    onChange={(e) =>
                      setNewMember({ ...newMember, address: e.target.value })
                    }
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2 justify-center items-center">
                    <button
                      onClick={saveAdd}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelAdd}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {list.members.map((m) => (
              <tr
                key={m.id}
                className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <td className="px-6 py-4 text-gray-900 dark:text-white">
                  {editingId === m.id ? (
                    <input
                      type="text"
                      value={editingMember.lot || ""}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          lot: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  ) : (
                    m.lot
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                  {editingId === m.id ? (
                    <input
                      type="text"
                      value={editingMember.name || ""}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  ) : (
                    m.name
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                  {editingId === m.id ? (
                    <input
                      type="email"
                      value={editingMember.email || ""}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  ) : (
                    m.email
                  )}
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                  {editingId === m.id ? (
                    <input
                      type="text"
                      value={editingMember.address || ""}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          address: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  ) : (
                    m.address
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2 justify-center items-center">
                    {editingId === m.id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(m)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMember(m.id)}
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
    </div>
  );
}
