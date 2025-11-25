"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { toLocalDatetimeString } from "@/lib/dateFormatter";

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
          minResponses: data.minResponses ? String(data.minResponses) : "",
          minResponsesAll: data.minResponsesAll || false,
          questions: normalized,
        });
      });
  }, [surveyId]);

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

  if (!survey) return <div className="p-8">Loading...</div>;

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Edit Survey</h1>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400"
        >
          Dashboard
        </button>
      </div>
      <div className="space-y-4">
        <SurveyForm
          mode="edit"
          initialValues={{
            title: survey.title,
            description: survey.description || "",
            opensAt: survey.opensAt || null,
            closesAt: survey.closesAt || null,
            memberListId: survey.memberListId || "",
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
          disableMemberList={submittedResponses > 0}
          lockQuestions={submittedResponses > 0}
          memberListLocked={submittedResponses > 0}
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
              const res = await fetch(`/api/surveys/${surveyId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
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
    </main>
  );
}
