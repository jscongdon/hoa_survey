"use client";

import React, { useState, FormEvent, useEffect, Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    // Check if setup is complete
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (!data.setupCompleted && !data.adminExists) {
          // No admin exists, redirect to setup
          router.push("/setup");
        }
      })
      .catch(() => {
        // Ignore errors, allow login page to load
      });
  }, [router]);

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setSuccess(
        "Email verified successfully! You can now log in with full administrator access."
      );
    }
    if (searchParams.get("reset") === "success") {
      setSuccess(
        "Password reset successfully! You can now log in with your new password."
      );
    }
    if (searchParams.get("pending") === "verification") {
      setError(
        "Please verify your email address before accessing the dashboard."
      );
    }
  }, [searchParams]);

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to resend verification email");
      } else {
        setSuccess("Verification email sent! Please check your inbox.");
        setNeedsVerification(false);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsVerification) {
          setNeedsVerification(true);
          setUnverifiedEmail(data.email);
          setError(data.error);
        } else {
          setError(data.error || "Login failed");
        }
        setLoading(false);
        return;
      }

      // Small delay to ensure cookie is set before navigation
      import("@/lib/devClient")
        .then(async (m) => {
          const dev = await m.isDevModeClient();
          if (dev) console.log("Login success response", res.status, data);
        })
        .catch(() => {});
      setTimeout(async () => {
        try {
          await router.push("/dashboard");
          import("@/lib/devClient")
            .then(async (m) => {
              const dev = await m.isDevModeClient();
              if (dev) console.log("Navigation to /dashboard triggered");
            })
            .catch(() => {});
        } catch (navErr) {
          console.error("Navigation error", navErr);
          setError("Navigation failed. Please try again.");
          setLoading(false);
        }
      }, 100);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <PageHeader title="HOA Survey" />

        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
            {error}
            {needsVerification && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="mt-2 text-sm underline hover:no-underline disabled:opacity-50"
              >
                {resendingVerification
                  ? "Sending..."
                  : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 font-medium"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          First time? Contact your HOA administrator for an invite.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-gray-900 dark:text-white">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
