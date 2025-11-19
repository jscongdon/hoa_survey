"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface QuestionStats {
  questionId: string;
  text: string;
  type: string;
  totalResponses: number;
  responseRate: number;
  counts?: Record<string, number>;
  average?: number;
  responses?: string[];
}

interface SurveyResultsData {
  survey: {
    id: string;
    title: string;
    description: string | null;
    opensAt: string;
    closesAt: string;
    totalResponses: number;
  };
  questions: Array<{
    id: string;
    text: string;
    type: string;
    options: string[] | null;
    required: boolean;
  }>;
  stats: QuestionStats[];
  responses: Array<{
    id: string;
    member: { lot: string; name: string };
    answers: Record<string, any>;
    submittedAt: string;
  }>;
}

export default function SurveyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [data, setData] = useState<SurveyResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(
    null
  );

  useEffect(() => {
    params.then((resolvedParams) => {
      setSurveyId(resolvedParams.id);
    });
  }, [params]);

  useEffect(() => {
    const fetchAdminRole = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setCurrentAdminRole(data.role);
        }
      } catch (error) {
        console.error("Error fetching admin role:", error);
      }
    };
    fetchAdminRole();
  }, []);

  useEffect(() => {
    if (!surveyId) return;

    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/surveys/${surveyId}/results`);
        if (!res.ok) throw new Error("Failed to fetch results");
        const results = await res.json();
        setData(results);
        // If the API returned a creator id, fetch admins and resolve name for display
        if (results?.survey?.createdById) {
          try {
            const adminsRes = await fetch('/api/admins');
            if (adminsRes.ok) {
              const adminsJson = await adminsRes.json();
              const admin = (adminsJson?.admins || []).find((a: any) => a.id === results.survey.createdById);
              if (admin) {
                // merge creator display name into local data copy so UI shows current name
                setData((prev) => prev ? { ...prev, survey: { ...prev.survey, createdByName: admin.name } } : prev);
              }
            }
          } catch (err) {
            // ignore lookup failures, we can still show the id
          }
        }
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [surveyId]);

  const handleDeleteResponse = async (responseId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this response? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingId(responseId);
    try {
      const res = await fetch(
        `/api/surveys/${surveyId}/responses/${responseId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        // Refresh the results
        const refreshRes = await fetch(`/api/surveys/${surveyId}/results`);
        if (refreshRes.ok) {
          const results = await refreshRes.json();
          setData(results);
        }
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete response");
      }
    } catch (error) {
      console.error("Error deleting response:", error);
      alert("Failed to delete response");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-900 dark:text-white">
        Loading results...
      </div>
    );
  if (!data)
    return (
      <div className="p-8 text-center text-gray-900 dark:text-white">
        Survey not found
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {data.survey.title}
            </h1>
            {data.survey.createdByName && (
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Created by {data.survey.createdByName}
              </div>
            )}
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            ← Back to Dashboard
          </button>
        </div>

        {data.survey.description && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <p className="text-gray-700 dark:text-gray-300">
              {data.survey.description}
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {data.survey.totalResponses}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Responses
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900 p-4 rounded">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {data.questions.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Questions
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {new Date(data.survey.closesAt) > new Date()
                  ? "Open"
                  : "Closed"}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Survey Status
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {data.stats.map((stat, index) => {
            const question = data.questions.find(
              (q) => q.id === stat.questionId
            );
            if (!question) return null;

            return (
              <div
                key={stat.questionId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {index + 1}. {stat.text}
                      {question.required && (
                        <span className="text-red-600 dark:text-red-400 ml-1">
                          *
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {stat.type.replace("_", " ")}
                      </span>
                      <span>
                        {stat.totalResponses} responses ({stat.responseRate}%)
                      </span>
                    </div>
                  </div>
                </div>

                {(stat.type === "YES_NO" ||
                  stat.type === "APPROVE_DISAPPROVE" ||
                  stat.type === "MULTI_SINGLE" ||
                  stat.type === "MULTI_MULTI") &&
                  stat.counts && (
                    <div className="space-y-2">
                      {Object.entries(stat.counts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([option, count]) => {
                          const percentage =
                            stat.totalResponses > 0
                              ? Math.round((count / stat.totalResponses) * 100)
                              : 0;
                          return (
                            <div key={option} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-700 dark:text-gray-300">
                                  {option}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 dark:bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                {stat.type === "RATING_5" && stat.counts && (
                  <div>
                    <div className="mb-4 text-center">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {stat.average?.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Average Rating
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = stat.counts?.[String(rating)] || 0;
                        const percentage =
                          stat.totalResponses > 0
                            ? Math.round((count / stat.totalResponses) * 100)
                            : 0;
                        return (
                          <div key={rating} className="flex items-center gap-2">
                            <span className="w-8 text-sm text-gray-700 dark:text-gray-300">
                              {rating} ★
                            </span>
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-yellow-500 dark:bg-yellow-600 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right">
                              {count} ({percentage}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stat.type === "PARAGRAPH" && stat.responses && (
                  <div className="space-y-3">
                    {stat.responses.length > 0 ? (
                      stat.responses.map((response, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 dark:bg-gray-700 p-4 rounded border border-gray-200 dark:border-gray-600"
                        >
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {response}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic">
                        No responses yet
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Individual Responses
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Lot
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Submitted At
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.responses.map((response) => (
                  <React.Fragment key={response.id}>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {response.member.lot}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {response.member.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {new Date(response.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setExpandedResponseId(
                                expandedResponseId === response.id
                                  ? null
                                  : response.id
                              )
                            }
                            className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                          >
                            {expandedResponseId === response.id
                              ? "Hide Details"
                              : "View Details"}
                          </button>
                          {currentAdminRole === "FULL" && (
                            <button
                              onClick={() => handleDeleteResponse(response.id)}
                              disabled={deletingId === response.id}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              {deletingId === response.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedResponseId === response.id && (
                      <tr className="bg-gray-50 dark:bg-gray-700">
                        <td colSpan={4} className="px-4 py-4">
                          <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                              Response Details
                            </h3>
                            {data.questions.map((question) => {
                              const answer = response.answers[question.id];
                              return (
                                <div
                                  key={question.id}
                                  className="border-b border-gray-200 dark:border-gray-600 pb-3 last:border-b-0"
                                >
                                  <p className="font-medium text-gray-900 dark:text-white mb-2">
                                    {question.text}
                                  </p>
                                  <p className="text-gray-700 dark:text-gray-300 pl-4">
                                    {answer !== undefined &&
                                    answer !== null &&
                                    answer !== "" ? (
                                      Array.isArray(answer) ? (
                                        answer
                                          .map((a: any) =>
                                            a &&
                                            typeof a === "object" &&
                                            a.choice === "__WRITE_IN__"
                                              ? String(a.writeIn || "")
                                              : String(a)
                                          )
                                          .join(", ")
                                      ) : typeof answer === "object" &&
                                        (answer as any).choice ===
                                          "__WRITE_IN__" ? (
                                        String((answer as any).writeIn || "")
                                      ) : (
                                        String(answer)
                                      )
                                    ) : (
                                      <span className="italic text-gray-500">
                                        No answer provided
                                      </span>
                                    )}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
