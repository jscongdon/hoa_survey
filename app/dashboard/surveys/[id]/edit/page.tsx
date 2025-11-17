"use client"
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SurveyBuilder from '@/components/SurveyBuilder'
import { toLocalDatetimeString } from '@/lib/dateFormatter'

export default function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [survey, setSurvey] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [questions, setQuestions] = useState<any[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [surveyId, setSurveyId] = useState<string | null>(null)
  const [memberListName, setMemberListName] = useState<string>('')
  const [memberListId, setMemberListId] = useState<string>('')
  const [lists, setLists] = useState<Array<{ id: string; name: string; _count?: { members: number } }>>([])
  const [submittedResponses, setSubmittedResponses] = useState<number>(0)
  const [totalResponses, setTotalResponses] = useState<number>(0)
  const [minResponses, setMinResponses] = useState<string>('')
  const [minResponsesAll, setMinResponsesAll] = useState<boolean>(false)
  const [hasChanges, setHasChanges] = useState<boolean>(false)
  const [originalData, setOriginalData] = useState<any>(null)

  // Get current member count for selected list
  const currentMemberCount = React.useMemo(() => {
    if (!memberListId) return 0;
    const list = lists.find(l => l.id === memberListId);
    return list?._count?.members || 0;
  }, [memberListId, lists]);

  // Update minResponses when All Members is checked or list changes
  React.useEffect(() => {
    if (minResponsesAll && memberListId) {
      setMinResponses(String(currentMemberCount));
    }
  }, [minResponsesAll, memberListId, currentMemberCount]);

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await params
      if (!active) return
      setSurveyId(p.id)
    })()
    return () => {
      active = false
    }
  }, [params])

  useEffect(() => {
    if (!surveyId) return
    fetch(`/api/surveys/${surveyId}`)
      .then(r => r.json())
      .then(data => {
        import('@/lib/devClient').then(async (m) => {
          const dev = await m.isDevModeClient()
          if (dev) {
            console.log('[EDIT] Survey data:', data)
            console.log('[EDIT] submittedResponses:', data.submittedResponses)
            console.log('[EDIT] totalResponses:', data.totalResponses)
          }
        }).catch(() => {})
        setSurvey(data)
        setTitle(data.title)
        setDescription(data.description || '')
        // Convert UTC to local datetime-local format
        setOpensAt(toLocalDatetimeString(data.opensAt))
        setClosesAt(toLocalDatetimeString(data.closesAt))
        setMemberListName(data.memberListName || '')
        setMemberListId(data.memberListId || '')
        setSubmittedResponses(typeof data.submittedResponses === 'number' ? data.submittedResponses : 0)
        setTotalResponses(typeof data.totalResponses === 'number' ? data.totalResponses : 0)
        setMinResponses(data.minResponses ? String(data.minResponses) : '')
        setMinResponsesAll(data.minResponsesAll || false)
        const normalized = Array.isArray(data.questions)
          ? data.questions.map((q: any, i: number) => ({
              text: q.text,
              type: q.type,
              options: Array.isArray(q.options)
                ? q.options
                : q.options
                ? (() => { try { return JSON.parse(q.options) } catch { return undefined } })()
                : undefined,
              maxSelections: q.maxSelections || undefined,
              required: q.required || false,
              order: typeof q.order === 'number' ? q.order : i,
            }))
          : []
        import('@/lib/devClient').then(async (m) => {
          const dev = await m.isDevModeClient()
          if (dev) console.log('[EDIT] Normalized questions:', normalized)
        }).catch(() => {})
        setQuestions(normalized)
        // Store original data for comparison
        setOriginalData({
          title: data.title,
          description: data.description || '',
          opensAt: toLocalDatetimeString(data.opensAt),
          closesAt: toLocalDatetimeString(data.closesAt),
          memberListId: data.memberListId || '',
          minResponses: data.minResponses ? String(data.minResponses) : '',
          minResponsesAll: data.minResponsesAll || false,
          questions: normalized
        })
      })
  }, [surveyId])

  // Check for changes whenever form data changes
  useEffect(() => {
    if (!originalData) return
    
    const changed = 
      title !== originalData.title ||
      description !== originalData.description ||
      opensAt !== originalData.opensAt ||
      closesAt !== originalData.closesAt ||
      memberListId !== originalData.memberListId ||
      minResponses !== originalData.minResponses ||
      minResponsesAll !== originalData.minResponsesAll ||
      JSON.stringify(questions) !== JSON.stringify(originalData.questions)
    
    setHasChanges(changed)
  }, [title, description, opensAt, closesAt, memberListId, minResponses, minResponsesAll, questions, originalData])

  // Fetch member lists for selection
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/member-lists')
        if (res.ok) {
          const data = await res.json()
          setLists(Array.isArray(data) ? data : [])
        }
      } catch {}
    })()
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    if (!surveyId || !hasChanges) return
    const res = await fetch(`/api/surveys/${surveyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        description, 
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        questions, 
        memberListId,
        minResponses: minResponses ? parseInt(minResponses) : null
      })
    })
    if (res.ok) {
      setStatus('Survey updated!')
      // Update original data to reflect saved state
      setOriginalData({
        title,
        description,
        opensAt,
        closesAt,
        memberListId,
        minResponses,
        questions
      })
      setHasChanges(false)
    }
    else {
      let message = 'Error updating survey'
      try {
        const data = await res.json()
        if (data?.error) message = data.error
      } catch {}
      setStatus(message)
    }
  }

  if (!survey) return <div className="p-8">Loading...</div>

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Edit Survey</h1>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400"
        >
          ← Back to Dashboard
        </button>
      </div>
      <form className="space-y-4" onSubmit={handleUpdate}>
        <div>
          <label className="block text-sm mb-1 text-gray-900 dark:text-white">Member List</label>
          <div className="flex items-start gap-2">
            <select
              className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-500"
              value={memberListId}
              disabled={submittedResponses > 0}
              onChange={(e) => {
              const nextId = e.target.value
              if (nextId === memberListId) return
              const ok = window.confirm('Changing the member list will affect which members receive this survey. Continue?')
              if (!ok) return
              const name = lists.find(l => l.id === nextId)?.name || ''
              setMemberListId(nextId)
              setMemberListName(name)
            }}
          >
            <option value="" disabled>Select a member list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
            </select>
            {submittedResponses > 0 && (
              <span className="text-xs mt-2 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300" title="List locked after submissions">Locked</span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {submittedResponses > 0
              ? `Member list locked (${submittedResponses}/${totalResponses} responses submitted).`
              : totalResponses > 0
              ? `${submittedResponses}/${totalResponses} responses submitted. You can still change the list until submissions begin.`
              : 'No responses yet.'}
          </p>
        </div>
        <div>
          <label className="block text-sm text-gray-900 dark:text-white">Title</label>
          <input className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-900 dark:text-white">Description</label>
          <textarea className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm text-gray-900 dark:text-white">Opens At</label>
            <input type="datetime-local" className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={opensAt} onChange={e => setOpensAt(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-900 dark:text-white">Closes At</label>
            <input type="datetime-local" className="border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={closesAt} onChange={e => setClosesAt(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-900 dark:text-white mb-1">Minimum Responses Required (Optional)</label>
          <div className="flex items-center gap-4 mb-2">
            <input
              type="number"
              min="0"
              value={minResponses}
              onChange={e => setMinResponses(e.target.value)}
              disabled={minResponsesAll}
              className="flex-1 border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={minResponsesAll ? (memberListId ? `${currentMemberCount} members` : 'Select a member list first') : 'Leave empty for no minimum'}
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                id="minResponsesAllEdit"
                checked={minResponsesAll}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setMinResponsesAll(checked);
                  if (checked) {
                    if (memberListId) {
                      setMinResponses(String(currentMemberCount));
                    } else {
                      setMinResponses('');
                    }
                  }
                }}
                className="w-4 h-4 text-blue-500"
              />
              <label htmlFor="minResponsesAllEdit" className="ml-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                All Members
              </label>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {minResponsesAll 
              ? (memberListId 
                  ? `Minimum will automatically match the total member count (${currentMemberCount}) and adjust when members are added`
                  : 'Please select a member list first')
              : 'If specified, the survey status will show progress towards this goal'}
          </p>
        </div>
        <div>
          <label className="block text-sm mb-2 text-gray-900 dark:text-white">
            Questions
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              ({submittedResponses} of {totalResponses} responses submitted)
            </span>
          </label>
          {submittedResponses > 0 ? (
            <div className="space-y-3">
              <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded p-3 mb-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  🔒 Questions cannot be edited after responses have been submitted.
                </p>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="border border-gray-300 dark:border-gray-600 rounded p-4 bg-gray-50 dark:bg-gray-800">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{q.text}</h4>
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 rounded">{q.type}</span>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Options:</p>
                      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300">
                        {q.options.map((opt: string, idx: number) => (
                          <li key={idx}>{opt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {q.maxSelections && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Max selections: {q.maxSelections}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <p className="text-sm text-blue-800">
                  ✏️ You can add, edit, or remove questions below. Changes will be saved when you click "Update Survey".
                </p>
              </div>
              <SurveyBuilder onChange={setQuestions} initialQuestions={questions} />
            </div>
          )}
        </div>
        <button 
          className={`px-4 py-2 rounded font-medium transition-colors ${
            hasChanges 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          disabled={!hasChanges}
        >
          Update Survey
        </button>
      </form>
      {status && <div className="mt-4 text-green-600">{status}</div>}
    </main>
  )
}
