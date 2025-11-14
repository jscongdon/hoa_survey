"use client"
import React, { useState } from 'react'

export default function InviteAdminPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    const res = await fetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, invitedById: 'ADMIN_ID_HERE' }) // TODO: use real admin id from session
    })
    if (res.ok) setStatus('Invite sent!')
    else setStatus('Error sending invite')
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Invite New Admin</h1>
      <form className="space-y-4" onSubmit={handleInvite}>
        <div>
          <label className="block text-sm text-gray-900 dark:text-white">Name</label>
          <input className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-900 dark:text-white">Email</label>
          <input className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">Send Invite</button>
      </form>
      {status && <div className="mt-4 text-green-600 dark:text-green-400">{status}</div>}
    </main>
  )
}
