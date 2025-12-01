"use client";

import { useState, useEffect } from "react";
import { useError } from "@/lib/error/ErrorContext";

export interface MemberList {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    members: number;
    surveys: number;
  };
}

export interface UseMemberListsReturn {
  lists: MemberList[];
  loading: boolean;
  showUpload: boolean;
  newListName: string;
  csvFile: File | null;
  uploading: boolean;
  editingId: string | null;
  editingName: string;
  setShowUpload: (show: boolean) => void;
  setNewListName: (name: string) => void;
  setCsvFile: (file: File | null) => void;
  setEditingName: (name: string) => void;
  handleUpload: (e: React.FormEvent) => Promise<void>;
  handleDelete: (id: string, name: string) => Promise<void>;
  handleEditStart: (id: string, currentName: string) => void;
  handleEditSave: (id: string) => Promise<void>;
  handleEditCancel: () => void;
  refetchLists: () => Promise<void>;
}

export function useMemberLists(): UseMemberListsReturn {
  const { addError } = useError();
  const [lists, setLists] = useState<MemberList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchLists = async () => {
    try {
      const res = await fetch("/api/member-lists");
      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to fetch member lists:", data);
        setLists([]);
      } else if (Array.isArray(data)) {
        setLists(data);
      } else {
        setLists([]);
      }
    } catch (error) {
      console.error("Failed to fetch member lists:", error);
      setLists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) {
      addError("Please enter a list name");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newListName);
      if (csvFile) {
        formData.append("csv", csvFile);
      }

      const res = await fetch("/api/member-lists", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        addError(`Error creating list: ${error.error}`);
        return;
      }

      const newList = await res.json();
      if (newList && newList.id) {
        // Ensure the list has the expected structure
        const listWithDefaults = {
          ...newList,
          _count: newList._count || {
            members: newList.members?.length || 0,
            surveys: 0,
          },
        };
        setLists([listWithDefaults, ...lists]);
        setNewListName("");
        setCsvFile(null);
        setShowUpload(false);
      } else {
        addError("Unexpected response from server");
        console.error("Invalid response:", newList);
      }
    } catch (error) {
      console.error("Failed to upload member list:", error);
      addError("Failed to upload member list");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/member-lists/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        addError(`Error deleting list: ${error.error}`);
        return;
      }

      setLists(lists.filter((l) => l.id !== id));
    } catch (error) {
      console.error("Failed to delete member list:", error);
      addError("Failed to delete member list");
    }
  };

  const handleEditStart = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleEditSave = async (id: string) => {
    if (!editingName.trim()) {
      addError("List name cannot be empty");
      return;
    }

    try {
      const res = await fetch(`/api/member-lists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });

      if (!res.ok) {
        const error = await res.json();
        addError(`Error updating list: ${error.error}`);
        return;
      }

      const updatedList = await res.json();
      setLists(
        lists.map((l) => (l.id === id ? { ...l, name: updatedList.name } : l))
      );
      setEditingId(null);
      setEditingName("");
    } catch (error) {
      console.error("Failed to update member list:", error);
      addError("Failed to update member list");
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName("");
  };

  useEffect(() => {
    fetchLists();
  }, []);

  return {
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
    refetchLists: fetchLists,
  };
}
