 'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';

export default function JWTSecretPage() {
  const [jwtSecret, setJwtSecret] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/setup/jwt-secret')
      .then(res => res.json())
      .then(data => {
        if (data.jwtSecret) {
          setJwtSecret(data.jwtSecret);
        } else {
          setError(data.error || 'Failed to load JWT secret');
        }
      })
      .catch(err => {
        setError('Failed to load JWT secret');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(jwtSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <PageHeader title="JWT Secret Configuration" />

        {loading && (
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                For Docker deployments, you need to add the JWT_SECRET as an environment variable.
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4 mb-4">
                <p className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                  ⚠️ Important: This secret is required for authentication to work
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  Without this environment variable set in your container, you will not be able to log in.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                JWT Secret:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={jwtSecret}
                  readOnly
                  className="flex-1 font-mono text-sm border border-gray-300 dark:border-gray-600 p-3 rounded bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 mb-6">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">
                Portainer Instructions:
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                <li>Go to your Portainer dashboard</li>
                <li>Select your stack (hoa_survey)</li>
                <li>Click "Editor"</li>
                <li>Add the following line under the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">environment:</code> section:</li>
                <li className="ml-6">
                  <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded block mt-1">
                    - JWT_SECRET={jwtSecret.substring(0, 20)}...
                  </code>
                </li>
                <li>Click "Update the stack"</li>
                <li>The container will restart with the new environment variable</li>
              </ol>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                💡 Tip: Keep this secret secure and never commit it to your repository.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
