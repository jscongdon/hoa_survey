"use client";

import { useState, useEffect } from "react";
import { useError } from "@/lib/error/ErrorContext";

export interface Survey {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  responseRate: number;
  totalRecipients: number;
  submittedCount: number;
  minResponses?: number;
  initialSentAt?: string | null;
}

export interface UseSurveysReturn {
  surveys: Survey[];
  loading: boolean;
  reminderStatus: { [key: string]: string };
  initialSendStatus: { [key: string]: string };
  showNonRespondents: { [key: string]: boolean };
  nonRespondents: { [key: string]: any[] };
  loadingNonRespondents: { [key: string]: boolean };
  selectedNonRespondent: { [key: string]: string };
  deletingId: string | null;
  handleSendReminder: (surveyId: string) => Promise<void>;
  handleSendInitial: (surveyId: string) => Promise<void>;
  toggleNonRespondents: (surveyId: string) => Promise<void>;
  sendSpecificReminder: (surveyId: string) => Promise<void>;
  handleCloseSurvey: (surveyId: string) => Promise<void>;
  handleExport: (surveyId: string, surveyTitle: string) => Promise<void>;
  handleDelete: (
    surveyId: string,
    title: string,
    force?: boolean
  ) => Promise<void>;
  setSelectedNonRespondent: React.Dispatch<
    React.SetStateAction<{ [key: string]: string }>
  >;
  refetchSurveys: () => Promise<void>;
}

export interface UseSurveysOptions {
  enabled?: boolean;
}

export function useSurveys(options: UseSurveysOptions = {}): UseSurveysReturn {
  const { enabled = true } = options;
  const { addError } = useError();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderStatus, setReminderStatus] = useState<{
    [key: string]: string;
  }>({});
  const [initialSendStatus, setInitialSendStatus] = useState<{
    [key: string]: string;
  }>({});
  const [showNonRespondents, setShowNonRespondents] = useState<{
    [key: string]: boolean;
  }>({});
  const [nonRespondents, setNonRespondents] = useState<{
    [key: string]: any[];
  }>({});
  const [loadingNonRespondents, setLoadingNonRespondents] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedNonRespondent, setSelectedNonRespondent] = useState<{
    [key: string]: string;
  }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSurveys = async () => {
    try {
      const res = await fetch("/api/surveys");

      // Check if response has content before trying to parse JSON
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error(
          "Surveys API returned non-JSON response:",
          contentType,
          res.status
        );
        setSurveys([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to fetch surveys:", data);
        setSurveys([]);
      } else if (Array.isArray(data)) {
        setSurveys(data);
      } else if (data && Array.isArray((data as any).surveys)) {
        setSurveys((data as any).surveys);
      } else {
        setSurveys([]);
      }
    } catch (error) {
      console.error("Failed to fetch surveys:", error);
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (surveyId: string) => {
    setReminderStatus({ ...reminderStatus, [surveyId]: "Sending..." });
    try {
      const res = await fetch(`/api/surveys/${surveyId}/remind`, {
        method: "POST",
      });
      if (res.ok) {
        setReminderStatus({ ...reminderStatus, [surveyId]: "Reminders sent!" });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      } else {
        const data = await res.json();
        setReminderStatus({
          ...reminderStatus,
          [surveyId]: data?.error || "Failed to send reminders",
        });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      }
    } catch (error) {
      setReminderStatus({
        ...reminderStatus,
        [surveyId]: "Error sending reminders",
      });
      setTimeout(() => {
        setReminderStatus((prev) => {
          const next = { ...prev };
          delete next[surveyId];
          return next;
        });
      }, 3000);
    }
  };

  const handleSendInitial = async (surveyId: string) => {
    setInitialSendStatus({ ...initialSendStatus, [surveyId]: "Sending..." });
    try {
      const res = await fetch(`/api/surveys/${surveyId}/send-initial`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setInitialSendStatus({
          ...initialSendStatus,
          [surveyId]: "Initial notices sent",
        });
        // update local state so button hides
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === surveyId
              ? { ...s, initialSentAt: new Date().toISOString() }
              : s
          )
        );
        setTimeout(() => {
          setInitialSendStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      } else {
        const data = await res.json();
        setInitialSendStatus({
          ...initialSendStatus,
          [surveyId]: data?.error || "Failed to send initial notices",
        });
        setTimeout(() => {
          setInitialSendStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      }
    } catch (error) {
      setInitialSendStatus({
        ...initialSendStatus,
        [surveyId]: "Error sending initial notices",
      });
      setTimeout(() => {
        setInitialSendStatus((prev) => {
          const next = { ...prev };
          delete next[surveyId];
          return next;
        });
      }, 3000);
    }
  };

  const toggleNonRespondents = async (surveyId: string) => {
    const isCurrentlyShowing = showNonRespondents[surveyId];

    if (!isCurrentlyShowing) {
      // Fetch nonrespondents if not already loaded
      if (!nonRespondents[surveyId]) {
        setLoadingNonRespondents({
          ...loadingNonRespondents,
          [surveyId]: true,
        });
        try {
          const res = await fetch(`/api/surveys/${surveyId}/nonrespondents`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            setNonRespondents({ ...nonRespondents, [surveyId]: data });
          }
        } catch (error) {
          console.error("Failed to fetch nonrespondents:", error);
        } finally {
          setLoadingNonRespondents({
            ...loadingNonRespondents,
            [surveyId]: false,
          });
        }
      }
    }

    setShowNonRespondents({
      ...showNonRespondents,
      [surveyId]: !isCurrentlyShowing,
    });
  };

  const sendSpecificReminder = async (surveyId: string) => {
    const responseId = selectedNonRespondent[surveyId];
    if (!responseId) {
      setReminderStatus({
        ...reminderStatus,
        [surveyId]: "Please select a member",
      });
      setTimeout(() => {
        setReminderStatus((prev) => {
          const next = { ...prev };
          delete next[surveyId];
          return next;
        });
      }, 3000);
      return;
    }

    setReminderStatus({ ...reminderStatus, [surveyId]: "Sending..." });
    try {
      const res = await fetch(`/api/surveys/${surveyId}/remind/${responseId}`, {
        method: "POST",
      });
      if (res.ok) {
        setReminderStatus({ ...reminderStatus, [surveyId]: "Reminder sent!" });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      } else {
        const data = await res.json();
        setReminderStatus({
          ...reminderStatus,
          [surveyId]: data?.error || "Failed to send reminder",
        });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      }
    } catch (error) {
      setReminderStatus({
        ...reminderStatus,
        [surveyId]: "Error sending reminder",
      });
      setTimeout(() => {
        setReminderStatus((prev) => {
          const next = { ...prev };
          delete next[surveyId];
          return next;
        });
      }, 3000);
    }
  };

  const handleCloseSurvey = async (surveyId: string) => {
    if (
      !window.confirm(
        "Close this survey now? This will set the close date to the current time."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${surveyId}/close`, {
        method: "POST",
      });
      if (res.ok) {
        // Refetch surveys to update the state
        await fetchSurveys();
      } else {
        const data = await res.json();
        addError(`Failed to close survey: ${data?.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to close survey:", error);
      addError("Failed to close survey");
    }
  };

  const handleExport = async (surveyId: string, surveyTitle: string) => {
    try {
      const res = await fetch(`/api/surveys/${surveyId}/export`);

      if (!res.ok) {
        const data = await res.json();
        addError(data.error || "Failed to export survey");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${surveyTitle.replace(/[^a-z0-9]/gi, "_")}_results.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to export survey:", error);
      addError("Error exporting survey");
    }
  };

  const handleDelete = async (
    surveyId: string,
    title: string,
    force = false
  ) => {
    if (!force) {
      setDeletingId(surveyId);
      try {
        const res = await fetch(`/api/surveys/${surveyId}/delete`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (res.status === 409 && data.requiresConfirmation) {
          const confirmed = window.confirm(
            `This survey has ${data.submittedCount} submitted response(s). Are you sure you want to delete it? This cannot be undone.`
          );
          if (confirmed) {
            await handleDelete(surveyId, title, true);
          } else {
            setDeletingId(null);
          }
          return;
        }

        if (res.ok) {
          setSurveys(surveys.filter((s) => s.id !== surveyId));
        } else {
          addError(data.error || "Failed to delete survey");
        }
      } catch (error) {
        addError("Error deleting survey");
      } finally {
        setDeletingId(null);
      }
    } else {
      // Force delete
      try {
        const res = await fetch(`/api/surveys/${surveyId}/delete?force=true`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (res.ok) {
          setSurveys(surveys.filter((s) => s.id !== surveyId));
        } else {
          addError(data.error || "Failed to delete survey");
        }
      } catch (error) {
        addError("Error deleting survey");
      } finally {
        setDeletingId(null);
      }
    }
  };

  useEffect(() => {
    if (enabled) {
      fetchSurveys();
    } else {
      setLoading(false);
    }
  }, [enabled]);

  return {
    surveys,
    loading,
    reminderStatus,
    initialSendStatus,
    showNonRespondents,
    nonRespondents,
    loadingNonRespondents,
    selectedNonRespondent,
    deletingId,
    handleSendReminder,
    handleSendInitial,
    toggleNonRespondents,
    sendSpecificReminder,
    handleCloseSurvey,
    handleExport,
    handleDelete,
    setSelectedNonRespondent,
    refetchSurveys: fetchSurveys,
  };
}
