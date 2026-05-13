"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { adminApi } from "@/lib/api";

interface AdminContextValue {
  token: string | null;
  isVerifying: boolean;
  authError: string;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

// Token stored in localStorage so the engineer doesn't re-login on every refresh.
// This is an internal admin tool; the token only gates the /admin API, not user data.
const STORAGE_KEY = "syf-admin-token";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken]       = useState<string | null>(null);
  const [isVerifying, setVfying] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      verify(saved)
        .catch(() => {/* invalid saved token — silently discard */})
        .finally(() => setVfying(false));
    } else {
      setVfying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(t: string): Promise<void> {
    await adminApi.listSources(t);
    setToken(t);
    localStorage.setItem(STORAGE_KEY, t);
  }

  async function signIn(t: string): Promise<void> {
    setVfying(true);
    setAuthError("");
    try {
      await verify(t);
    } catch (e: unknown) {
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      const msg = e instanceof Error ? e.message : String(e);
      setAuthError(
        msg.includes("401") || msg.includes("Invalid")
          ? "Invalid token. Please try again."
          : msg || "Authentication failed."
      );
      throw e;
    } finally {
      setVfying(false);
    }
  }

  function signOut() {
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setAuthError("");
  }

  return (
    <AdminContext.Provider value={{ token, isVerifying, authError, signIn, signOut }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
