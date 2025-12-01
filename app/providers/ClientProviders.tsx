"use client";

import React from "react";
import { ErrorProvider } from "@/lib/error/ErrorContext";
import { AuthProvider } from "@/lib/auth/AuthContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorProvider>
      <AuthProvider>{children}</AuthProvider>
    </ErrorProvider>
  );
}
