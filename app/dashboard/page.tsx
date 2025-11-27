"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dateFormatter";
import { useAuth } from "@/lib/auth/AuthContext";
import { DashboardLayout } from "@/components/layouts";
import { useSurveys } from "@/lib/hooks";
import { DataGrid, DataTable, Column } from "@/components/data";

export default function DashboardPage() {
  const router = useRouter();
  const { refreshAuth, isAuthenticated } = useAuth();
  const {
    surveys,
    loading,
    reminderStatus,
    initialSendStatus,
    showNonRespondents,
    nonRespondents,
    loadingNonRespondents,
    selectedNonRespondent,
    deletingId,
    handleSendReminder,
    handleSendInitial,
    toggleNonRespondents,
    sendSpecificReminder,
    handleCloseSurvey,
    handleExport,
    handleDelete,
    setSelectedNonRespondent,
  } = useSurveys({ enabled: isAuthenticated });
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshAuth();
    router.push("/login");
  }, [refreshAuth, router]);

  useEffect(() => {
    // Set up inactivity timeout using a ref so handlers are stable
    const resetInactivityTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        handleLogout();
      }, INACTIVITY_TIMEOUT);
    };

    // Initialize timer
    resetInactivityTimer();

    // Reset timer on user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [handleLogout, INACTIVITY_TIMEOUT]);

  useEffect(() => {
    const fetchAdminRole = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentAdminRole(data.role);
          setAdminEmail(data.email || "");
        } else {
          // If not authenticated, redirect to login
          router.push("/login");
        }
      } catch (error) {
        console.error("Failed to fetch admin role:", error);
        router.push("/login");
      }
    };

    fetchAdminRole();
  }, [router]);

  if (loading || !isAuthenticated) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Loading dashboard..." />
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={adminEmail ? `Logged in as: ${adminEmail}` : undefined}
    >
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Active Surveys
      </h2>

      <DataGrid
        data={surveys.filter((s) => new Date(s.closesAt) > new Date())}
        cardProps={{
          title: (survey) => survey.title,
          subtitle: (survey) =>
            `Closes: ${new Date(survey.closesAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}`,
          content: (survey) => (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <p
                  className={`text-sm ${
                    survey.minResponses
                      ? survey.submittedCount >= survey.minResponses
                        ? "text-green-600 dark:text-green-400"
                        : "text-orange-600 dark:text-orange-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {survey.minResponses
                    ? survey.submittedCount >= survey.minResponses
                      ? "✓"
                      : "○"
                    : "✓"}{" "}
                  Responses: {survey.submittedCount} of {survey.totalRecipients}{" "}
                  ({survey.responseRate}%)
                </p>
                {survey.minResponses &&
                  survey.submittedCount < survey.minResponses && (
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      Minimum responses: {survey.submittedCount} of{" "}
                      {survey.minResponses} (
                      {Math.round(
                        (survey.submittedCount / survey.minResponses) * 100
                      )}
                      %)
                    </p>
                  )}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className={`h-2 rounded-full ${
                    survey.minResponses
                      ? survey.submittedCount >= survey.minResponses
                        ? "bg-green-600 dark:bg-green-400"
                        : "bg-orange-600 dark:bg-orange-400"
                      : "bg-green-600 dark:bg-green-400"
                  }`}
                  style={{ width: `${survey.responseRate}%` }}
                ></div>
              </div>
              {showNonRespondents[survey.id] && nonRespondents[survey.id] && (
                <div className="mt-2 border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                  {nonRespondents[survey.id].length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      All members have responded!
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={selectedNonRespondent[survey.id] || ""}
                        onChange={(e) =>
                          setSelectedNonRespondent({
                            ...selectedNonRespondent,
                            [survey.id]: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select a member...</option>
                        {nonRespondents[survey.id].map((member: any) => (
                          <option
                            key={member.responseId}
                            value={member.responseId}
                          >
                            Lot {member.lotNumber} - {member.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => sendSpecificReminder(survey.id)}
                        disabled={
                          !!reminderStatus[survey.id] ||
                          !selectedNonRespondent[survey.id]
                        }
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                      >
                        Send Reminder
                      </button>
                    </div>
                  )}
                </div>
              )}
              {reminderStatus[survey.id] && (
                <p className="mt-2 text-sm text-center text-blue-600 dark:text-blue-400">
                  {reminderStatus[survey.id]}
                </p>
              )}
            </div>
          ),
          actions: (survey) => (
            <div className="flex flex-col gap-2 sm:gap-3">
              <button
                onClick={() =>
                  router.push(`/dashboard/surveys/${survey.id}/results`)
                }
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
              >
                View Results
              </button>
              {currentAdminRole === "FULL" && (
                <>
                  {!survey.initialSentAt && (
                    <button
                      onClick={() => handleSendInitial(survey.id)}
                      disabled={!!initialSendStatus[survey.id]}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {initialSendStatus[survey.id]
                        ? initialSendStatus[survey.id]
                        : "Send Initial Notices"}
                    </button>
                  )}

                  {survey.responseRate < 100 &&
                  survey.submittedCount < survey.totalRecipients ? (
                    <>
                      {survey.initialSentAt ? (
                        <button
                          onClick={() => handleSendReminder(survey.id)}
                          disabled={!!reminderStatus[survey.id]}
                          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Send Reminders
                        </button>
                      ) : null}

                      <button
                        onClick={() => toggleNonRespondents(survey.id)}
                        disabled={loadingNonRespondents[survey.id]}
                        className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {loadingNonRespondents[survey.id]
                          ? "Loading..."
                          : "Remind Individual"}
                      </button>

                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/surveys/${survey.id}/nonrespondents`
                          )
                        }
                        className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        View Nonrespondents
                      </button>
                    </>
                  ) : null}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCloseSurvey(survey.id)}
                      className="flex-1 px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
                    >
                      Close
                    </button>
                    <button
                      onClick={() =>
                        router.push(`/dashboard/surveys/${survey.id}/edit`)
                      }
                      className="flex-1 px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id, survey.title)}
                      disabled={deletingId === survey.id}
                      className="flex-1 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ),
        }}
        columns={{ default: 1, lg: 2 }}
        emptyMessage="No active surveys"
      />

      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Past Surveys
      </h2>

      {/* Desktop Table Layout */}
      <DataTable
        data={surveys.filter((s) => new Date(s.closesAt) <= new Date())}
        keyField="id"
        columns={[
          {
            key: "title",
            header: "Title",
            render: (value) => <span className="font-medium">{value}</span>,
          },
          {
            key: "closesAt",
            header: "Closed",
            render: (value) => (
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                {formatDate(value)}
              </span>
            ),
          },
          {
            key: "responseRate",
            header: "Response Rate",
            render: (value, survey) => (
              <div
                className={`text-sm ${
                  survey.minResponses
                    ? survey.submittedCount >= survey.minResponses
                      ? "text-green-600 dark:text-green-400"
                      : "text-orange-600 dark:text-orange-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {survey.minResponses
                  ? survey.submittedCount >= survey.minResponses
                    ? "✓"
                    : "○"
                  : "✓"}{" "}
                {value}% ({survey.submittedCount}/{survey.totalRecipients})
              </div>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (value, survey) => (
              <div className="flex gap-2 justify-center items-center">
                <button
                  onClick={() =>
                    router.push(`/dashboard/surveys/${survey.id}/results`)
                  }
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                >
                  View Results
                </button>
                <button
                  onClick={() => handleExport(survey.id, survey.title)}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                >
                  Export
                </button>
                {currentAdminRole === "FULL" && (
                  <>
                    <button
                      onClick={() =>
                        router.push(`/dashboard/surveys/${survey.id}/edit`)
                      }
                      className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id, survey.title)}
                      disabled={deletingId === survey.id}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
        emptyMessage="No past surveys"
      />
    </DashboardLayout>
  );
}
