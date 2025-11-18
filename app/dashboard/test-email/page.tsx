 'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

export default function TestEmailPage() {
  const router = useRouter();
  const [testEmail, setTestEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState('');
  const [config, setConfig] = useState<any>(null);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!testEmail || !testEmail.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('sending');
    setMessage('Testing SMTP connection...');
    setDetails('');
    setConfig(null);

    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Test email sent successfully!');
        setConfig(data.config);
      } else {
        setStatus('error');
        setMessage(data.error || 'Test failed');
        setDetails(data.details || '');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error');
      setDetails('Could not connect to server');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Test Email (SMTP) Settings" actions={(
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400"
          >
            ← Back to Dashboard
          </button>
        )} />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Send a test email to verify your SMTP configuration is working correctly.
          </p>

          <form onSubmit={handleTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {status === 'sending' ? 'Sending Test Email...' : 'Send Test Email'}
            </button>
          </form>

          {status !== 'idle' && (
            <div className={`mt-6 p-4 rounded-lg ${
              status === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
              status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
              'bg-blue-50 dark:bg-blue-900/20'
            }`}>
              <div className={`font-medium ${
                status === 'success' ? 'text-green-800 dark:text-green-200' :
                status === 'error' ? 'text-red-800 dark:text-red-200' :
                'text-blue-800 dark:text-blue-200'
              }`}>
                {status === 'success' ? '✅ Success' : status === 'error' ? '❌ Error' : '⏳ Testing...'}
              </div>
              <p className={`mt-2 text-sm ${
                status === 'success' ? 'text-green-700 dark:text-green-300' :
                status === 'error' ? 'text-red-700 dark:text-red-300' :
                'text-blue-700 dark:text-blue-300'
              }`}>
                {message}
              </p>
              {details && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {details}
                </p>
              )}
              {config && (
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
                  <div className="text-gray-700 dark:text-gray-300">
                    <div><strong>Host:</strong> {config.host}</div>
                    <div><strong>Port:</strong> {config.port}</div>
                    <div><strong>User:</strong> {config.user}</div>
                    <div><strong>From:</strong> {config.from}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              💡 SMTP Configuration
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
              Make sure the following environment variables are set in your <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">.env</code> file:
            </p>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
              <li><code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">SMTP_HOST</code> - Your SMTP server address</li>
              <li><code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">SMTP_PORT</code> - Port (usually 587 or 465)</li>
              <li><code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">SMTP_USER</code> - Your SMTP username</li>
              <li><code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">SMTP_PASS</code> - Your SMTP password</li>
              <li><code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">SMTP_FROM</code> - Sender email address (optional)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
