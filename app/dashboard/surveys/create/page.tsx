"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { FormLayout } from "@/components/layouts";

export default function CreateSurveyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <FormLayout
      title="Create New Survey"
      isLoading={loading}
      onSubmit={() => {}}
      actions={[
        {
          label: "Dashboard",
          onClick: () => router.push("/dashboard"),
          variant: "secondary"
        }
      ]}
    >
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
    </FormLayout>
  );
}
