"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/dateFormatter";
import { useAuth } from "@/lib/auth/AuthContext";
import { DashboardLayout } from "@/components/layouts";
import { useSurveys } from "@/lib/hooks";

export default function DashboardPage() {
  const router = useRouter();
  const { refreshAuth } = useAuth();
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
  } = useSurveys();
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  let inactivityTimer: NodeJS.Timeout;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshAuth();
    router.push("/login");
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    // Set up inactivity timeout
    resetInactivityTimer();

    // Reset timer on user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [router]);

  useEffect(() => {
    const fetchAdminRole = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentAdminRole(data.role);
          setAdminEmail(data.email || "");
        }
      } catch (error) {
        console.error("Failed to fetch admin role:", error);
      }
    };

    fetchAdminRole();
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Loading dashboard..." />
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={adminEmail ? `Logged in as: ${adminEmail}` : undefined}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {surveys
          .filter((s) => new Date(s.closesAt) > new Date())
          .map((survey) => (
            <div
              key={survey.id}
              className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 sm:p-6"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
                    {survey.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Closes:{" "}
                    {new Date(survey.closesAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 ml-2 sm:ml-4 flex-shrink-0">
                  <button
                    onClick={() =>
                      router.push(`/dashboard/surveys/${survey.id}/results`)
                    }
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 order-1 sm:order-4"
                  >
                    View Results
                  </button>
                  {currentAdminRole === "FULL" && (
                    <>
                      <button
                        onClick={() => handleCloseSurvey(survey.id)}
                        className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 order-2"
                      >
                        Close
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/dashboard/surveys/${survey.id}/edit`)
                        }
                        className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 order-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(survey.id, survey.title)}
                        disabled={deletingId === survey.id}
                        className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400 order-4 sm:order-2"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
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
                    Responses: {survey.submittedCount} of{" "}
                    {survey.totalRecipients} ({survey.responseRate}%)
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
              <div className="flex flex-col gap-2 sm:gap-3">
                {currentAdminRole === "FULL" && !survey.initialSentAt && (
                  <button
                    onClick={() => handleSendInitial(survey.id)}
                    disabled={!!initialSendStatus[survey.id]}
                    className="w-full px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {initialSendStatus[survey.id]
                      ? initialSendStatus[survey.id]
                      : "Send Initial Notices"}
                  </button>
                )}

                {
                  // Hide reminder buttons when survey has reached 100% completion
                  // (either responseRate is 100 or submittedCount >= totalRecipients)
                  survey.responseRate < 100 &&
                  survey.submittedCount < survey.totalRecipients ? (
                    <>
                      {survey.initialSentAt ? (
                        <button
                          onClick={() => handleSendReminder(survey.id)}
                          disabled={!!reminderStatus[survey.id]}
                          className="w-full px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          Send Reminders
                        </button>
                      ) : null}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={() => toggleNonRespondents(survey.id)}
                          disabled={loadingNonRespondents[survey.id]}
                          className="px-3 py-2 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                          className="px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          View Nonrespondents
                        </button>
                      </div>
                    </>
                  ) : null
                }
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
          ))}
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Past Surveys
      </h2>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {surveys
          .filter((s) => new Date(s.closesAt) <= new Date())
          .map((survey) => (
            <div
              key={survey.id}
              className="bg-white dark:bg-gray-900 rounded-lg shadow p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
                    {survey.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Closed: {formatDate(survey.closesAt)}
                  </p>
                </div>
              </div>

              <div className="mb-3">
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
                  {survey.responseRate}% ({survey.submittedCount}/
                  {survey.totalRecipients})
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    router.push(`/dashboard/surveys/${survey.id}/results`)
                  }
                  className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 flex-1 min-w-0"
                >
                  View Results
                </button>
                <button
                  onClick={() => handleExport(survey.id, survey.title)}
                  className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 flex-1 min-w-0"
                >
                  Export
                </button>
                {currentAdminRole === "FULL" && (
                  <>
                    <button
                      onClick={() =>
                        router.push(`/dashboard/surveys/${survey.id}/edit`)
                      }
                      className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 flex-1 min-w-0"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id, survey.title)}
                      disabled={deletingId === survey.id}
                      className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400 flex-1 min-w-0"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Title
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Closed
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Response Rate
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {surveys
              .filter((s) => new Date(s.closesAt) <= new Date())
              .map((survey) => (
                <tr
                  key={survey.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {survey.title}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {formatDate(survey.closesAt)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
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
                      Responses: {survey.responseRate}% ({survey.submittedCount}
                      /{survey.totalRecipients})
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {currentAdminRole === "FULL" && (
                        <>
                          <button
                            onClick={() =>
                              router.push(
                                `/dashboard/surveys/${survey.id}/edit`
                              )
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
                      <button
                        onClick={() =>
                          router.push(`/dashboard/surveys/${survey.id}/results`)
                        }
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                      >
                        View Results
                      </button>
                      <button
                        onClick={() =>
                          handleExport(survey.id, survey.title)
                        }
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                      >
                        Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
