"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { PageLayout } from "@/components/layouts";

interface EnvVariable {
  key: string;
  label: string;
  type: string;
  category: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [envLoading, setEnvLoading] = useState(false);
  const [envMessage, setEnvMessage] = useState("");
  const [showEnvSection, setShowEnvSection] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState("");
  const [restartStatus, setRestartStatus] = useState<
    "idle" | "restarting" | "checking" | "complete"
  >("idle");
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [devModeLoading, setDevModeLoading] = useState(false);
  const [devModeMessage, setDevModeMessage] = useState("");
  const [hoaLogoUrl, setHoaLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const uploadTimeoutRef = useRef<number | null>(null);

  const scheduleClear = (ms = 3500) => {
    try {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
      uploadTimeoutRef.current = window.setTimeout(
        () => setUploadMessage(""),
        ms
      );
    } catch (e) {
      // ignore (server-side or unavailable)
    }
  };

  useEffect(() => {
    // fetch current branding
    fetch("/api/public/hoa-name")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.hoaLogoUrl) setHoaLogoUrl(data.hoaLogoUrl);
      })
      .catch(() => {});

    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
    };
  }, []);

  const handleLogoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;

    const MAX_SIZE = 2 * 1024 * 1024;
    const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];

    if (f.size > MAX_SIZE) {
      setUploadMessage("File too large (max 2MB)");
      return;
    }

    const typeOk = ALLOWED.includes(f.type);
    const name = (f.name || "").toLowerCase();
    const extOk =
      name.endsWith(".svg") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg");
    if (!typeOk && !extOk) {
      setUploadMessage("Unsupported file type (PNG, JPG, or SVG)");
      return;
    }

    setUploadingLogo(true);
    setUploadMessage("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/upload-logo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setHoaLogoUrl(data.url);
        try {
          new BroadcastChannel("hoa-branding").postMessage({
            type: "logo-updated",
            url: data.url,
          });
        } catch (e) {}
        setUploadMessage("Logo uploaded");
        scheduleClear();
        try {
          router.refresh();
        } catch (e) {}
      } else {
        setUploadMessage(data.error || "Upload failed");
        scheduleClear();
      }
    } catch (err) {
      console.error("Upload failed", err);
      setUploadMessage("Upload failed");
      scheduleClear();
    } finally {
      setUploadingLogo(false);
    }
  };

  // Wrapper to support both onChange and onInput events (some browsers/platforms)
  const handleLogoFileSelect = (e: any) => {
    return handleLogoFileChange(e as ChangeEvent<HTMLInputElement>);
  };

  const handleRemoveLogo = async () => {
    if (!confirm("Remove the current logo?")) return;
    try {
      const res = await fetch("/api/admin/upload-logo", { method: "DELETE" });
      if (res.ok) {
        setHoaLogoUrl(null);
        try {
          new BroadcastChannel("hoa-branding").postMessage({
            type: "logo-removed",
          });
        } catch (e) {}
        try {
          router.refresh();
        } catch (e) {}
        setUploadMessage("Logo removed");
        scheduleClear();
      } else {
        const d = await res.json();
        setUploadMessage(d.error || "Failed to remove");
        scheduleClear();
      }
    } catch (err) {
      console.error("Remove failed", err);
      setUploadMessage("Failed to remove");
      scheduleClear();
    }
  };

  useEffect(() => {
    const fetchAdminRole = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentAdminRole(data.role);
          if (data.role !== "FULL") {
            router.push("/dashboard");
          }
        }
      } catch (error) {
        console.error("Error fetching admin role:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminRole();

    // Fetch development mode status
    fetch("/api/settings/development-mode")
      .then((res) => res.json())
      .then((data) => {
        if (data.developmentMode !== undefined) {
          setDevelopmentMode(data.developmentMode);
        }
      })
      .catch((err) => console.error("Error fetching development mode:", err));
  }, [router]);

  const handleToggleDevelopmentMode = async () => {
    setDevModeLoading(true);
    setDevModeMessage("");

    try {
      const res = await fetch("/api/settings/development-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ developmentMode: !developmentMode }),
      });

      const data = await res.json();

      if (res.ok) {
        setDevelopmentMode(!developmentMode);
        setDevModeMessage(
          `Development mode ${!developmentMode ? "enabled" : "disabled"} successfully!`
        );
        setTimeout(() => setDevModeMessage(""), 3000);
      } else {
        setDevModeMessage(`Error: ${data.error || "Failed to update"}`);
      }
    } catch (error) {
      setDevModeMessage("Error updating development mode");
    } finally {
      setDevModeLoading(false);
    }
  };

  const fetchEnvVariables = async () => {
    try {
      const res = await fetch("/api/settings/env");
      if (res.ok) {
        const data = await res.json();
        setEnvVariables(data.variables);
        setEnvValues(data.values);
      }
    } catch (error) {
      console.error("Error fetching env variables:", error);
    }
  };

  const handleUpdateEnv = async () => {
    setEnvLoading(true);
    setEnvMessage("");

    try {
      const res = await fetch("/api/settings/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: envValues }),
      });

      const data = await res.json();

      if (res.ok) {
        setEnvMessage(
          data.message || "Environment variables updated successfully!"
        );
      } else {
        setEnvMessage(`Error: ${data.error || "Failed to update"}`);
      }
    } catch (error) {
      setEnvMessage("Error updating environment variables");
    } finally {
      setEnvLoading(false);
    }
  };

  const handleRestartApplication = async () => {
    if (!confirm("This will restart the application. Continue?")) {
      return;
    }

    setRestarting(true);
    setRestartMessage("Initiating restart...");
    setRestartStatus("restarting");

    try {
      const res = await fetch("/api/settings/restart", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setRestartMessage(
          "Application is restarting. Waiting for it to come back online..."
        );
        setRestartStatus("restarting");

        // Wait 3 seconds before starting to check
        setTimeout(() => {
          checkApplicationStatus();
        }, 3000);
      } else {
        setRestartMessage(data.message || data.error || "Failed to restart");
        setRestartStatus("idle");
        setRestarting(false);
      }
    } catch (error) {
      setRestartMessage(
        "Error restarting application. Please restart manually."
      );
      setRestartStatus("idle");
      setRestarting(false);
    }
  };

  const checkApplicationStatus = async () => {
    setRestartMessage("Checking application status...");
    setRestartStatus("checking");

    let attempts = 0;
    const maxAttempts = 30; // 30 attempts over ~30 seconds

    const checkInterval = setInterval(async () => {
      attempts++;

      try {
        // Try to fetch the dashboard or a lightweight endpoint
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-cache",
        });

        if (response.ok) {
          // Application is back online
          clearInterval(checkInterval);
          setRestartMessage("✓ Application restarted successfully!");
          setRestartStatus("complete");

          // Show success message for 3 seconds then reload
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } catch (error) {
        // Still down, keep checking
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setRestartMessage(
            "Application is taking longer than expected. Please refresh the page manually."
          );
          setRestartStatus("idle");
          setRestarting(false);
        }
      }
    }, 1000); // Check every second
  };

  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      setEmailMessage("Please enter an email address");
      return;
    }

    setSendingEmail(true);
    setEmailMessage("");

    try {
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmailAddress }),
      });

      if (res.ok) {
        setEmailMessage("Test email sent successfully!");
        setTestEmailAddress("");
      } else {
        const data = await res.json();
        setEmailMessage(`Error: ${data.error || "Failed to send email"}`);
      }
    } catch (error) {
      setEmailMessage("Error sending test email");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-900 dark:text-white">
          Loading...
        </div>
      </div>
    );
  }

  if (currentAdminRole !== "FULL") {
    return (
      <PageLayout title="Settings" subtitle="Access denied">
        <div className="text-center py-8">
          <p className="text-gray-500">Access denied. Redirecting...</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Settings"
      subtitle="Manage application settings, users, and configuration"
      actions={[
        {
          label: "Dashboard",
          onClick: () => router.push("/dashboard"),
          variant: "secondary",
        },
      ]}
    >
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          {/* Member Lists Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Member Lists</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Manage member lists for surveys
            </p>
            <button
              onClick={() => router.push("/dashboard/member-lists")}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Manage Member Lists
            </button>
          </div>

          {/* Admin Users Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">User Management</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Manage admin users, roles, and permissions
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              You can manage admins you've invited and their invitees (but not
              who invited you)
            </p>
            <button
              onClick={() => router.push("/dashboard/admins")}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Manage Admin Users
            </button>
            <div className="mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                If you need to reset your own password, you can request a reset
                link to be sent to your email.
              </p>
              <button
                onClick={async () => {
                  if (
                    !confirm(
                      "Send a password reset email to your account? This will clear your current password."
                    )
                  )
                    return;
                  try {
                    const res = await fetch("/api/auth/reset-my-password", {
                      method: "POST",
                    });
                    if (res.ok) {
                      alert("Reset email sent. Check your inbox.");
                    } else {
                      const data = await res.json();
                      alert(data.error || "Failed to send reset email");
                    }
                  } catch (err) {
                    console.error("Failed to request password reset:", err);
                    alert("Failed to request password reset");
                  }
                }}
                className="mt-2 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Reset My Password
              </button>
            </div>
          </div>

          {/* Test Email Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Email Configuration</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Send a test email to verify email configuration is working
              correctly
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-4 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={handleTestEmail}
                disabled={sendingEmail}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                {sendingEmail ? "Sending..." : "Send Test Email"}
              </button>
            </div>
            {emailMessage && (
              <p
                className={`mt-2 ${emailMessage.includes("Error") ? "text-red-500" : "text-green-500"}`}
              >
                {emailMessage}
              </p>
            )}
          </div>

          {/* Development Mode Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Development Mode</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Enable detailed logging for debugging and troubleshooting
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleDevelopmentMode}
                  disabled={devModeLoading}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    developmentMode
                      ? "bg-blue-600"
                      : "bg-gray-300 dark:bg-gray-600"
                  } ${devModeLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      developmentMode ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {developmentMode ? "Enabled" : "Disabled"}
                </span>
              </div>
              {devModeMessage && (
                <p
                  className={`text-sm ${devModeMessage.includes("Error") ? "text-red-500" : "text-green-500"}`}
                >
                  {devModeMessage}
                </p>
              )}
            </div>
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Note:</strong> Development mode increases log
                verbosity. Disable in production for better performance.
              </p>
            </div>
          </div>

          {/* Environment Variables Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Application Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure SMTP, branding, and application settings
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEnvSection(!showEnvSection);
                  if (!showEnvSection && envVariables.length === 0) {
                    fetchEnvVariables();
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {showEnvSection ? "Hide" : "Show"} Settings
              </button>
            </div>

            {showEnvSection && (
              <div className="mt-4">
                {envVariables.length === 0 ? (
                  <p className="text-gray-500">Loading...</p>
                ) : (
                  <>
                    {["Email", "Application", "Branding"].map((category) => {
                      const categoryVars = envVariables.filter(
                        (v) => v.category === category
                      );
                      if (categoryVars.length === 0) return null;

                      return (
                        <div key={category} className="mb-6">
                          <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
                            {category}
                          </h3>
                          <div className="space-y-3">
                            {categoryVars.map((variable) => (
                              <div key={variable.key}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {variable.label}
                                </label>
                                <input
                                  type={variable.type}
                                  value={envValues[variable.key] || ""}
                                  onChange={(e) =>
                                    setEnvValues({
                                      ...envValues,
                                      [variable.key]: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                  placeholder={variable.label}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center gap-4 mt-6 pt-6 border-t dark:border-gray-700">
                      <button
                        onClick={handleUpdateEnv}
                        disabled={envLoading || restarting}
                        className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                      >
                        {envLoading ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={handleRestartApplication}
                        disabled={restarting}
                        className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 flex items-center gap-2"
                      >
                        {restartStatus === "restarting" && (
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        )}
                        {restartStatus === "checking" && (
                          <svg
                            className="animate-pulse h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        {restartStatus === "complete" && (
                          <svg
                            className="h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                        {restartStatus === "idle" && "🔄"}
                        {restarting
                          ? restartStatus === "checking"
                            ? "Waiting..."
                            : "Restarting..."
                          : "Restart Application"}
                      </button>
                    </div>

                    {/* Branding / Logo Upload */}
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-300">
                        Branding
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Upload a site logo (PNG, JPG, or SVG). Max 2MB.
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                          {hoaLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={hoaLogoUrl}
                              alt="hoa logo"
                              className="object-contain w-full h-full"
                            />
                          ) : (
                            <div className="text-sm text-gray-500">No logo</div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            onChange={handleLogoFileSelect}
                            onInput={handleLogoFileSelect}
                            onClick={(e) => {
                              // Clear the input value so selecting the same file again triggers change
                              (e.currentTarget as HTMLInputElement).value = "";
                              // Clear any visible upload message when user is about to choose a new file
                              try {
                                setUploadMessage("");
                                if (uploadTimeoutRef.current) {
                                  clearTimeout(uploadTimeoutRef.current);
                                  uploadTimeoutRef.current = null;
                                }
                              } catch (err) {
                                // ignore in non-browser contexts
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            {hoaLogoUrl && (
                              <button
                                onClick={handleRemoveLogo}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Remove Logo
                              </button>
                            )}
                            <div className="text-sm text-gray-600 dark:text-gray-400 self-center">
                              {uploadingLogo ? "Uploading..." : uploadMessage}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(envMessage || restartMessage) && (
                      <div className="mt-4">
                        {envMessage && (
                          <p
                            className={`text-sm ${envMessage.includes("Error") ? "text-red-500" : "text-green-500"}`}
                          >
                            {envMessage}
                          </p>
                        )}
                        {restartMessage && (
                          <p
                            className={`text-sm ${
                              restartStatus === "complete"
                                ? "text-green-600 font-semibold"
                                : restartMessage.includes("Error") ||
                                    restartMessage.includes("Failed")
                                  ? "text-red-500"
                                  : "text-blue-500"
                            }`}
                          >
                            {restartMessage}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        💡 <strong>Tip:</strong> After saving changes, click
                        "Restart Application" to apply the new settings
                        immediately.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
