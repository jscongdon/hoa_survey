"use client"
import React from 'react'
import Papa from 'papaparse'

export default function CsvUpload({ onData }: { onData: (rows: any[]) => void }) {
  const handleFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        onData(results.data as any[])
      }
    })
  }

  return (
    <div>
      <input type="file" accept="text/csv" onChange={handleFile} />
    </div>
  )
}
