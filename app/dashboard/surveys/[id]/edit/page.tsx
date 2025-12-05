"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { toLocalDatetimeString } from "@/lib/dateFormatter";
import { PageLayout } from "@/components/layouts";

export default function EditSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [survey, setSurvey] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [memberListName, setMemberListName] = useState<string>("");
  const [memberListId, setMemberListId] = useState<string>("");
  const [lists, setLists] = useState<
    Array<{ id: string; name: string; _count?: { members: number } }>
  >([]);
  const [submittedResponses, setSubmittedResponses] = useState<number>(0);
  const [totalResponses, setTotalResponses] = useState<number>(0);
  const [minResponses, setMinResponses] = useState<string>("");
  const [minResponsesAll, setMinResponsesAll] = useState<boolean>(false);
  const [requireSignature, setRequireSignature] = useState<boolean>(true);
  const [notifyOnMinResponses, setNotifyOnMinResponses] =
    useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [originalData, setOriginalData] = useState<any>(null);

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

  useEffect(() => {
    let active = true;
    (async () => {
      const p = await params;
      if (!active) return;
      setSurveyId(p.id);
    })();
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (!surveyId) return;
    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((data) => {
        import("@/lib/devClient")
          .then(async (m) => {
            const dev = await m.isDevModeClient();
            if (dev) {
              console.log("[EDIT] Survey data:", data);
              console.log(
                "[EDIT] submittedResponses:",
                data.submittedResponses
              );
              console.log("[EDIT] totalResponses:", data.totalResponses);
            }
          })
          .catch(() => {});
        setSurvey(data);
        setTitle(data.title);
        setDescription(data.description || "");
        // Convert UTC to local datetime-local format
        setOpensAt(toLocalDatetimeString(data.opensAt));
        setClosesAt(toLocalDatetimeString(data.closesAt));
        setMemberListName(data.memberListName || "");
        setMemberListId(data.memberListId || "");
        setSubmittedResponses(
          typeof data.submittedResponses === "number"
            ? data.submittedResponses
            : 0
        );
        setTotalResponses(
          typeof data.totalResponses === "number" ? data.totalResponses : 0
        );
        setMinResponses(data.minResponses ? String(data.minResponses) : "");
        setMinResponsesAll(data.minResponsesAll || false);
        setRequireSignature(
          typeof data.requireSignature === "boolean"
            ? data.requireSignature
            : true
        );
        setNotifyOnMinResponses(
          typeof (data as any).notifyOnMinResponses === "boolean"
            ? (data as any).notifyOnMinResponses
            : false
        );
        const normalized = Array.isArray(data.questions)
          ? data.questions.map((q: any, i: number) => ({
              text: q.text,
              type: q.type,
              options: Array.isArray(q.options)
                ? q.options
                : q.options
                  ? (() => {
                      try {
                        return JSON.parse(q.options);
                      } catch {
                        return undefined;
                      }
                    })()
                  : undefined,
              maxSelections: q.maxSelections || undefined,
              writeIn: q.writeIn || false,
              writeInCount: (q as any).writeInCount || 0,
              required: q.required || false,
              order: typeof q.order === "number" ? q.order : i,
            }))
          : [];
        import("@/lib/devClient")
          .then(async (m) => {
            const dev = await m.isDevModeClient();
            if (dev) console.log("[EDIT] Normalized questions:", normalized);
          })
          .catch(() => {});
        setQuestions(normalized);
        // Store original data for comparison
        setOriginalData({
          title: data.title,
          description: data.description || "",
          opensAt: toLocalDatetimeString(data.opensAt),
          closesAt: toLocalDatetimeString(data.closesAt),
          memberListId: data.memberListId || "",
          requireSignature:
            typeof data.requireSignature === "boolean"
              ? data.requireSignature
              : true,
          notifyOnMinResponses:
            typeof (data as any).notifyOnMinResponses === "boolean"
              ? (data as any).notifyOnMinResponses
              : false,
          groupNotificationsEnabled:
            typeof (data as any).groupNotificationsEnabled === "boolean"
              ? (data as any).groupNotificationsEnabled
              : true,
          minResponses: data.minResponses ? String(data.minResponses) : "",
          minResponsesAll: data.minResponsesAll || false,
          questions: normalized,
        });
      });
  }, [surveyId]);

  // Force override state persisted in localStorage per survey
  const [forceOverride, setForceOverride] = useState<boolean>(false);
  useEffect(() => {
    if (!surveyId) return;
    try {
      const k = `hoa:survey:force:${surveyId}`;
      const val = localStorage.getItem(k);
      setForceOverride(val === "true");
    } catch (e) {
      setForceOverride(false);
    }
  }, [surveyId]);

  useEffect(() => {
    if (!surveyId) return;
    try {
      const k = `hoa:survey:force:${surveyId}`;
      localStorage.setItem(k, forceOverride ? "true" : "false");
    } catch (e) {}
  }, [forceOverride, surveyId]);

  // Check for changes whenever form data changes
  useEffect(() => {
    if (!originalData) return;

    const changed =
      title !== originalData.title ||
      description !== originalData.description ||
      opensAt !== originalData.opensAt ||
      closesAt !== originalData.closesAt ||
      memberListId !== originalData.memberListId ||
      requireSignature !== (originalData.requireSignature ?? true) ||
      notifyOnMinResponses !== (originalData.notifyOnMinResponses ?? false) ||
      minResponses !== originalData.minResponses ||
      minResponsesAll !== originalData.minResponsesAll ||
      JSON.stringify(questions) !== JSON.stringify(originalData.questions);

    setHasChanges(changed);
  }, [
    title,
    description,
    opensAt,
    closesAt,
    memberListId,
    requireSignature,
    notifyOnMinResponses,
    minResponses,
    minResponsesAll,
    questions,
    originalData,
  ]);

  // Fetch member lists for selection
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/member-lists");
        if (res.ok) {
          const data = await res.json();
          setLists(Array.isArray(data) ? data : []);
        }
      } catch {}
    })();
  }, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!surveyId || !hasChanges) return;
    const res = await fetch(`/api/surveys/${surveyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        requireSignature,
        notifyOnMinResponses,
        questions,
        memberListId,
        minResponses: minResponses ? parseInt(minResponses) : null,
      }),
    });
    if (res.ok) {
      setStatus("Survey updated!");
      // Update original data to reflect saved state
      setOriginalData({
        title,
        description,
        opensAt,
        closesAt,
        memberListId,
        requireSignature,
        notifyOnMinResponses,
        minResponses,
        questions,
      });
      setHasChanges(false);
    } else {
      let message = "Error updating survey";
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {}
      setStatus(message);
    }
  }

  if (!survey) {
    return (
      <PageLayout title="Edit Survey" subtitle="Loading survey...">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Edit Survey"
      actions={[
        {
          label: "Dashboard",
          onClick: () => router.push("/dashboard"),
          variant: "secondary",
        },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="mb-4 flex items-center justify-between">
            <div />
            <div className="flex items-center gap-3">
              <input
                id="forceOverride"
                type="checkbox"
                checked={forceOverride}
                onChange={(e) => setForceOverride(e.target.checked)}
                className="w-4 h-4 text-red-600"
              />
              <label htmlFor="forceOverride" className="text-sm text-red-600">
                Enable Force Edit (admin override)
              </label>
            </div>
          </div>

          <SurveyForm
            mode="edit"
            initialValues={{
              title: survey.title,
              description: survey.description || "",
              opensAt: survey.opensAt || null,
              closesAt: survey.closesAt || null,
              memberListId: survey.memberListId || "",
              groupNotificationsEnabled:
                typeof survey.groupNotificationsEnabled === "boolean"
                  ? survey.groupNotificationsEnabled
                  : true,
              minResponses: survey.minResponses ?? null,
              minResponsesAll: survey.minResponsesAll || false,
              requireSignature:
                typeof survey.requireSignature === "boolean"
                  ? survey.requireSignature
                  : true,
              notifyOnMinResponses:
                typeof survey.notifyOnMinResponses === "boolean"
                  ? survey.notifyOnMinResponses
                  : false,
              questions: questions || [],
            }}
            disableMemberList={!forceOverride && submittedResponses > 0}
            lockQuestions={!forceOverride && submittedResponses > 0}
            memberListLocked={!forceOverride && submittedResponses > 0}
            memberListNote={
              submittedResponses > 0
                ? `Member list locked (${submittedResponses}/${totalResponses} responses submitted).`
                : totalResponses > 0
                  ? `${submittedResponses}/${totalResponses} responses submitted. You can still change the list until submissions begin.`
                  : "No responses yet."
            }
            onSubmit={async (payload) => {
              setStatus(null);
              try {
                // If forcing, ask for explicit confirmation first
                if (forceOverride) {
                  const ok = window.confirm(
                    "You are about to force-update this survey. This bypasses normal safety checks and is auditable. Proceed?"
                  );
                  if (!ok) return;
                }

                const bodyPayload = {
                  ...payload,
                  ...(forceOverride ? { force: true } : {}),
                };

                const res = await fetch(`/api/surveys/${surveyId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(bodyPayload),
                });
                if (res.ok) {
                  setStatus("Survey updated!");
                  setOriginalData({
                    title: payload.title,
                    description: payload.description || "",
                    opensAt: payload.opensAt
                      ? new Date(payload.opensAt).toISOString()
                      : null,
                    closesAt: payload.closesAt
                      ? new Date(payload.closesAt).toISOString()
                      : null,
                    memberListId: payload.memberListId || "",
                    requireSignature: payload.requireSignature,
                    notifyOnMinResponses: payload.notifyOnMinResponses,
                    minResponses: payload.minResponses
                      ? String(payload.minResponses)
                      : "",
                    minResponsesAll: !!payload.minResponsesAll,
                    questions: payload.questions || [],
                  });
                  setHasChanges(false);
                } else {
                  let message = "Error updating survey";
                  try {
                    const data = await res.json();
                    if (data?.error) message = data.error;
                  } catch {}
                  setStatus(message);
                }
              } catch (err) {
                console.error(err);
                setStatus("Error updating survey");
              }
            }}
          />
        </div>
        {status && <div className="mt-4 text-green-600">{status}</div>}
      </div>
    </PageLayout>
  );
}
