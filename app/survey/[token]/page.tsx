"use client";

import React, { useEffect, useState } from "react";

interface ResponseData {
  survey: {
    id: string;
    title: string;
    description: string;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options?: string[];
    }>;
    closesAt: string | null;
  };
  member: {
    lot: string;
    name: string;
  };
  submittedAt: string | null;
  existingAnswers: Record<string, unknown> | null;
  isClosed: boolean;
  signed: boolean;
  signedAt: string | null;
}

export default function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [survey, setSurvey] = useState<ResponseData | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [originalAnswers, setOriginalAnswers] = useState<
    Record<string, unknown>
  >({});
  const [hasChanges, setHasChanges] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [wasEditing, setWasEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [requestingSignature, setRequestingSignature] = useState(false);
  const [signatureRequested, setSignatureRequested] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    params.then((resolvedParams) => {
      setToken(resolvedParams.token);
    });
  }, [params]);

  useEffect(() => {
    if (!token) return;

    const fetchSurvey = async () => {
      try {
        const res = await fetch(`/api/responses/${token}`);
        if (!res.ok) throw new Error("Survey not found");
        const data = await res.json();
        setSurvey(data);

        // Initialize enabledMap: questions with a showWhen should start disabled
        const initEnabledAll: Record<string, boolean> = {};
        data.survey.questions.forEach((q: any) => {
          initEnabledAll[q.id] = q.showWhen ? false : true;
        });
        setEnabledMap(initEnabledAll);

        // Load existing answers if they exist
        if (data.existingAnswers) {
          // Map answers to current question IDs (handle case where question IDs changed after editing)
          const mappedAnswers: Record<string, unknown> = {};
          const answerKeys = Object.keys(data.existingAnswers);

          data.survey.questions.forEach((question: any, index: number) => {
            // First try direct ID match
            if (data.existingAnswers[question.id] !== undefined) {
              mappedAnswers[question.id] = data.existingAnswers[question.id];
            }
            // Fallback: match by order if we have an answer at this index
            else if (
              answerKeys[index] &&
              data.existingAnswers[answerKeys[index]] !== undefined
            ) {
              mappedAnswers[question.id] =
                data.existingAnswers[answerKeys[index]];
            }
          });

          setAnswers(mappedAnswers);
          setOriginalAnswers(mappedAnswers);
        }

        // Check if admin is logged in
        try {
          const authRes = await fetch("/api/auth/me", {
            credentials: "include",
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            setIsAdmin(!!authData.adminId);
          }
        } catch (error) {
          console.error("Failed to check admin auth:", error);
        }
      } catch (error) {
        console.error("Failed to fetch survey:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSurvey();
  }, [token]);

  // Evaluate showWhen conditions and clear answers for disabled questions
  useEffect(() => {
    if (!survey) return;
    const questions = survey.survey.questions as any[];

    function evaluateEnabled(
      q: any,
      currentAnswers: Record<string, any>
    ): boolean {
      if (!q.showWhen) return true;
      try {
        const cond =
          typeof q.showWhen === "string" ? JSON.parse(q.showWhen) : q.showWhen;
        const triggerOrder = cond.triggerOrder;
        const operator = cond.operator;
        const expected = cond.value;
        const trigger = questions.find((t) => t.order === triggerOrder);
        if (!trigger) return false;
        const triggerAns = currentAnswers[trigger.id];
        if (
          triggerAns === null ||
          triggerAns === undefined ||
          triggerAns === ""
        )
          return false;

        if (Array.isArray(triggerAns)) {
          if (operator === "equals") return triggerAns.includes(expected);
          return triggerAns.some((a: any) =>
            String(a).includes(String(expected))
          );
        }

        const asStr = String(triggerAns);
        if (operator === "equals") return asStr === String(expected);
        return asStr.includes(String(expected));
      } catch (e) {
        return false;
      }
    }

    // Compute new enabled map
    const newEnabled: Record<string, boolean> = {};
    questions.forEach((q: any) => {
      newEnabled[q.id] = evaluateEnabled(q, answers as Record<string, any>);
    });

    // If any question becomes disabled, clear its answer
    const cleanedAnswers = { ...answers } as Record<string, any>;
    let changed = false;
    Object.entries(newEnabled).forEach(([qid, isEnabled]) => {
      if (!isEnabled && cleanedAnswers[qid] !== undefined) {
        delete cleanedAnswers[qid];
        changed = true;
      }
    });

    if (changed) {
      setAnswers(cleanedAnswers);
    }

    setEnabledMap(newEnabled);
  }, [answers, survey]);

  // Detect changes in answers
  useEffect(() => {
    if (!survey?.submittedAt) {
      // Not editing, so always allow submission
      setHasChanges(true);
      return;
    }

    // Compare current answers with original answers
    const changed = JSON.stringify(answers) !== JSON.stringify(originalAnswers);
    setHasChanges(changed);
  }, [answers, originalAnswers, survey?.submittedAt]);

  const handleSubmit = async () => {
    if (!token) return;
    // Validate write-in fields: any selected write-in must have non-empty "please specify" text
    const errors: Record<string, string> = {};
    if (survey) {
      survey.survey.questions.forEach((q: any) => {
        const ans = answers[q.id];
        if (Array.isArray(ans)) {
          ans.forEach((a) => {
            if (a && typeof a === "object" && a.choice === "__WRITE_IN__") {
              if (!String(a.writeIn || "").trim()) {
                errors[q.id] =
                  "Please specify a value for the selected write-in.";
              }
            }
          });
        } else if (
          ans &&
          typeof ans === "object" &&
          (ans as any).choice === "__WRITE_IN__"
        ) {
          if (!String((ans as any).writeIn || "").trim()) {
            errors[q.id] = "Please specify a value for the selected write-in.";
          }
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Scroll to first error
      const firstQ = Object.keys(errors)[0];
      const el = document.querySelector(`[data-question-id="${firstQ}"]`);
      if (el)
        (el as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      return;
    }

    try {
      await fetch(`/api/responses/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, submittedByAdmin: isAdmin }),
      });
      const isEdit = !!survey?.submittedAt;
      setWasEditing(isEdit);
      setSubmitted(true);

      // Reload the page after 5 seconds (for both new submissions and updates)
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error) {
      console.error("Failed to submit:", error);
    }
  };

  const handleRequestSignature = async () => {
    if (!token) return;

    setRequestingSignature(true);
    try {
      const res = await fetch(`/api/responses/${token}/request-signature`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to request signature");
      }

      setSignatureRequested(true);
    } catch (error) {
      console.error("Failed to request signature:", error);
      alert("Failed to send signature request. Please try again.");
    } finally {
      setRequestingSignature(false);
    }
  };

  if (loading)
    return (
      <div className="text-center py-8 text-gray-900 dark:text-white">
        Loading...
      </div>
    );
  if (!survey)
    return (
      <div className="text-center py-8 text-gray-900 dark:text-white">
        Survey not found
      </div>
    );

  const isEditing = !!survey.submittedAt;
  const isClosed = survey.isClosed;

  if (submitted)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Thank You!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your response has been {wasEditing ? "updated" : "submitted"}.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            Returning to survey...
          </p>
        </div>
      </div>
    );

  const answeredCount = Object.entries(answers).filter(([_, value]) => {
    // For arrays (MULTI_MULTI), check if at least one option is selected
    if (Array.isArray(value)) {
      return value.some((v) => {
        if (
          v &&
          typeof v === "object" &&
          (v as any).choice === "__WRITE_IN__"
        ) {
          return String((v as any).writeIn || "").trim() !== "";
        }
        return v !== undefined && v !== null && v !== "";
      });
    }
    // For other types, check if value exists and is not empty
    if (
      value &&
      typeof value === "object" &&
      (value as any).choice === "__WRITE_IN__"
    ) {
      return String((value as any).writeIn || "").trim() !== "";
    }
    return value !== undefined && value !== null && value !== "";
  }).length;
  const totalQuestions = survey.survey.questions.length;
  const progress = Math.round((answeredCount / totalQuestions) * 100);

  // Check if all required questions are answered — only consider questions that are enabled
  const requiredQuestions = survey.survey.questions.filter(
    (q: any) => q.required && enabledMap[q.id] !== false
  );
  const allRequiredAnswered = requiredQuestions.every((q: any) => {
    const answer = answers[q.id];
    if (Array.isArray(answer)) {
      return answer.some((v) => {
        if (
          v &&
          typeof v === "object" &&
          (v as any).choice === "__WRITE_IN__"
        ) {
          return String((v as any).writeIn || "").trim() !== "";
        }
        return v !== undefined && v !== null && v !== "";
      });
    }
    if (
      answer &&
      typeof answer === "object" &&
      (answer as any).choice === "__WRITE_IN__"
    ) {
      return String((answer as any).writeIn || "").trim() !== "";
    }
    return answer !== undefined && answer !== null && answer !== "";
  });
  const hasRequiredQuestions = requiredQuestions.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {survey.survey.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Lot {survey.member.lot} – {survey.member.name}
          </p>

          {isClosed && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-700 dark:text-red-200 font-semibold">
                This survey closed
                {survey.survey.closesAt && (
                  <>
                    {" "}
                    on{" "}
                    {new Date(survey.survey.closesAt).toLocaleString(
                      undefined,
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      }
                    )}
                  </>
                )}
                .
              </p>
              <p className="text-red-600 dark:text-red-300 text-sm">
                You can view your submitted responses below, but can no longer
                make changes.
              </p>
            </div>
          )}

          {isEditing && !isClosed && (
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
              <p className="text-blue-700 dark:text-blue-200 font-semibold">
                You have already submitted a response.
              </p>
              <p className="text-blue-600 dark:text-blue-300 text-sm">
                {survey.signed
                  ? `This response was digitally signed on ${new Date(survey.signedAt!).toLocaleString()} and can no longer be edited.`
                  : `You can review and update your answers until the survey closes${
                      survey.survey.closesAt
                        ? ` on ${new Date(
                            survey.survey.closesAt
                          ).toLocaleString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}`
                        : ""
                    }.`}
              </p>
            </div>
          )}

          {survey.signed && (
            <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-green-700 dark:text-green-200 font-semibold">
                    Digitally Signed
                  </p>
                  <p className="text-green-600 dark:text-green-300 text-sm">
                    This response was signed on{" "}
                    {new Date(survey.signedAt!).toLocaleString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}{" "}
                    and is now finalized.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div
              className="bg-green-500 dark:bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {answeredCount} of {totalQuestions} questions answered ({progress}%)
          </p>
          {hasRequiredQuestions && !isClosed && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              <span className="text-red-600 dark:text-red-400">*</span> Required
              questions
            </p>
          )}
        </div>

        {survey.survey.description && (
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <p className="text-gray-700 dark:text-gray-300">
              {survey.survey.description}
            </p>
          </div>
        )}

        <div className="space-y-6 mb-8">
          {survey.survey.questions.map((question: any) => (
            <div
              key={question.id}
              data-question-id={question.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {question.text}
                {question.required && enabledMap[question.id] !== false && (
                  <span className="text-red-600 dark:text-red-400 ml-1">*</span>
                )}
              </h3>

              {question.type === "YES_NO" && (
                <div className="space-y-2">
                  {["Yes", "No"].map((option) => {
                    const isChecked = answers[question.id] === option;
                    const qEnabled = enabledMap[question.id] !== false;
                    const isDisabled = isClosed || survey.signed || !qEnabled;
                    return (
                      <label
                        key={option}
                        className={`flex items-center p-3 rounded-lg border-2 transition-colors ${
                          isChecked && isDisabled
                            ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                            : isChecked
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50"
                              : isDisabled
                                ? "border-gray-200 dark:border-gray-700"
                                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [question.id]: e.target.value,
                            })
                          }
                          className="mr-3"
                        />
                        <span
                          className={`font-medium ${
                            isChecked && isDisabled
                              ? "text-blue-700 dark:text-blue-300"
                              : isChecked
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === "APPROVE_DISAPPROVE" && (
                <div className="space-y-2">
                  {["Approve", "Disapprove"].map((option) => {
                    const isChecked = answers[question.id] === option;
                    const qEnabled = enabledMap[question.id] !== false;
                    const isDisabled = isClosed || survey.signed || !qEnabled;
                    return (
                      <label
                        key={option}
                        className={`flex items-center p-3 rounded-lg border-2 transition-colors ${
                          isChecked && isDisabled
                            ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                            : isChecked
                              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50"
                              : isDisabled
                                ? "border-gray-200 dark:border-gray-700"
                                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [question.id]: e.target.value,
                            })
                          }
                          className="mr-3"
                        />
                        <span
                          className={`font-medium ${
                            isChecked && isDisabled
                              ? "text-blue-700 dark:text-blue-300"
                              : isChecked
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === "MULTI_SINGLE" && (
                <div className="space-y-2">
                  {(() => {
                    const options =
                      typeof question.options === "string"
                        ? JSON.parse(question.options)
                        : question.options || [];
                    const qEnabled = enabledMap[question.id] !== false;
                    const isDisabled = isClosed || survey.signed || !qEnabled;
                    const elems: React.ReactNode[] = [];
                    options.forEach((option: string) => {
                      const isChecked = answers[question.id] === option;
                      elems.push(
                        <label
                          key={option}
                          className={`flex items-center p-3 rounded-lg border-2 transition-colors ${
                            isChecked && isDisabled
                              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                              : isChecked
                                ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50"
                                : isDisabled
                                  ? "border-gray-200 dark:border-gray-700"
                                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option}
                            checked={Boolean(isChecked)}
                            disabled={isDisabled}
                            onChange={(e) => {
                              setAnswers({
                                ...answers,
                                [question.id]: e.target.value,
                              });
                              setValidationErrors((prev) => {
                                const copy = { ...prev };
                                delete copy[question.id];
                                return copy;
                              });
                            }}
                            className="mr-3"
                          />
                          <span
                            className={`font-medium ${
                              isChecked && isDisabled
                                ? "text-blue-700 dark:text-blue-300"
                                : isChecked
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {option}
                          </span>
                        </label>
                      );
                    });
                    if ((question as any).writeIn) {
                      const isChecked = Boolean(
                        answers[question.id] &&
                          typeof answers[question.id] === "object" &&
                          (answers[question.id] as any).choice ===
                            "__WRITE_IN__"
                      );
                      elems.push(
                        <div key="__WRITE_IN__">
                          <label
                            className={`flex items-center p-3 rounded-lg border-2 transition-colors ${
                              isChecked && isDisabled
                                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                                : isChecked
                                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50"
                                  : isDisabled
                                    ? "border-gray-200 dark:border-gray-700"
                                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                            }`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value="__WRITE_IN__"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => {
                                setAnswers({
                                  ...answers,
                                  [question.id]: {
                                    choice: "__WRITE_IN__",
                                    writeIn: "",
                                  },
                                });
                                setValidationErrors((prev) => {
                                  const copy = { ...prev };
                                  delete copy[question.id];
                                  return copy;
                                });
                              }}
                              className="mr-3"
                            />
                            <span
                              className={`font-medium ${
                                isChecked
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              Other (write-in)
                            </span>
                          </label>
                          {isChecked && (
                            <div className="mt-2 ml-6">
                              <input
                                type="text"
                                value={
                                  (answers[question.id] as any)?.writeIn || ""
                                }
                                onChange={(e) => {
                                  setAnswers({
                                    ...answers,
                                    [question.id]: {
                                      choice: "__WRITE_IN__",
                                      writeIn: e.target.value,
                                    },
                                  });
                                  setValidationErrors((prev) => {
                                    const copy = { ...prev };
                                    delete copy[question.id];
                                    return copy;
                                  });
                                }}
                                disabled={isDisabled}
                                placeholder="Please specify"
                                className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  isDisabled &&
                                  (answers[question.id] as any)?.writeIn
                                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }
                    return elems;
                  })()}
                </div>
              )}

              {question.type === "MULTI_MULTI" && (
                <div>
                  {question.maxSelections && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Select up to {question.maxSelections} option
                      {question.maxSelections > 1 ? "s" : ""}
                    </p>
                  )}
                  <div className="space-y-2">
                    {(() => {
                      const options =
                        typeof question.options === "string"
                          ? JSON.parse(question.options)
                          : question.options || [];
                      return (() => {
                        const elems: React.ReactNode[] = [];
                        const currentAnswers =
                          (answers[question.id] as any[]) || [];
                        const qEnabled = enabledMap[question.id] !== false;

                        // Helper to count selected non-empty answers
                        const selectedCount = currentAnswers.length;

                        // Regular options
                        options.forEach((option: string) => {
                          const isChecked = currentAnswers.includes(option);
                          const isDisabled =
                            isClosed ||
                            survey.signed ||
                            !qEnabled ||
                            (!isChecked &&
                              question.maxSelections &&
                              selectedCount >= question.maxSelections);

                          elems.push(
                            <label
                              key={option}
                              className={`flex items-center p-3 rounded-lg border-2 transition-colors ${
                                isChecked &&
                                (isClosed || survey.signed || !qEnabled)
                                  ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                                  : isChecked
                                    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50"
                                    : isDisabled
                                      ? "border-gray-200 dark:border-gray-700 opacity-50"
                                      : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                              }`}
                            >
                              <input
                                type="checkbox"
                                value={option}
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={(e) => {
                                  const newAnswers = e.target.checked
                                    ? [...currentAnswers, option]
                                    : currentAnswers.filter(
                                        (a) => a !== option
                                      );
                                  setAnswers({
                                    ...answers,
                                    [question.id]: newAnswers,
                                  });
                                  setValidationErrors((prev) => {
                                    const copy = { ...prev };
                                    delete copy[question.id];
                                    return copy;
                                  });
                                }}
                                className="mr-3"
                              />
                              <span
                                className={`font-medium ${
                                  isChecked &&
                                  (isClosed || survey.signed || !qEnabled)
                                    ? "text-blue-700 dark:text-blue-300"
                                    : isChecked
                                      ? "text-blue-600 dark:text-blue-400"
                                      : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {option}
                              </span>
                            </label>
                          );
                        });

                        // Write-in slots for MULTI_MULTI
                        const writeInCount =
                          (question as any).writeInCount || 0;
                        for (let i = 0; i < writeInCount; i++) {
                          const writeInKey = `__WRITE_IN__:${i}`;
                          const isChecked = currentAnswers.some(
                            (a) =>
                              typeof a === "object" &&
                              a.choice === "__WRITE_IN__" &&
                              a.index === i
                          );
                          const writeInObj = currentAnswers.find(
                            (a) =>
                              typeof a === "object" &&
                              a.choice === "__WRITE_IN__" &&
                              a.index === i
                          ) as any;
                          const isDisabled =
                            isClosed ||
                            survey.signed ||
                            !qEnabled ||
                            (!isChecked &&
                              question.maxSelections &&
                              selectedCount >= question.maxSelections);

                          elems.push(
                            <div key={writeInKey}>
                              <label
                                className={`flex items-center p-3 rounded-lg border-2 transition-colors ${
                                  isChecked &&
                                  (isClosed || survey.signed || !qEnabled)
                                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                                    : isChecked
                                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50"
                                      : isDisabled
                                        ? "border-gray-200 dark:border-gray-700 opacity-50"
                                        : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  value={writeInKey}
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  onChange={(e) => {
                                    let newAnswers = [...currentAnswers];
                                    if (e.target.checked) {
                                      // add write-in object placeholder
                                      newAnswers.push({
                                        choice: "__WRITE_IN__",
                                        writeIn: "",
                                        index: i,
                                      });
                                    } else {
                                      newAnswers = newAnswers.filter(
                                        (a) =>
                                          !(
                                            typeof a === "object" &&
                                            (a as any).choice ===
                                              "__WRITE_IN__" &&
                                            (a as any).index === i
                                          )
                                      );
                                    }
                                    setAnswers({
                                      ...answers,
                                      [question.id]: newAnswers,
                                    });
                                    setValidationErrors((prev) => {
                                      const copy = { ...prev };
                                      delete copy[question.id];
                                      return copy;
                                    });
                                  }}
                                  className="mr-3"
                                />
                                <span
                                  className={`font-medium ${isChecked ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}
                                >
                                  Write-In {i + 1}
                                </span>
                              </label>
                              {isChecked && (
                                <div className="mt-2 ml-6">
                                  <input
                                    type="text"
                                    value={writeInObj?.writeIn || ""}
                                    onChange={(e) => {
                                      const newAnswers = (
                                        currentAnswers || []
                                      ).map((a) => {
                                        if (
                                          typeof a === "object" &&
                                          (a as any).choice ===
                                            "__WRITE_IN__" &&
                                          (a as any).index === i
                                        ) {
                                          return {
                                            ...a,
                                            writeIn: e.target.value,
                                          };
                                        }
                                        return a;
                                      });
                                      setAnswers({
                                        ...answers,
                                        [question.id]: newAnswers,
                                      });
                                      setValidationErrors((prev) => {
                                        const copy = { ...prev };
                                        delete copy[question.id];
                                        return copy;
                                      });
                                    }}
                                    disabled={isDisabled}
                                    placeholder="Please specify"
                                    className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      isDisabled && writeInObj?.writeIn
                                        ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    }`}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        }

                        return elems;
                      })();
                    })()}
                  </div>
                </div>
              )}

              {question.type === "PARAGRAPH" &&
                (() => {
                  const qEnabled = enabledMap[question.id] !== false;
                  const isDisabled = isClosed || survey.signed || !qEnabled;
                  return (
                    <textarea
                      value={(answers[question.id] as string) || ""}
                      disabled={isDisabled}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          [question.id]: e.target.value,
                        })
                      }
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDisabled && answers[question.id]
                          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      }`}
                      rows={4}
                    ></textarea>
                  );
                })()}

              {question.type === "RATING_5" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const currentAnswer = answers[question.id];
                    const isSelected =
                      currentAnswer === rating ||
                      currentAnswer === String(rating);

                    return (
                      <button
                        key={rating}
                        onClick={() =>
                          setAnswers({ ...answers, [question.id]: rating })
                        }
                        disabled={
                          isClosed ||
                          survey.signed ||
                          enabledMap[question.id] === false
                        }
                        className={`w-10 h-10 rounded-lg font-bold border-2 transition-colors ${
                          isSelected && (isClosed || survey.signed)
                            ? "bg-blue-500 dark:bg-blue-600 text-white border-blue-600 dark:border-blue-500"
                            : isSelected
                              ? "bg-blue-500 dark:bg-blue-600 text-white border-blue-600 dark:border-blue-500"
                              : isClosed ||
                                  survey.signed ||
                                  enabledMap[question.id] === false
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-700 cursor-not-allowed"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                      >
                        {rating}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {!isClosed && !survey.signed && (
          <>
            <button
              onClick={handleSubmit}
              disabled={!allRequiredAnswered || (isEditing && !hasChanges)}
              className={`w-full px-6 py-3 rounded-lg font-semibold text-lg transition-colors ${
                allRequiredAnswered && (!isEditing || hasChanges)
                  ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              title={
                !allRequiredAnswered
                  ? "Please answer all required questions"
                  : isEditing && !hasChanges
                    ? "No changes to save"
                    : ""
              }
            >
              {isEditing ? "Update Response" : "Submit Response"}
            </button>
            {!allRequiredAnswered && hasRequiredQuestions && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center mt-2">
                Please answer all required questions before submitting
              </p>
            )}
          </>
        )}

        {isEditing && !survey.signed && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            {signatureRequested ? (
              <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <div className="flex items-start">
                  <svg
                    className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <div>
                    <p className="text-green-700 dark:text-green-200 font-semibold">
                      Signature Link Sent
                    </p>
                    <p className="text-green-600 dark:text-green-300 text-sm">
                      A signature link has been sent to your email. Please check
                      your inbox and follow the link to digitally sign your
                      response.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Ready to Finalize?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Once you're satisfied with your responses, you can digitally
                  sign them to validate authenticity. After signing, your
                  response will be finalized and can no longer be edited.
                </p>
                <button
                  onClick={handleRequestSignature}
                  disabled={requestingSignature}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {requestingSignature ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-5 w-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                      Request Digital Signature
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
