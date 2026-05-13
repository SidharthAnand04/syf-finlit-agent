"use client";

import { AdminProvider, useAdmin } from "./context";
import { LoginGate } from "./components/LoginGate";
import { AdminShell } from "./components/AdminShell";
import { LoadingState } from "@/components/ui/state";

function AdminGate({ children }: { children: React.ReactNode }) {
  const { token, isVerifying } = useAdmin();

  if (isVerifying) {
    return (
      <div className="app-canvas fixed inset-0 flex items-center justify-center font-sans">
        <div className="glass-panel-dark rounded-glass px-8 py-4">
          <LoadingState label="Verifying session..." />
        </div>
      </div>
    );
  }

  if (!token) return <LoginGate />;

  return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminGate>{children}</AdminGate>
    </AdminProvider>
  );
}
