"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "../context";
import { C, FONT } from "../components/tokens";
import { PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "../components/StatusBadge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

function DataGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-data-group">
      <div className="admin-data-group-header">
        <div>
          <h2 className="admin-data-group-title">{title}</h2>
          {subtitle && <p className="admin-data-group-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="admin-data-group-body">{children}</div>
    </section>
  );
}

function InfoRow({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(140px, 190px) minmax(0, 1fr)",
      gap: 16,
      padding: "13px 0",
      borderBottom: `1px solid ${C.dividerWarm}`,
      alignItems: "start",
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.charcoal, fontFamily: FONT }}>
        {label}
      </div>
      <div>
        <div style={{ fontSize: 13, color: C.charcoal, fontFamily: FONT, minWidth: 0 }}>{value}</div>
        {note && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: FONT, lineHeight: 1.5 }}>{note}</div>}
      </div>
    </div>
  );
}

function CodePill({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontSize: 12, background: C.inset, border: `1px solid ${C.insetBorder}`, padding: "3px 8px", borderRadius: 8, fontFamily: "monospace", wordBreak: "break-all" }}>
      {children}
    </code>
  );
}

export default function SettingsPage() {
  const { token } = useAdmin();
  const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "error">("checking");
  const [healthMsg, setHealthMsg] = useState("");

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        const data = await res.json();
        setHealthStatus(data.status === "ok" ? "ok" : "error");
        setHealthMsg(data.status === "ok" ? "Backend is reachable." : `Backend returned: ${data.status}`);
      } catch (e: unknown) {
        setHealthStatus("error");
        setHealthMsg(e instanceof Error ? e.message : "Could not connect to backend.");
      }
    };
    check();
  }, []);

  const backendConfigured = !!process.env.NEXT_PUBLIC_BACKEND_URL;

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <PageHeader title="Settings" subtitle="System configuration and status overview." />

      <div className="admin-page-stack">
        <DataGroup title="Environment" subtitle="Runtime configuration used by the frontend and admin console.">
          <InfoRow
            label="Backend URL"
            value={<CodePill>{BACKEND_URL}</CodePill>}
            note={!backendConfigured ? "NEXT_PUBLIC_BACKEND_URL is not set, so localhost is used." : "Configured via NEXT_PUBLIC_BACKEND_URL."}
          />
          <InfoRow
            label="Admin Token"
            value={<StatusBadge status={token ? "ok" : "disabled"} />}
            note="Token is stored in localStorage for this browser session."
          />
          {!backendConfigured && (
            <div className="admin-alert" style={{ margin: "10px 0 0", color: C.orange, background: C.orangeBg, border: "1px solid #fed7aa" }}>
              Set <CodePill>NEXT_PUBLIC_BACKEND_URL</CodePill> in `.env.local` or Vercel environment settings.
            </div>
          )}
        </DataGroup>

        <DataGroup title="Backend Health" subtitle="Connectivity checks for the API service that powers admin actions.">
          <InfoRow
            label="Status"
            value={healthStatus === "checking" ? "Checking..." : <StatusBadge status={healthStatus === "ok" ? "ok" : "error"} />}
            note={healthMsg}
          />
          <InfoRow
            label="Endpoint"
            value={<a href={`${BACKEND_URL}/health`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 12, fontFamily: "monospace" }}>{BACKEND_URL}/health</a>}
          />
          <InfoRow
            label="Docs"
            value={<a href={`${BACKEND_URL}/docs`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 12, fontFamily: "monospace" }}>{BACKEND_URL}/docs</a>}
            note="FastAPI interactive API docs."
          />
        </DataGroup>

        <DataGroup title="Session" subtitle="Local browser session controls for this admin console.">
          <InfoRow label="Token Storage" value="localStorage" note="Clear it by signing out or using the control below." />
          <InfoRow
            label="Current Token"
            value={<span style={{ fontFamily: "monospace", fontSize: 12, color: C.muted }}>{token ? `${token.slice(0, 8)}${"*".repeat(8)} (hidden)` : "None"}</span>}
          />
          <button
            className="admin-btn-ghost"
            style={{ marginTop: 14, fontSize: 12 }}
            onClick={() => {
              if (typeof window !== "undefined") localStorage.removeItem("syf-admin-token");
              window.location.reload();
            }}
          >
            Clear Session
          </button>
        </DataGroup>

        <DataGroup title="Quick Links" subtitle="Frequently used routes and service endpoints.">
          <InfoRow label="Chat Interface" value={<a href="/chat" style={{ color: C.blue, fontSize: 13 }}>/chat</a>} />
          <InfoRow label="Insights" value={<a href="/admin/insights" style={{ color: C.blue, fontSize: 13 }}>/admin/insights</a>} />
          <InfoRow label="API Docs" value={<a href={`${BACKEND_URL}/docs`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 13 }}>Backend /docs</a>} />
        </DataGroup>
      </div>
    </div>
  );
}
