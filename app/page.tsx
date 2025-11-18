'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import PageHeader from '@/components/PageHeader';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard or setup/login based on middleware logic
    router.push('/dashboard');
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-xl p-8">
        <PageHeader title="HOA Survey" />
        <p className="mt-4 text-slate-600">Loading...</p>
      </div>
    </main>
  );
}
