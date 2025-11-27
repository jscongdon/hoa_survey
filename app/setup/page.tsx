"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "hoa" | "smtp" | "test-email" | "admin" | "verify";

export default function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // HOA Configuration
  const [hoaName, setHoaName] = useState("");
  const [hoaLogoUrl, setHoaLogoUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");

  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  // Admin Configuration
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Test email
  const [testEmail, setTestEmail] = useState("");
  const [emailTested, setEmailTested] = useState(false);

  useEffect(() => {
    // Don't check status if we're on the verify step
    if (step === "verify") {
      return;
    }

    // Check if setup is already complete or if admin exists
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.setupCompleted) {
          router.push("/login");
        } else if (data.adminExists) {
          // Admin created but not verified yet
          router.push("/login?pending=verification");
        }
      })
      .catch(() => {});

    // Load environment variables for pre-population (development only)
    fetch("/api/setup/env")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          // Pre-populate form fields with environment variables
          if (data.hoaName) setHoaName(data.hoaName);
          if (data.hoaLogoUrl) setHoaLogoUrl(data.hoaLogoUrl);
          if (data.appUrl) setAppUrl(data.appUrl);
          if (data.smtpHost) setSmtpHost(data.smtpHost);
          if (data.smtpPort) setSmtpPort(data.smtpPort);
          if (data.smtpUser) setSmtpUser(data.smtpUser);
          if (data.smtpPass) setSmtpPass(data.smtpPass);
          if (data.smtpFrom) setSmtpFrom(data.smtpFrom);
          if (data.adminEmail) setAdminEmail(data.adminEmail);
          if (data.adminPassword) setAdminPassword(data.adminPassword);
          if (data.adminPassword) setConfirmPassword(data.adminPassword); // Also populate confirm password
          if (data.adminName) setAdminName(data.adminName);
          if (data.testEmail) setTestEmail(data.testEmail);
        }
      })
      .catch(() => {
        // Silently fail if env endpoint is not available (production)
      });
  }, [router, step]);

  const handleTestEmail = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/setup/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpUser,
          smtpPass,
          smtpFrom,
          testEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send test email");
      }

      setSuccess("Test email sent successfully! Check your inbox.");
      setEmailTested(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (adminPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hoaName,
          hoaLogoUrl,
          appUrl,
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpUser,
          smtpPass,
          smtpFrom,
          adminEmail,
          adminPassword,
          adminName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Setup failed");
      }

      setStep("verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {(
              [
                "welcome",
                "hoa",
                "smtp",
                "test-email",
                "admin",
                "verify",
              ] as Step[]
            ).map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${
                    step === s
                      ? "bg-blue-600 text-white"
                      : [
                            "welcome",
                            "hoa",
                            "smtp",
                            "test-email",
                            "admin",
                          ].indexOf(step) > i
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 5 && (
                  <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200">
            {success}
          </div>
        )}

        {/* Welcome Step */}
        {step === "welcome" && (
          <div>
            <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
              Welcome to HOA Survey
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Let's get your survey system set up! This wizard will guide you
              through:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300 mb-8">
              <li>HOA branding configuration</li>
              <li>Email server setup and testing</li>
              <li>Creating your administrator account</li>
              <li>Email verification for security</li>
            </ul>
            <button
              onClick={() => setStep("hoa")}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Get Started
            </button>
          </div>
        )}

        {/* HOA Configuration Step */}
        {step === "hoa" && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              HOA Configuration
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Configure your HOA's branding information
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  HOA Name *
                </label>
                <input
                  type="text"
                  value={hoaName}
                  onChange={(e) => setHoaName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Sunset Ridge HOA"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Logo URL (Optional)
                </label>
                <input
                  type="text"
                  value={hoaLogoUrl}
                  onChange={(e) => setHoaLogoUrl(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="/logo.png"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  You can add a logo later in settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Application URL *
                </label>
                <input
                  type="url"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://hoasurvey.foxpointva.com"
                  required
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  The public URL where this application will be accessed
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("welcome")}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Back
              </button>
              <button
                onClick={() => setStep("smtp")}
                disabled={!hoaName || !appUrl}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* SMTP Configuration Step */}
        {step === "smtp" && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Email Server Configuration
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Configure your SMTP server for sending survey invitations and
              reminders
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="smtp.example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  SMTP Port *
                </label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="587"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  SMTP Username *
                </label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="your-email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  SMTP Password *
                </label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  From Email Address *
                </label>
                <input
                  type="email"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="noreply@yourhoa.com"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("hoa")}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Back
              </button>
              <button
                onClick={() => setStep("test-email")}
                disabled={
                  !smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom
                }
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Test Email Step */}
        {step === "test-email" && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Test Email Configuration
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Let's verify your email settings work correctly
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Send Test Email To
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="your-email@example.com"
                  required
                />
              </div>

              <button
                onClick={handleTestEmail}
                disabled={loading || !testEmail}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Test Email"}
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("smtp")}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Back
              </button>
              <button
                onClick={() => setStep("admin")}
                disabled={!emailTested}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {emailTested ? "Next" : "Test Email First"}
              </button>
            </div>
          </div>
        )}

        {/* Admin Account Step */}
        {step === "admin" && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Create Administrator Account
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Create your main administrator account with full access
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="admin@yourhoa.com"
                  required
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  A verification email will be sent to this address
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Password *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-3 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("test-email")}
                className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Back
              </button>
              <button
                onClick={handleCreateAdmin}
                disabled={
                  loading ||
                  !adminName ||
                  !adminEmail ||
                  !adminPassword ||
                  !confirmPassword
                }
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}

        {/* Verification Step */}
        {step === "verify" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Check Your Email
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We've sent a verification link to <strong>{adminEmail}</strong>
            </p>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              Click the link in your email to verify your account and gain full
              administrator access. You can close this page.
            </p>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 Tip: Check your spam folder if you don't see the email within
                a few minutes.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
