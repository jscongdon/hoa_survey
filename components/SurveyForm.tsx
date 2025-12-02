"use client";

import React, { useEffect, useMemo, useState } from "react";
import SurveyBuilder from "@/components/SurveyBuilder";
import Wysiwyg from "@/components/Wysiwyg";

export type SurveyFormValues = {
  title: string;
  description?: string;
  opensAt?: string | null;
  closesAt?: string | null;
  memberListId?: string;
  showLive?: boolean;
  groupNotificationsEnabled?: boolean;
  minResponses?: number | null;
  minResponsesAll?: boolean;
  requireSignature?: boolean;
  notifyOnMinResponses?: boolean;
  questions?: any[];
};

type Props = {
  mode?: "create" | "edit";
  initialValues?: Partial<SurveyFormValues>;
  disableMemberList?: boolean;
  lockQuestions?: boolean; // when true, show questions read-only
  onSubmit: (payload: SurveyFormValues) => Promise<any>;
  // Optional note to display under the Member List label (placed above the select)
  memberListNote?: React.ReactNode;
  // When true, show a small locked badge next to the select
  memberListLocked?: boolean;
};

export default function SurveyForm({
  mode = "create",
  initialValues = {},
  disableMemberList = false,
  lockQuestions = false,
  onSubmit,
  memberListNote,
  memberListLocked = false,
}: Props) {
  const [title, setTitle] = useState(initialValues.title || "");
  const [description, setDescription] = useState(
    initialValues.description || ""
  );
  const [opensAt, setOpensAt] = useState(
    initialValues.opensAt ? toLocalInput(initialValues.opensAt) : ""
  );
  const [closesAt, setClosesAt] = useState(
    initialValues.closesAt ? toLocalInput(initialValues.closesAt) : ""
  );
  const [memberListId, setMemberListId] = useState(
    initialValues.memberListId || ""
  );
  const [showLive, setShowLive] = useState(initialValues.showLive || false);
  const [minResponses, setMinResponses] = useState(
    initialValues.minResponses !== undefined &&
      initialValues.minResponses !== null
      ? String(initialValues.minResponses)
      : ""
  );
  const [minResponsesAll, setMinResponsesAll] = useState(
    !!initialValues.minResponsesAll
  );
  const [requireSignature, setRequireSignature] = useState(
    initialValues.requireSignature !== undefined
      ? !!initialValues.requireSignature
      : true
  );
  const [notifyOnMinResponses, setNotifyOnMinResponses] = useState(
    !!initialValues.notifyOnMinResponses
  );
  const [groupNotificationsEnabled, setGroupNotificationsEnabled] = useState(
    initialValues.groupNotificationsEnabled !== undefined
      ? !!initialValues.groupNotificationsEnabled
      : true
  );
  const [questions, setQuestions] = useState<any[]>(
    initialValues.questions || []
  );
  const [lists, setLists] = useState<
    Array<{ id: string; name: string; _count?: { members: number } }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/member-lists");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setLists(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // compute hasChanges vs initialValues
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: initialValues.title || "",
        description: initialValues.description || "",
        opensAt: initialValues.opensAt || null,
        closesAt: initialValues.closesAt || null,
        memberListId: initialValues.memberListId || "",
        showLive: !!initialValues.showLive,
        groupNotificationsEnabled:
          initialValues.groupNotificationsEnabled ?? true,
        minResponses: initialValues.minResponses ?? null,
        minResponsesAll: !!initialValues.minResponsesAll,
        requireSignature: initialValues.requireSignature ?? true,
        notifyOnMinResponses: !!initialValues.notifyOnMinResponses,
        questions: initialValues.questions || [],
      }),
    [initialValues]
  );

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify({
        title,
        description,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        memberListId,
        showLive,
        minResponses: minResponses ? parseInt(minResponses) : null,
        minResponsesAll,
        requireSignature,
        notifyOnMinResponses,
        groupNotificationsEnabled,
        questions,
      }),
    [
      title,
      description,
      opensAt,
      closesAt,
      memberListId,
      showLive,
      minResponses,
      minResponsesAll,
      requireSignature,
      notifyOnMinResponses,
      questions,
    ]
  );

  const hasChanges =
    mode === "create" ? true : initialSnapshot !== currentSnapshot;

  const currentMemberCount = useMemo(() => {
    const l = lists.find((x) => x.id === memberListId);
    return l?._count?.members || 0;
  }, [lists, memberListId]);

  useEffect(() => {
    if (minResponsesAll && memberListId) {
      setMinResponses(String(currentMemberCount));
    }
  }, [minResponsesAll, memberListId, currentMemberCount]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const payload: SurveyFormValues = {
        title,
        description,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        memberListId,
        showLive,
        groupNotificationsEnabled,
        minResponses: minResponses ? parseInt(minResponses) : null,
        minResponsesAll,
        requireSignature,
        notifyOnMinResponses,
        questions,
      };
      await onSubmit(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Member List *
          </label>
          {memberListLocked && (
            <span
              className="text-xs ml-3 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              title="List locked after submissions"
            >
              Locked
            </span>
          )}
        </div>
        {memberListNote && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {memberListNote}
          </p>
        )}
        <div className="mt-2">
          <select
            value={memberListId}
            onChange={(e) => setMemberListId(e.target.value)}
            required
            disabled={disableMemberList}
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
      </div>

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
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <Wysiwyg
          value={description}
          onChange={(v: string) => setDescription(v)}
          placeholder="Survey description (supports rich text)"
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          Minimum Responses Required (Optional)
        </label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-2">
          <input
            type="number"
            min={0}
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
              onChange={(e) => setMinResponsesAll(e.target.checked)}
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
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Require Signature
        </label>
        <div className="space-y-2">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="requireSignature"
              checked={requireSignature}
              onChange={(e) => setRequireSignature(e.target.checked)}
              className="w-4 h-4 text-blue-500"
            />
            <label
              htmlFor="requireSignature"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Require digital signature on survey responses
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="notifyOnMinResponses"
              checked={notifyOnMinResponses}
              onChange={(e) => setNotifyOnMinResponses(e.target.checked)}
              className="w-4 h-4 text-blue-500"
            />
            <label
              htmlFor="notifyOnMinResponses"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Notify when minimum responses reached
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="groupNotificationsEnabled"
              checked={groupNotificationsEnabled}
              onChange={(e) => setGroupNotificationsEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-500"
            />
            <label
              htmlFor="groupNotificationsEnabled"
              className="ml-2 text-sm text-gray-700 dark:text-gray-300"
            >
              Enable Group Notifications
            </label>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Questions
        </label>
        {lockQuestions ? (
          <div>
            {questions && questions.length > 0 ? (
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div
                    key={i}
                    className="border border-gray-300 dark:border-gray-600 rounded p-4 bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {q.text}
                      </h4>
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 rounded">
                        {q.type}
                      </span>
                    </div>
                    {((q.options && q.options.length > 0) || q.writeIn) && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Options:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                          {Array.isArray(q.options) &&
                            q.options.length > 0 &&
                            q.options.map((opt: string, idx: number) => (
                              <li key={idx}>{opt}</li>
                            ))}
                          {q.writeIn && (
                            <li>
                              <em>Write-In</em>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {q.maxSelections && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        Max selections: {q.maxSelections}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No questions</p>
            )}
          </div>
        ) : (
          <SurveyBuilder
            onChange={(qs) => setQuestions(qs)}
            initialQuestions={questions}
          />
        )}
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
          disabled={loading || (mode === "edit" && !hasChanges)}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 font-medium"
        >
          {loading
            ? mode === "create"
              ? "Creating..."
              : "Updating..."
            : mode === "create"
              ? "Create Survey"
              : "Update Survey"}
        </button>
      </div>
    </form>
  );
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tzOffset * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}
