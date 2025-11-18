"use client"
import React from 'react'

export default function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
      <div
        className="h-3 bg-blue-600"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  )
}
