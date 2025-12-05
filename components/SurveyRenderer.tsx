"use client";

import React, { useEffect, useState } from "react";

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  writeIn?: boolean;
  required?: boolean;
  showWhen?: string | any;
  order?: number;
}

interface SurveyPayload {
  id?: string;
  title: string;
  description?: string | null;
  questions: Question[];
  closesAt?: string | null;
}

export default function SurveyRenderer({
  survey,
  previewMode = false,
  onChangeAnswers,
  initialAnswers = {},
  onSubmit,
}: {
  survey: SurveyPayload;
  previewMode?: boolean;
  onChangeAnswers?: (answers: Record<string, unknown>) => void;
  initialAnswers?: Record<string, unknown>;
  onSubmit?: (answers: Record<string, unknown>) => void | Promise<void>;
}) {
  const [answers, setAnswers] =
    useState<Record<string, unknown>>(initialAnswers);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!survey) return;
    const initialEnabled: Record<string, boolean> = {};
    survey.questions.forEach(
      (q) => (initialEnabled[q.id] = q.showWhen ? false : true)
    );
    setEnabledMap(initialEnabled);
  }, [survey]);

  const evaluateEnabled = React.useCallback(
    (q: Question, currentAnswers: Record<string, unknown>): boolean => {
      if (!q.showWhen) return true;
      try {
        const cond =
          typeof q.showWhen === "string" ? JSON.parse(q.showWhen) : q.showWhen;
        const triggerOrder = cond.triggerOrder;
        const operator = cond.operator;
        const expected = cond.value;
        const trigger = survey.questions.find((t) => t.order === triggerOrder);
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
    },
    [survey]
  );

  useEffect(() => {
    if (!survey) return;
    const newEnabled: Record<string, boolean> = {};
    survey.questions.forEach(
      (q) => (newEnabled[q.id] = evaluateEnabled(q, answers))
    );

    // if any disabled, clear their answers
    const cleaned: Record<string, unknown> = { ...answers };
    let changed = false;
    Object.entries(newEnabled).forEach(([qid, enabled]) => {
      if (!enabled && cleaned[qid] !== undefined) {
        delete cleaned[qid];
        changed = true;
      }
    });

    if (changed) setAnswers(cleaned);
    setEnabledMap(newEnabled);
  }, [answers, survey, evaluateEnabled]);

  function setAnswer(questionId: string, value: unknown) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    onChangeAnswers?.(next);
  }

  return (
    <div className="min-h-[50vh] p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {survey.title}
        </h2>
      </div>

      {survey.description && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
          <div
            className="survey-description text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: survey.description || "" }}
          />
        </div>
      )}

      <div className="space-y-6 mb-8">
        {survey.questions.map((question, qIdx) => (
          <div
            key={question.id ?? `q-${qIdx}`}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {question.text}
              {question.required && enabledMap[question.id] !== false && (
                <span className="text-red-600 dark:text-red-400 ml-1">*</span>
              )}
            </h3>

            {/* Render minimal inputs for preview mode */}
            {question.type === "YES_NO" && (
              <div className="space-y-2">
                {["Yes", "No"].map((option) => {
                  const isChecked = answers[question.id] === option;
                  const disabled = !enabledMap[question.id];
                  return (
                    <label
                      key={`${question.id ?? qIdx}-yesno-${option}`}
                      className={`flex items-center p-3 rounded-lg border-2 ${isChecked ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => setAnswer(question.id, option)}
                      />
                      <span className="ml-2">{option}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {question.type === "MULTI_SINGLE" && (
              <div className="space-y-2">
                {(question.options || []).map((opt, optIdx) => {
                  const isChecked = answers[question.id] === opt;
                  const disabled = !enabledMap[question.id];
                  return (
                    <label
                      key={`${question.id ?? qIdx}-single-${opt ?? optIdx}`}
                      className={`flex items-center p-3 rounded-lg border-2 ${isChecked ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={opt}
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => setAnswer(question.id, opt)}
                      />
                      <span className="ml-2">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {question.type === "MULTI_MULTI" && (
              <div className="space-y-2">
                {(question.options || []).map((opt, optIdx) => {
                  const current = (answers[question.id] as any[]) || [];
                  const checked = current.includes(opt);
                  const disabled = !enabledMap[question.id];
                  return (
                    <label
                      key={`${question.id ?? qIdx}-multi-${opt ?? optIdx}`}
                      className={`flex items-center p-3 rounded-lg border-2 ${checked ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                    >
                      <input
                        type="checkbox"
                        name={question.id}
                        value={opt}
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => {
                          const arr = new Set(current);
                          if (e.target.checked) arr.add(opt);
                          else arr.delete(opt);
                          setAnswer(question.id, Array.from(arr));
                        }}
                      />
                      <span className="ml-2">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {question.writeIn && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Write-in"
                  value={(answers[question.id] as any)?.writeIn || ""}
                  onChange={(e) =>
                    setAnswer(question.id, {
                      choice: "__WRITE_IN__",
                      writeIn: e.target.value,
                    })
                  }
                  disabled={!enabledMap[question.id]}
                  className="w-full px-4 py-2 border rounded"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit area - disabled in preview mode */}
      {previewMode ? (
        <div className="text-sm text-gray-500">
          Preview mode — submission disabled
        </div>
      ) : (
        <div className="flex gap-4">
          <button
            onClick={() => onSubmit?.(answers)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
