"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";

export default function CreateSurveyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Create New Survey
        </h1>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400"
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <SurveyForm
          mode="create"
          onSubmit={async (payload) => {
            setLoading(true);
            try {
              const res = await fetch("/api/surveys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              if (res.ok) {
                const survey = await res.json();
                router.push(`/dashboard/surveys/${survey.id}/edit`);
              } else {
                const data = await res.json().catch(() => ({}));
                alert(data?.error || "Failed to create survey");
              }
            } catch (error) {
              console.error("Failed to create survey:", error);
            } finally {
              setLoading(false);
            }
          }}
        />
      </div>
    </main>
  );
}
