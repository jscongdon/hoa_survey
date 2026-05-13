"use client";

import React, { useEffect, useState } from 'react';
import { Toast } from './Toast';
import { AppError } from '@/lib/error/types';

interface ToastContainerProps {
  errors: AppError[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ errors, onDismiss }: ToastContainerProps) {
  const [visibleErrors, setVisibleErrors] = useState<AppError[]>([]);

  useEffect(() => {
    setVisibleErrors(errors);
  }, [errors]);

  const handleDismiss = (id: string) => {
    setVisibleErrors(prev => prev.filter(error => error.id !== id));
    onDismiss(id);
  };

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {visibleErrors.map(error => (
        <Toast
          key={error.id}
          error={error}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}