'use client';

import React, { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/dateFormatter'
import { useRouter } from 'next/navigation';

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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEW_ONLY');
  const [inviting, setInviting] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);

  useEffect(() => {
    // Load both current admin and admins list, then clear loading to avoid
    // a race where the UI renders before we know the current admin's role.
    (async () => {
      setLoading(true)
      await Promise.all([fetchAdmins(), fetchCurrentAdmin()])
      setLoading(false)
    })()
  }, []);

  const fetchCurrentAdmin = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentAdminId(data.adminId);
        setCurrentAdminRole(data.role);
        import('@/lib/devClient').then(async (m) => {
          const dev = await m.isDevModeClient()
          if (dev) console.log('[AdminPage] fetchCurrentAdmin ->', { adminId: data.adminId, role: data.role })
        }).catch(() => {})
      }
    } catch (error) {
      console.error('Failed to fetch current admin:', error);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins);
        import('@/lib/devClient').then(async (m) => {
          const dev = await m.isDevModeClient()
          if (dev) console.log('[AdminPage] fetchAdmins -> got', data.admins.length, 'admins')
        }).catch(() => {})
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          invitedById: currentAdminId,
        }),
      });

      if (res.ok) {
        setShowInviteForm(false);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('VIEW_ONLY');
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
      alert('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to delete this admin user?')) return;

    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete admin');
      }
    } catch (error) {
      console.error('Failed to delete admin:', error);
      alert('Failed to delete admin');
    }
  };

  const handleResendInvite = async (adminId: string) => {
    if (!confirm('Resend invite to this user?')) return
    try {
      // Use Bearer token from cookie by asking server to use auth-token cookie isn't
      // available to fetch; we will read auth cookie via document.cookie and send as Bearer.
      const token = typeof document !== 'undefined' ? document.cookie.split('; ').find(c => c.startsWith('auth-token='))?.split('=')[1] : ''
      const res = await fetch('/api/auth/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ adminId })
      })
      if (res.ok) {
        alert('Invite resent')
        fetchAdmins()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to resend invite')
      }
    } catch (err) {
      console.error('Failed to resend invite', err)
      alert('Failed to resend invite')
    }
  }

  const handleResetPassword = async (adminId: string) => {
    if (!confirm('Reset this user\'s password? This will clear their current password and send them a reset link.')) return
    try {
      const token = typeof document !== 'undefined' ? document.cookie.split('; ').find(c => c.startsWith('auth-token='))?.split('=')[1] : ''
      const res = await fetch('/api/auth/reset-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ adminId })
      })
      if (res.ok) {
        alert('Password reset initiated; the user will receive an email with a reset link')
        fetchAdmins()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to reset password')
      }
    } catch (err) {
      console.error('Failed to reset password', err)
      alert('Failed to reset password')
    }
  }

  const handleUpdateRole = async (adminId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    }
  };

  const handleToggle2FA = async (adminId: string, currentState: boolean) => {
    try {
      const res = await fetch(`/api/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoFactor: !currentState }),
      });

      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update 2FA setting');
      }
    } catch (error) {
      console.error('Failed to update 2FA:', error);
      alert('Failed to update 2FA setting');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center text-gray-900 dark:text-white">Loading...</div>
      </div>
    );
  }

  const canManageAdmins = currentAdminRole === 'FULL';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Management</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              You can manage admins you've invited and their invitees
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 dark:text-blue-400 hover:underline mt-2"
            >
              ← Back to Dashboard
            </button>
          </div>
          {canManageAdmins && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              Invite Admin
            </button>
          )}
        </div>

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
                      setInviteEmail('');
                      setInviteName('');
                      setInviteRole('VIEW_ONLY');
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
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  2FA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Invited By
                </th>
                {canManageAdmins && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {admin.name || 'N/A'}
                    {admin.id === currentAdminId && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div>{admin.email}</div>
                    {admin.inviteExpires && (
                      <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        Pending invite — expires {formatDateTime(admin.inviteExpires)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        admin.role === 'FULL'
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      }`}>
                        {admin.role === 'FULL' ? 'Full Access' : 'View Only'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleToggle2FA(admin.id, admin.twoFactor)}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        admin.twoFactor
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {admin.twoFactor ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {admin.invitedBy ? `${admin.invitedBy.name || admin.invitedBy.email}` : 'N/A'}
                  </td>
                  {canManageAdmins && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {admin.id !== currentAdminId && (
                        <div className="flex flex-col gap-2 items-start">
                          {admin.inviteExpires && (
                            <button
                              onClick={() => handleResendInvite(admin.id)}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              Resend Invite
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPassword(admin.id)}
                            className="text-orange-600 dark:text-orange-400 hover:underline"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!canManageAdmins && (
          <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              You have view-only access. Contact a full admin to manage admin users.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
