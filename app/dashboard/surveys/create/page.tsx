"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SurveyBuilder from "@/components/SurveyBuilder";
import PageHeader from "@/components/PageHeader";

interface MemberList {
  id: string;
  name: string;
  _count?: {
    members: number;
  };
}

export default function CreateSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [memberListId, setMemberListId] = useState("");
  const [showLive, setShowLive] = useState(false);
  const [minResponses, setMinResponses] = useState("");
  const [minResponsesAll, setMinResponsesAll] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [lists, setLists] = useState<MemberList[]>([]);
  const [loading, setLoading] = useState(false);

  // Get current member count for selected list
  const currentMemberCount = React.useMemo(() => {
    if (!memberListId) return 0;
    const list = lists.find((l) => l.id === memberListId);
    return list?._count?.members || 0;
  }, [memberListId, lists]);

  // Update minResponses when All Members is checked or list changes
  React.useEffect(() => {
    if (minResponsesAll && memberListId) {
      setMinResponses(String(currentMemberCount));
    }
  }, [minResponsesAll, memberListId, currentMemberCount]);

  React.useEffect(() => {
    const fetchLists = async () => {
      try {
        const res = await fetch("/api/member-lists");
        const data = await res.json();
        setLists(data);
      } catch (error) {
        console.error("Failed to fetch lists:", error);
      }
    };

    fetchLists();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          opensAt: opensAt ? new Date(opensAt).toISOString() : null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          memberListId,
          showLive,
          minResponses: minResponses ? parseInt(minResponses) : null,
          minResponsesAll,
          questions,
        }),
      });

      if (res.ok) {
        const survey = await res.json();
        router.push(`/dashboard/surveys/${survey.id}/edit`);
      }
    } catch (error) {
      console.error("Failed to create survey:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Create New Survey"
          actions={
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Back to Dashboard
            </button>
          }
        />

        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Survey Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Q1 Budget Survey"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={4}
                  placeholder="Survey description or instructions"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Opens At *
                  </label>
                  <input
                    type="datetime-local"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Closes At *
                  </label>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Member List *
                </label>
                <select
                  value={memberListId}
                  onChange={(e) => setMemberListId(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a member list</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Responses Required (Optional)
                </label>
                <div className="flex items-center gap-4 mb-2">
                  <input
                    type="number"
                    min="0"
                    value={minResponses}
                    onChange={(e) => setMinResponses(e.target.value)}
                    disabled={minResponsesAll}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={
                      minResponsesAll
                        ? memberListId
                          ? `${currentMemberCount} members`
                          : "Select a member list first"
                        : "Leave empty for no minimum"
                    }
                  />
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="minResponsesAll"
                      checked={minResponsesAll}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMinResponsesAll(checked);
                        if (checked) {
                          if (memberListId) {
                            setMinResponses(String(currentMemberCount));
                          } else {
                            setMinResponses("");
                          }
                        }
                      }}
                      className="w-4 h-4 text-blue-500"
                    />
                    <label
                      htmlFor="minResponsesAll"
                      className="ml-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
                    >
                      All Members
                    </label>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {minResponsesAll
                    ? memberListId
                      ? `Minimum will automatically match the total member count (${currentMemberCount}) and adjust when members are added`
                      : "Please select a member list first"
                    : "If specified, the survey status will show progress towards this goal"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Questions
                </label>
                <SurveyBuilder onChange={setQuestions} />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showLive"
                  checked={showLive}
                  onChange={(e) => setShowLive(e.target.checked)}
                  className="w-4 h-4 text-blue-500"
                />
                <label
                  htmlFor="showLive"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Show live results to respondents
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 font-medium"
                >
                  {loading ? "Creating..." : "Create Survey"}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
