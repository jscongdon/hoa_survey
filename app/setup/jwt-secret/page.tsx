"use client";

import { useEffect, useState } from "react";

export default function JWTSecretPage() {
  const [status, setStatus] = useState<{
    jwtSecretSet?: boolean;
    jwtSecretLength?: number;
    instructions?: string;
    error?: string;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch("/api/setup/jwt-secret")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
      })
      .catch((err) => {
        setError("Failed to check JWT secret configuration");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
          JWT Secret Configuration
        </h1>

        {loading && (
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {status.jwtSecretSet ? (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                  ✅ JWT Secret Configured
                </h2>
                <p className="text-green-700 dark:text-green-300">
                  JWT_SECRET environment variable is set (length:{" "}
                  {status.jwtSecretLength} characters).
                </p>
                <p className="text-green-700 dark:text-green-300 mt-2">
                  {status.instructions}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  ⚠️ JWT Secret Not Configured
                </h2>
                <p className="text-yellow-700 dark:text-yellow-300">
                  {status.error ||
                    "JWT_SECRET environment variable is not set."}
                </p>
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm">
                  <p className="text-gray-800 dark:text-gray-200">
                    Generate a secure secret:
                  </p>
                  <code className="text-blue-600 dark:text-blue-400">
                    openssl rand -hex 64
                  </code>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Environment Variable Setup
          </h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            The JWT_SECRET should be set as an environment variable in your
            deployment platform (Docker, Portainer, etc.). It is no longer
            stored in the database for security reasons.
          </p>
        </div>
      </div>
    </div>
  );
}
