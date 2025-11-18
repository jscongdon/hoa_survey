'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/dateFormatter';

interface Survey {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  responseRate: number;
  totalRecipients: number;
  submittedCount: number;
  minResponses?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderStatus, setReminderStatus] = useState<{ [key: string]: string }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNonRespondents, setShowNonRespondents] = useState<{ [key: string]: boolean }>({});
  const [nonRespondents, setNonRespondents] = useState<{ [key: string]: any[] }>({});
  const [loadingNonRespondents, setLoadingNonRespondents] = useState<{ [key: string]: boolean }>({});
  const [selectedNonRespondent, setSelectedNonRespondent] = useState<{ [key: string]: string }>({});
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  let inactivityTimer: NodeJS.Timeout;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleSendReminder = async (surveyId: string) => {
    setReminderStatus({ ...reminderStatus, [surveyId]: 'Sending...' });
    try {
      const res = await fetch(`/api/surveys/${surveyId}/remind`, {
        method: 'POST',
      });
      if (res.ok) {
        setReminderStatus({ ...reminderStatus, [surveyId]: 'Reminders sent!' });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      } else {
        const data = await res.json();
        setReminderStatus({ ...reminderStatus, [surveyId]: data?.error || 'Failed to send reminders' });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      }
    } catch (error) {
      setReminderStatus({ ...reminderStatus, [surveyId]: 'Error sending reminders' });
      setTimeout(() => {
        setReminderStatus((prev) => {
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
      // Fetch non-respondents if not already loaded
      if (!nonRespondents[surveyId]) {
        setLoadingNonRespondents({ ...loadingNonRespondents, [surveyId]: true });
        try {
          const res = await fetch(`/api/surveys/${surveyId}/non-respondents`, {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            setNonRespondents({ ...nonRespondents, [surveyId]: data });
          }
        } catch (error) {
          console.error('Failed to fetch non-respondents:', error);
        } finally {
          setLoadingNonRespondents({ ...loadingNonRespondents, [surveyId]: false });
        }
      }
    }
    
    setShowNonRespondents({ ...showNonRespondents, [surveyId]: !isCurrentlyShowing });
  };

  const sendSpecificReminder = async (surveyId: string) => {
    const responseId = selectedNonRespondent[surveyId];
    if (!responseId) {
      setReminderStatus({ ...reminderStatus, [surveyId]: 'Please select a member' });
      setTimeout(() => {
        setReminderStatus((prev) => {
          const next = { ...prev };
          delete next[surveyId];
          return next;
        });
      }, 2000);
      return;
    }
    
    const member = nonRespondents[surveyId]?.find((m: any) => m.responseId === responseId);
    const memberName = member ? member.name : 'member';
    
    setReminderStatus({ ...reminderStatus, [surveyId]: `Sending to ${memberName}...` });
    try {
      const res = await fetch(`/api/surveys/${surveyId}/remind/${responseId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setReminderStatus({ ...reminderStatus, [surveyId]: `Reminder sent to ${memberName}!` });
        // Clear selection after successful send
        setSelectedNonRespondent({ ...selectedNonRespondent, [surveyId]: '' });
        setTimeout(() => {
          setReminderStatus((prev) => {
            const next = { ...prev };
            delete next[surveyId];
            return next;
          });
        }, 3000);
      } else {
        const data = await res.json();
        setReminderStatus({ ...reminderStatus, [surveyId]: data?.error || 'Failed to send reminder' });
      }
    } catch (error) {
      setReminderStatus({ ...reminderStatus, [surveyId]: 'Error sending reminder' });
    }
  };

  const handleDeleteSurvey = async (surveyId: string, force = false) => {
    setDeletingId(surveyId);
    try {
      const url = force 
        ? `/api/surveys/${surveyId}/delete?force=true`
        : `/api/surveys/${surveyId}/delete`;
      
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (res.status === 409 && data.requiresConfirmation) {
        const confirmed = window.confirm(
          `This survey has ${data.submittedCount} submitted response(s). Are you sure you want to delete it? This cannot be undone.`
        );
        if (confirmed) {
          await handleDeleteSurvey(surveyId, true);
        } else {
          setDeletingId(null);
        }
        return;
      }

      if (res.ok) {
        setSurveys(surveys.filter(s => s.id !== surveyId));
      } else {
        alert(data.error || 'Failed to delete survey');
      }
    } catch (error) {
      alert('Error deleting survey');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCloseSurvey = async (surveyId: string) => {
    if (!window.confirm('Close this survey now? This will set the close date to the current time.')) {
      return;
    }

    try {
      const res = await fetch(`/api/surveys/${surveyId}/close`, {
        method: 'POST',
      });

      if (res.ok) {
        // Refresh the surveys list
        const surveysRes = await fetch('/api/surveys');
        const data = await surveysRes.json();
        if (Array.isArray(data)) {
          setSurveys(data);
        } else if (data && Array.isArray((data as any).surveys)) {
          setSurveys((data as any).surveys);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to close survey');
      }
    } catch (error) {
      console.error('Failed to close survey:', error);
      alert('Error closing survey');
    }
  };

  const handleExportSurvey = async (surveyId: string, surveyTitle: string) => {
    try {
      const res = await fetch(`/api/surveys/${surveyId}/export`);
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to export survey');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${surveyTitle.replace(/[^a-z0-9]/gi, '_')}_results.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export survey:', error);
      alert('Error exporting survey');
    }
  };

  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    // Set up inactivity timeout
    resetInactivityTimer();

    // Reset timer on user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [router]);

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const res = await fetch('/api/surveys');
        const data = await res.json();
        // API may return an object on error; ensure we only set an array
        if (!res.ok) {
          console.error('Failed to fetch surveys:', data);
          setSurveys([]);
        } else if (Array.isArray(data)) {
          setSurveys(data);
        } else if (data && Array.isArray((data as any).surveys)) {
          setSurveys((data as any).surveys);
        } else {
          setSurveys([]);
        }
      } catch (error) {
        console.error('Failed to fetch surveys:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchAdminRole = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentAdminRole(data.role);
          setAdminEmail(data.email || '');
        }
      } catch (error) {
        console.error('Failed to fetch admin role:', error);
      }
    };

    fetchSurveys();
    fetchAdminRole();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            {adminEmail && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Logged in as: {adminEmail}
              </p>
            )}
          </div>
          {currentAdminRole === 'FULL' && (
            <span
              onClick={() => router.push('/dashboard/settings')}
              className="text-3xl cursor-pointer hover:opacity-70 transition-opacity"
              title="Settings"
            >
              ⚙️
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">
          {currentAdminRole === 'FULL' && (
            <button
              onClick={() => router.push('/dashboard/surveys/create')}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              ➕ Create Survey
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {surveys
          .filter((s) => new Date(s.closesAt) > new Date())
          .map((survey) => (
              <div
                key={survey.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow p-6"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {survey.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Closes: {new Date(survey.closesAt).toLocaleString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric', 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {currentAdminRole === 'FULL' && (
                      <>
                        <button 
                          onClick={() => handleCloseSurvey(survey.id)}
                          className="px-3 py-1 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600"
                        >
                          Close Survey
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/surveys/${survey.id}/edit`)}
                          className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this survey?')) {
                              handleDeleteSurvey(survey.id);
                            }
                          }}
                          disabled={deletingId === survey.id}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button 
                      onClick={() => router.push(`/dashboard/surveys/${survey.id}/results`)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                    >
                      View Results
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className={`text-sm ${
                      survey.minResponses 
                        ? (survey.submittedCount >= survey.minResponses 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-orange-600 dark:text-orange-400')
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {survey.minResponses 
                        ? (survey.submittedCount >= survey.minResponses ? '✓' : '○')
                        : '✓'
                      } Responses: {survey.submittedCount} of {survey.totalRecipients} ({survey.responseRate}%)
                    </p>
                    {survey.minResponses && survey.submittedCount < survey.minResponses && (
                      <p className="text-sm text-orange-600 dark:text-orange-400">
                        Minimum responses: {survey.submittedCount} of {survey.minResponses} ({Math.round((survey.submittedCount / survey.minResponses) * 100)}%)
                      </p>
                    )}
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full ${
                      survey.minResponses 
                        ? (survey.submittedCount >= survey.minResponses 
                            ? 'bg-green-600 dark:bg-green-400' 
                            : 'bg-orange-600 dark:bg-orange-400')
                        : 'bg-green-600 dark:bg-green-400'
                    }`}
                    style={{ width: `${survey.responseRate}%` }}
                  ></div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handleSendReminder(survey.id)}
                    disabled={!!reminderStatus[survey.id]}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Remind Non-Respondents
                  </button>
                </div>
                <button 
                  onClick={() => toggleNonRespondents(survey.id)}
                  disabled={loadingNonRespondents[survey.id]}
                  className="w-full mt-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {loadingNonRespondents[survey.id] ? 'Loading...' : 'Remind Non-Respondent'}
                </button>
                {showNonRespondents[survey.id] && nonRespondents[survey.id] && (
                  <div className="mt-2 border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                    {nonRespondents[survey.id].length === 0 ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        All members have responded!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={selectedNonRespondent[survey.id] || ''}
                          onChange={(e) => setSelectedNonRespondent({ ...selectedNonRespondent, [survey.id]: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select a member...</option>
                          {nonRespondents[survey.id].map((member: any) => (
                            <option key={member.responseId} value={member.responseId}>
                              Lot {member.lotNumber} - {member.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => sendSpecificReminder(survey.id)}
                          disabled={!!reminderStatus[survey.id] || !selectedNonRespondent[survey.id]}
                          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                        >
                          Send Reminder
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {reminderStatus[survey.id] && (
                  <p className="mt-2 text-sm text-center text-blue-600 dark:text-blue-400">
                    {reminderStatus[survey.id]}
                  </p>
                )}
              </div>
            ))}
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Past Surveys
      </h2>

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Title
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Closed
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Response Rate
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {surveys
              .filter((s) => new Date(s.closesAt) <= new Date())
              .map((survey) => (
                <tr
                  key={survey.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4 text-gray-900 dark:text-white">
                    {survey.title}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    {formatDate(survey.closesAt)}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                    <div className={`text-sm ${
                      survey.minResponses 
                        ? (survey.submittedCount >= survey.minResponses 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-orange-600 dark:text-orange-400')
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {survey.minResponses 
                        ? (survey.submittedCount >= survey.minResponses ? '✓' : '○')
                        : '✓'
                      } Responses: {survey.responseRate}% ({survey.submittedCount}/{survey.totalRecipients})
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {currentAdminRole === 'FULL' && (
                        <>
                          <button
                            onClick={() => router.push(`/dashboard/surveys/${survey.id}/edit`)}
                            className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this survey?')) {
                                handleDeleteSurvey(survey.id);
                              }
                            }}
                            disabled={deletingId === survey.id}
                            className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => router.push(`/dashboard/surveys/${survey.id}/results`)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                      >
                        View Results
                      </button>
                      <button 
                        onClick={() => handleExportSurvey(survey.id, survey.title)}
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
                      >
                        Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
