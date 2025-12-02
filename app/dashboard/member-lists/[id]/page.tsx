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
  const [members, setMembers] = useState<Member[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const membersRef = React.useRef<Member[]>([]);
  const seenRef = React.useRef<Set<string>>(new Set());
  const readerRef = React.useRef<any>(null);
  const controllerRef = React.useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
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
  // Filters
  const [lotFilter, setLotFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [addressFilter, setAddressFilter] = useState("");

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
        // keep list metadata (without members)
        setList({ id: data.id, name: data.name, createdAt: data.createdAt, members: [] });
      } catch (err) {
        console.error(err);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchList();
  }, [id, router]);

  // load cached members
  useEffect(() => {
    if (!id) return;
    try {
      const key = `members:${id}`;
      const raw = localStorage.getItem(key);
      if (!raw) {
        setCacheLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        setCacheLoaded(true);
        return;
      }
      const { items, ts } = parsed as any;
      if (!Array.isArray(items) || !ts) {
        setCacheLoaded(true);
        return;
      }
      if (Date.now() - ts > CACHE_TTL_MS) {
        localStorage.removeItem(key);
        setCacheLoaded(true);
        return;
      }

      const mapped: Member[] = items.map((it: any) => ({ id: it.id || it.memberId || '', lot: it.lot || it.lotNumber || '', name: it.name || '', email: it.email || '', address: it.address || '' })).filter(x => x.id);
      if (mapped.length) {
        setMembers(mapped);
        membersRef.current = mapped;
        mapped.forEach(m => seenRef.current.add(m.id));
      }
    } catch (e) {
      console.error('Failed to load cached members', e);
    } finally {
      setCacheLoaded(true);
    }
  }, [id]);

  // stream members
  useEffect(() => {
    if (!id) return;
    if (!cacheLoaded) return;
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    const run = async () => {
      try {
        setStreaming(true);
        const last = membersRef.current.length ? membersRef.current[membersRef.current.length - 1].id : undefined;
        const streamUrl = `/api/member-lists/${id}/members?stream=1${last ? `&afterId=${encodeURIComponent(last)}` : ''}`;
        console.debug('Members: fetching stream', { streamUrl, lastLoaded: last, cachedCount: membersRef.current.length });
        const res = await fetch(streamUrl, { credentials: 'include', signal });
        console.debug('Members: stream response', { ok: res.ok, status: res.status, headers: Array.from(res.headers.entries()) });
        const headerTotal = res.headers.get('x-total-count');
        if (headerTotal && !Number.isNaN(Number(headerTotal))) setTotalCount(Number(headerTotal));
        if (!res.ok) {
          setStreaming(false);
          return;
        }
        const ct = res.headers.get('content-type') || '';
        if (res.body && ct.includes('ndjson')) {
          const reader = res.body.getReader();
          readerRef.current = reader;
          const dec = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = dec.decode(value, { stream: true });
            console.debug('Members: stream chunk preview', chunk.slice(0, 200));
            buf += chunk;
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const obj = JSON.parse(line) as Member;
                if (!obj?.id) continue;
                if (seenRef.current.has(obj.id)) continue;
                seenRef.current.add(obj.id);
                setMembers(prev => {
                  const next = [...prev, obj];
                  membersRef.current = next;
                  // persist immediate
                  try {
                    const key = `members:${id}`;
                    const payload = { items: next.map(n => ({ id: n.id, lot: n.lot, name: n.name, email: n.email, address: n.address })), ts: Date.now() };
                    localStorage.setItem(key, JSON.stringify(payload));
                    console.debug('Members: immediate save', { key, savedCount: next.length, exampleEmail: next[0]?.email });
                  } catch (e) {}
                  console.debug('Members: appended from stream', obj.id);
                  return next;
                });
              } catch (e) {
                // ignore
              }
            }
          }

          // flush remainder
          if (buf.trim()) {
            const final = buf.split('\n');
            for (const line of final) {
              if (!line.trim()) continue;
              try {
                const obj = JSON.parse(line) as Member;
                if (!obj?.id) continue;
                if (seenRef.current.has(obj.id)) continue;
                seenRef.current.add(obj.id);
                setMembers(prev => {
                  const next = [...prev, obj];
                  membersRef.current = next;
                  try { const key = `members:${id}`; const payload = { items: next.map(n => ({ id: n.id, lot: n.lot, name: n.name, email: n.email, address: n.address })), ts: Date.now() }; localStorage.setItem(key, JSON.stringify(payload)); console.debug('Members: final save', { key, savedCount: next.length }); } catch (e) {}
                  return next;
                });
              } catch (e) {}
            }
          }
        } else {
          // fallback full array
          const body = await res.json();
          const arr = Array.isArray(body) ? body : (body && Array.isArray((body as any).items) ? (body as any).items : []);
          if (typeof (body as any).total === 'number') setTotalCount((body as any).total);
          else setTotalCount(arr.length);
          const toAdd: Member[] = [];
          for (const it of arr) {
            if (!it || !it.id) continue;
            if (seenRef.current.has(it.id)) continue;
            seenRef.current.add(it.id);
            toAdd.push({ id: it.id, lot: it.lot || '', name: it.name || '', email: it.email || '', address: it.address || '' });
          }
          if (toAdd.length) {
            setMembers(prev => { const next = [...prev, ...toAdd]; membersRef.current = next; try { const key = `members:${id}`; const payload = { items: next.map(n => ({ id: n.id, lot: n.lot, name: n.name, email: n.email, address: n.address })), ts: Date.now() }; localStorage.setItem(key, JSON.stringify(payload)); } catch (e) {} return next; });
          }
        }
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.error('Members stream failed', e);
      } finally {
        setStreaming(false);
        try { if (readerRef.current) { await readerRef.current.releaseLock?.(); readerRef.current = null; } } catch {}
        controllerRef.current = null;
      }
    };

    run();

    return () => {
      try { controllerRef.current?.abort(); } catch {}
      try { readerRef.current?.cancel?.(); } catch {}
      controllerRef.current = null;
      readerRef.current = null;
    };
  }, [id, cacheLoaded]);


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
      // append to streaming members state
      setMembers((prev) => {
        const next = [...prev, addedMember];
        membersRef.current = next;
        try {
          const key = `members:${list.id}`;
          const payload = { items: next.map(n => ({ id: n.id, lot: n.lot, name: n.name, email: n.email, address: n.address })), ts: Date.now() };
          localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {}
        seenRef.current.add(addedMember.id);
        return next;
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

      setMembers((prev) => {
        const next = prev.filter((m) => m.id !== memberId);
        membersRef.current = next;
        try { const key = `members:${list.id}`; const payload = { items: next.map(n => ({ id: n.id, lot: n.lot, name: n.name, email: n.email, address: n.address })), ts: Date.now() }; localStorage.setItem(key, JSON.stringify(payload)); } catch (e) {}
        return next;
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
      setMembers((prev) => {
        const next = prev.map((m) => (m.id === editingId ? updatedMember : m));
        membersRef.current = next;
        try { const key = `members:${list.id}`; const payload = { items: next.map(n => ({ id: n.id, lot: n.lot, name: n.name, email: n.email, address: n.address })), ts: Date.now() }; localStorage.setItem(key, JSON.stringify(payload)); } catch (e) {}
        return next;
      });
      cancelEdit();
    } catch (error) {
      console.error("Failed to update member:", error);
      alert("Failed to update member");
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (!list) return <div className="text-center py-8">List not found</div>;

  // apply filters
  const lcLot = lotFilter.trim().toLowerCase();
  const lcName = nameFilter.trim().toLowerCase();
  const lcAddr = addressFilter.trim().toLowerCase();

  const filtered = members.filter((r) => {
    const lotMatch = !lcLot || (r.lot || "").toLowerCase().includes(lcLot);
    const nameMatch = !lcName || (r.name || "").toLowerCase().includes(lcName);
    const addrMatch = !lcAddr || ((r.address || "") as string).toLowerCase().includes(lcAddr);
    return lotMatch && nameMatch && addrMatch;
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {list.name}
          </h1>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Loaded {members.length}{totalCount !== null ? ` / ${totalCount}` : ''} members
            {streaming && (
              <svg className="animate-spin h-4 w-4 text-blue-600 inline-block ml-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>
        </div>
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

          <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Filter by Lot"
              value={lotFilter}
              onChange={(e) => setLotFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Filter by Name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Filter by Address"
              value={addressFilter}
              onChange={(e) => setAddressFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div>
              <button
                onClick={() => {
                  setLotFilter("");
                  setNameFilter("");
                  setAddressFilter("");
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Clear
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
            {
              /* apply client-side filters */
            }
            
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
            {filtered.map((m) => (
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
