"use client"
import React, { useState } from 'react'
import { questionSchema } from '@/lib/validation/schemas'

type Question = {
  type: string
  text: string
  options?: string[]
  maxSelections?: number
  required?: boolean
  order: number
}


interface SurveyBuilderProps {
  onChange: (questions: Question[]) => void
  initialQuestions?: Question[]
}

export default function SurveyBuilder({ onChange, initialQuestions }: SurveyBuilderProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions || [])
  const [text, setText] = useState('')
  const [type, setType] = useState('MULTI_SINGLE')
  const [options, setOptions] = useState('')
  const [maxSelections, setMaxSelections] = useState('')
  const [required, setRequired] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // If initialQuestions changes (e.g., when editing), update state
  React.useEffect(() => {
    if (initialQuestions) setQuestions(initialQuestions)
  }, [initialQuestions])

  function addQuestion() {
    const opts = type.startsWith('MULTI') ? options.split(',').map(s => s.trim()).filter(Boolean) : undefined
    const maxSel = type === 'MULTI_MULTI' && maxSelections ? parseInt(maxSelections) : undefined
    const q: Question = { type, text, options: opts, maxSelections: maxSel, required, order: questions.length }
    try { questionSchema.parse(q) } catch { return }
    const next = [...questions, q]
    setQuestions(next)
    onChange(next)
    setText('')
    setOptions('')
    setMaxSelections('')
    setRequired(false)
  }

  function startEdit(idx: number) {
    const q = questions[idx]
    setText(q.text)
    setType(q.type)
    setOptions(q.options ? q.options.join(', ') : '')
    setMaxSelections(q.maxSelections ? String(q.maxSelections) : '')
    setRequired(q.required || false)
    setEditingIndex(idx)
  }

  function updateQuestion() {
    if (editingIndex === null) return
    const opts = type.startsWith('MULTI') ? options.split(',').map(s => s.trim()).filter(Boolean) : undefined
    const maxSel = type === 'MULTI_MULTI' && maxSelections ? parseInt(maxSelections) : undefined
    const q: Question = { type, text, options: opts, maxSelections: maxSel, required, order: editingIndex }
    try { questionSchema.parse(q) } catch { return }
    const next = [...questions]
    next[editingIndex] = q
    setQuestions(next)
    onChange(next)
    cancelEdit()
  }

  function cancelEdit() {
    setText('')
    setType('MULTI_SINGLE')
    setOptions('')
    setMaxSelections('')
    setRequired(false)
    setEditingIndex(null)
  }

  function remove(idx: number) {
    const next = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i }))
    setQuestions(next)
    onChange(next)
    if (editingIndex === idx) cancelEdit()
  }

  return (
    <div>
      <ul className="space-y-3 mb-4">
        {questions.map((q, i) => (
          <li key={i} className={`border rounded-lg p-4 shadow-sm ${editingIndex === i ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}>
            {editingIndex === i ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300">Edit Question</h3>
                  <button 
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium" 
                    type="button" 
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
                <input className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Question text" value={text} onChange={e => setText(e.target.value)} />
                <select className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value={type} onChange={e => setType(e.target.value)}>
                  <option value="MULTI_SINGLE">Multiple Choice (Single)</option>
                  <option value="MULTI_MULTI">Multiple Choice (Multi)</option>
                  <option value="YES_NO">Yes/No</option>
                  <option value="RATING_5">Rating (1-5)</option>
                  <option value="PARAGRAPH">Paragraph</option>
                </select>
                {(type === 'MULTI_SINGLE' || type === 'MULTI_MULTI') && (
                  <input className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Options (comma separated)" value={options} onChange={e => setOptions(e.target.value)} />
                )}
                {type === 'MULTI_MULTI' && (
                  <input 
                    className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white" 
                    type="number" 
                    min="1" 
                    placeholder="Max selections allowed (optional)" 
                    value={maxSelections} 
                    onChange={e => setMaxSelections(e.target.value)} 
                  />
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={required} 
                    onChange={e => setRequired(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Required question</span>
                </label>
                <div className="flex gap-2">
                  <button 
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" 
                    type="button" 
                    onClick={updateQuestion}
                  >
                    Update Question
                  </button>
                  <button 
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" 
                    type="button" 
                    onClick={() => remove(i)}
                  >
                    Delete Question
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {q.text}
                      {q.required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
                    </span>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">{q.type}</span>
                    {q.required && (
                      <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  {q.options && q.options.length > 0 && (
                    <div className="mt-2 ml-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Options:</p>
                      <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                        {q.options.map((opt, idx) => (
                          <li key={idx}>{opt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {q.maxSelections && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 ml-4">
                      <span className="font-medium">Max selections:</span> {q.maxSelections}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button 
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium" 
                    type="button" 
                    onClick={() => startEdit(i)}
                  >
                    Edit
                  </button>
                  <button 
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium" 
                    type="button" 
                    onClick={() => remove(i)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      
      <div className={`space-y-2 p-4 rounded-lg border ${editingIndex !== null ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-50 pointer-events-none' : 'bg-green-50 dark:bg-green-900 border-green-300 dark:border-green-700'}`}>
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Add New Question</h3>
        <input className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-500" placeholder="Question text" value={text} onChange={e => setText(e.target.value)} disabled={editingIndex !== null} />
        <select className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-500" value={type} onChange={e => setType(e.target.value)} disabled={editingIndex !== null}>
          <option value="MULTI_SINGLE">Multiple Choice (Single)</option>
          <option value="MULTI_MULTI">Multiple Choice (Multi)</option>
          <option value="YES_NO">Yes/No</option>
          <option value="RATING_5">Rating (1-5)</option>
          <option value="PARAGRAPH">Paragraph</option>
        </select>
        {(type === 'MULTI_SINGLE' || type === 'MULTI_MULTI') && (
          <input className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-500" placeholder="Options (comma separated)" value={options} onChange={e => setOptions(e.target.value)} disabled={editingIndex !== null} />
        )}
        {type === 'MULTI_MULTI' && (
          <input 
            className="border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-500" 
            type="number" 
            min="1" 
            placeholder="Max selections allowed (optional)" 
            value={maxSelections} 
            onChange={e => setMaxSelections(e.target.value)}
            disabled={editingIndex !== null}
          />
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            checked={required} 
            onChange={e => setRequired(e.target.checked)}
            className="w-4 h-4"
            disabled={editingIndex !== null}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Required question</span>
        </label>
        <button 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" 
          type="button" 
          onClick={addQuestion}
          disabled={editingIndex !== null}
        >
          Add Question
        </button>
      </div>
    </div>
  )
}
