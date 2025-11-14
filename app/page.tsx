'use client';

import Link from 'next/link';
import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-xl p-8">
        <h1 className="text-3xl font-bold">HOA Survey</h1>
        <p className="mt-4 text-slate-600">Admin Dashboard and survey management.</p>
        <div className="mt-6 space-x-4">
          <Link href="/login" className="text-blue-600 underline">Login</Link>
          <Link href="/dashboard" className="text-blue-600 underline">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
