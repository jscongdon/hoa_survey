"use client";

import React, { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/dateFormatter";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ListLayout } from "@/components/layouts";
import { DataGrid } from "@/components/data";

interface Admin {
  id: string;
  email: string;
  name: string | null;
  role: string;
  twoFactor: boolean;
  invitedBy?: {
    name: string | null;
    email: string;
  } | null;
  inviteExpires?: string | null;
}

export default function AdminManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("VIEW_ONLY");
  const [inviting, setInviting] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);

  useEffect(() => {
    // Load both current admin and admins list, then clear loading to avoid
    // a race where the UI renders before we know the current admin's role.
    (async () => {
      setLoading(true);
      await Promise.all([fetchAdmins(), fetchCurrentAdmin()]);
      setLoading(false);
    })();
  }, []);

  const fetchCurrentAdmin = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentAdminId(data.adminId);
        setCurrentAdminRole(data.role);
        import("@/lib/devClient")
          .then(async (m) => {
            const dev = await m.isDevModeClient();
            if (dev)
              console.log("[AdminPage] fetchCurrentAdmin ->", {
                adminId: data.adminId,
                role: data.role,
              });
          })
          .catch(() => {});
      }
    } catch (error) {
      console.error("Failed to fetch current admin:", error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch("/api/admins");
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins);
        import("@/lib/devClient")
          .then(async (m) => {
            const dev = await m.isDevModeClient();
            if (dev)
              console.log(
                "[AdminPage] fetchAdmins -> got",
                data.admins.length,
                "admins"
              );
          })
          .catch(() => {});
      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Failed to fetch admins:", error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          invitedById: currentAdminId,
        }),
      });

      if (res.ok) {
        setShowInviteForm(false);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("VIEW_ONLY");
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send invite");
      }
    } catch (error) {
      console.error("Failed to send invite:", error);
      alert("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to delete this admin user?")) return;

    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete admin");
      }
    } catch (error) {
      console.error("Failed to delete admin:", error);
      alert("Failed to delete admin");
    }
  };

  const handleResendInvite = async (adminId: string) => {
    if (!confirm("Resend invite to this user?")) return;
    try {
      // Use Bearer token from cookie by asking server to use auth-token cookie isn't
      // available to fetch; we will read auth cookie via document.cookie and send as Bearer.
      const token =
        typeof document !== "undefined"
          ? document.cookie
              .split("; ")
              .find((c) => c.startsWith("auth-token="))
              ?.split("=")[1]
          : "";
      const res = await fetch("/api/auth/resend-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ adminId }),
      });
      if (res.ok) {
        alert("Invite resent");
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to resend invite");
      }
    } catch (err) {
      console.error("Failed to resend invite", err);
      alert("Failed to resend invite");
    }
  };

  const handleResetPassword = async (adminId: string) => {
    if (
      !confirm(
        "Reset this user's password? This will clear their current password and send them a reset link."
      )
    )
      return;
    try {
      const token =
        typeof document !== "undefined"
          ? document.cookie
              .split("; ")
              .find((c) => c.startsWith("auth-token="))
              ?.split("=")[1]
          : "";
      const res = await fetch("/api/auth/reset-admin-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ adminId }),
      });
      if (res.ok) {
        alert(
          "Password reset initiated; the user will receive an email with a reset link"
        );
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to reset password");
      }
    } catch (err) {
      console.error("Failed to reset password", err);
      alert("Failed to reset password");
    }
  };

  const handleUpdateRole = async (adminId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update role:", error);
      alert("Failed to update role");
    }
  };

  const handleToggle2FA = async (adminId: string, currentState: boolean) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twoFactor: !currentState }),
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update 2FA setting");
      }
    } catch (error) {
      console.error("Failed to update 2FA:", error);
      alert("Failed to update 2FA setting");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center text-gray-900 dark:text-white">
          Loading...
        </div>
      </div>
    );
  }

  const canManageAdmins = currentAdminRole === "FULL";

  const actions = canManageAdmins
    ? [
        {
          label: "Invite Admin",
          onClick: () => setShowInviteForm(true),
          variant: "primary" as const,
        },
        {
          label: "Settings",
          href: "/dashboard/settings",
          variant: "secondary" as const,
        },
      ]
    : [
        {
          label: "Settings",
          href: "/dashboard/settings",
          variant: "secondary" as const,
        },
      ];

  return (
    <ListLayout
      title="Admin Management"
      subtitle="You can manage admins you've invited and their invitees"
      actions={actions}
      isLoading={loading}
      isEmpty={!admins.length && !loading}
      emptyMessage="No admins found"
    >
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Invite New Admin
            </h2>
            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="VIEW_ONLY">View Only</option>
                  <option value="FULL">Full Access</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail("");
                    setInviteName("");
                    setInviteRole("VIEW_ONLY");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataGrid
        data={admins}
        cardProps={{
          title: (admin) => admin.name || "N/A",
          subtitle: (admin) => admin.email,
          content: (admin) => (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {admin.id === currentAdminId && (
                  <span className="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded-full">
                    You
                  </span>
                )}
                {admin.inviteExpires && (
                  <span className="px-2 py-1 text-xs font-medium text-white bg-yellow-500 rounded-full">
                    Pending
                  </span>
                )}
                {!admin.inviteExpires && (
                  <span
                    className={`px-2 py-1 text-xs font-medium text-white rounded-full ${
                      admin.role === "FULL" ? "bg-purple-500" : "bg-blue-500"
                    }`}
                  >
                    {admin.role === "FULL" ? "Full Access" : "View Only"}
                  </span>
                )}
              </div>

              {admin.inviteExpires && (
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Pending invite — expires {formatDateTime(admin.inviteExpires)}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Role:
                </span>
                {canManageAdmins && admin.id !== currentAdminId ? (
                  <select
                    value={admin.role}
                    onChange={(e) => handleUpdateRole(admin.id, e.target.value)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="VIEW_ONLY">View Only</option>
                    <option value="FULL">Full Access</option>
                  </select>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      admin.role === "FULL"
                        ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                        : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                    }`}
                  >
                    {admin.role === "FULL" ? "Full Access" : "View Only"}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  2FA:
                </span>
                <button
                  onClick={() => handleToggle2FA(admin.id, admin.twoFactor)}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    admin.twoFactor
                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  {admin.twoFactor ? "Enabled" : "Disabled"}
                </button>
              </div>

              {admin.invitedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Invited by:
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {admin.invitedBy.name || admin.invitedBy.email}
                  </span>
                </div>
              )}
            </div>
          ),
          actions: (admin) => {
            if (!canManageAdmins || admin.id === currentAdminId) return null;

            return (
              <div className="flex flex-wrap gap-2">
                {admin.inviteExpires && (
                  <button
                    onClick={() => handleResendInvite(admin.id)}
                    className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                  >
                    Resend Invite
                  </button>
                )}
                <button
                  onClick={() => handleResetPassword(admin.id)}
                  className="px-3 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                >
                  Reset Password
                </button>
                <button
                  onClick={() => handleDeleteAdmin(admin.id)}
                  className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            );
          },
        }}
        columns={{ default: 1, md: 2, lg: 3 }}
      />

      {!canManageAdmins && (
        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            You have view-only access. Contact a full admin to manage admin
            users.
          </p>
        </div>
      )}
    </ListLayout>
  );
}
