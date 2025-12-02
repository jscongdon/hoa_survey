"use client";

import React, { useEffect, useState } from "react";
import SurveyRenderer from "@/components/SurveyRenderer";

export default function DashboardSurveyPreviewPage() {
  const [payload, setPayload] = useState<any | null>(null);
  const [sanitizedDescription, setSanitizedDescription] = useState<string | null>(null);

  useEffect(() => {
    try {
      const key = "hoa:surveyPreview";
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPayload(parsed);
      if (parsed.description) {
        (async () => {
          try {
            const res = await fetch('/api/sanitize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: parsed.description }) });
            if (!res.ok) throw new Error('Failed to sanitize');
            const data = await res.json();
            setSanitizedDescription(data.sanitized || parsed.description);
          } catch (e) {
            console.error('Sanitize failed', e);
            setSanitizedDescription(parsed.description);
          }
        })();
      }
    } catch (e) {
      console.error("Failed to load preview payload", e);
    }
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Survey Preview</h1>
          <div>
            <button
              className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
              onClick={() => {
                try {
                  window.close();
                } catch (e) {
                  // fallback
                  window.history.back();
                }
              }}
            >
              Close
            </button>
          </div>
        </div>

        {payload ? (
          <SurveyRenderer survey={{ ...payload, description: sanitizedDescription ?? payload.description }} previewMode={true} />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <p className="text-gray-600 dark:text-gray-400">No preview data found. Use the &quot;Preview&quot; button from a survey editor to open a preview.</p>
          </div>
        )}
      </div>
    </div>
  );
}
