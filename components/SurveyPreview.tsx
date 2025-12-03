"use client";

import React, { useEffect, useState } from "react";

export default function SurveyPreview({
  title,
  description,
  questions,
  memberNote,
}: {
  title: string;
  description?: string | null;
  questions?: any[];
  memberNote?: React.ReactNode;
}) {
  const [sanitizedHtml, setSanitizedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchSanitized() {
      setLoading(true);
      try {
        const res = await fetch("/api/sanitize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: description || "" }),
        });
        if (!res.ok) throw new Error("Failed to sanitize");
        const data = await res.json();
        if (mounted) setSanitizedHtml(data.sanitized);
      } catch (e) {
        console.error(e);
        if (mounted) setSanitizedHtml(description || "");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchSanitized();
    return () => {
      mounted = false;
    };
  }, [description]);

  return (
    <div className="min-h-[50vh] p-6 ">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {memberNote && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{memberNote}</p>
        )}
      </div>

      {description && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
          {loading ? (
            <div className="text-sm text-gray-500">Sanitizing preview…</div>
          ) : (
            <div
              className="survey-description text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml || "" }}
            />
          )}
        </div>
      )}

      <div className="space-y-6 mb-8">
        {Array.isArray(questions) && questions.length > 0 ? (
          questions.map((q) => (
            <div
              key={q.id || q.text}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {q.text}
                {q.required && <span className="text-red-600 ml-1">*</span>}
              </h3>
              {q.type === "YES_NO" && (
                <div className="text-sm text-gray-600 dark:text-gray-300">Yes / No</div>
              )}
              {q.type === "MULTI_MULTI" && (
                <div className="text-sm text-gray-600 dark:text-gray-300">Multiple choice</div>
              )}
              {q.type === "MULTI_SINGLE" && (
                <div className="text-sm text-gray-600 dark:text-gray-300">Single choice</div>
              )}
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500">No questions</div>
        )}
      </div>
    </div>
  );
}
