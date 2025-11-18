"use client"
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    params.then((resolvedParams) => {
      setToken(resolvedParams.token)
    })
  }, [params])

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setStatus(null)
    setError(null)

    // Basic validation: require password and confirmation to match
    if (!password) {
      setError('Please enter a password')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    })
    if (res.ok) {
      setStatus('Account activated! Redirecting to login...')
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } else {
      setStatus('Invalid or expired invite')
    }
  }

  if (!token) {
    return <div className="max-w-md mx-auto p-8">Loading...</div>
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <PageHeader title="Accept Admin Invite" />
      <form className="space-y-4" onSubmit={handleAccept}>
        <div>
          <label className="block text-sm text-gray-900 dark:text-white">Password</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-label="Password"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-900 dark:text-white">Confirm Password</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            aria-label="Confirm Password"
            required
          />
        </div>

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          type="submit"
          disabled={!password || !confirmPassword}
        >
          Activate Account
        </button>
      </form>
      {status && <div className="mt-4 text-green-600 dark:text-green-400">{status}</div>}
    </main>
  )
}
