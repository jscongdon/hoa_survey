"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface AuthContextType {
  role: string | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Defensive guard: if executed on server unexpectedly, avoid using hooks.
  if (typeof window === "undefined") {
    return <>{children}</>;
  }

  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setRole(data.role || null);
      } else {
        setRole(null);
      }
    } catch (err) {
      console.error("Failed to fetch admin role:", err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  // Listen for auth state changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth-refresh") {
        refreshAuth();
      }
    };

    const handleFocus = () => {
      refreshAuth();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const value = {
    role,
    loading,
    refreshAuth,
    isAuthenticated: role !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return a safe fallback during server prerender so pages that import
    // `useAuth` don't crash. The real provider will hydrate on the client.
    return {
      role: null,
      loading: false,
      refreshAuth: async () => {},
      isAuthenticated: false,
    } as AuthContextType;
  }

  return context;
}
