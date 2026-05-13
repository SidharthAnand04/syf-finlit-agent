"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi, Source, IngestionRun } from "@/lib/api";
import { useAdmin } from "../context";
import { C, FONT, GLASS_CARD_STYLE } from "../components/tokens";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "@/components/ui/layout";

function relTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.charcoal, fontFamily: FONT, margin: 0, lineHeight: 1.2 }}>{title}</h1>
      <p style={{ fontSize: 13, color: C.muted, marginTop: 4, fontFamily: FONT }}>{sub}</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="admin-section-label">
      {label}
    </div>
  );
}

function IconSources() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}
function IconEnabled() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function IconChunks() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconRun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

export default function OverviewPage() {
  const { token } = useAdmin();
  const [sources, setSources]     = useState<Source[]>([]);
  const [runs, setRuns]           = useState<IngestionRun[]>([]);
  const [loading, setLoading]     = useState(true);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [globalMsg, setGlobalMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([adminApi.listSources(token), adminApi.listRuns(token)]);
      setSources(s);
      setRuns(r);
    } catch (e: unknown) {
      setGlobalMsg({ text: e instanceof Error ? e.message : "Failed to load", ok: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function ingestAll() {
    if (!token) return;
    setIngestBusy(true);
    setGlobalMsg(null);
    try {
      const res = await adminApi.ingestAll(token) as Record<string, unknown>;
      setGlobalMsg({
        text: `Ingestion complete — ${res.ok ?? 0} ok, ${res.skipped ?? 0} skipped, ${res.errors ?? 0} errors.`,
        ok: true,
      });
      await load();
    } catch (e: unknown) {
      setGlobalMsg({ text: e instanceof Error ? e.message : "Ingestion failed", ok: false });
    } finally {
      setIngestBusy(false);
    }
  }

  const enabledCount = sources.filter((s) => s.enabled).length;
  const totalChunks  = sources.reduce((sum, s) => sum + (s.chunk_count ?? 0), 0);
  const lastRun      = runs[0] ?? null;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: C.white, fontFamily: FONT, margin: 0, letterSpacing: "-0.03em" }}>Overview</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.66)", marginTop: 6, fontFamily: FONT }}>Knowledge base health at a glance.</p>
        </div>
        <button className="admin-btn-primary" onClick={ingestAll} disabled={ingestBusy || loading}>
          {ingestBusy ? "Running…" : "Ingest All Sources"}
        </button>
      </div>

      {globalMsg && (
        <div style={{
          fontSize: 13,
          color: globalMsg.ok ? C.green : C.red,
          background: globalMsg.ok ? C.greenBg : C.redBg,
          border: `1px solid ${globalMsg.ok ? "#bbf7d0" : C.redBorder}`,
          borderRadius: 7,
          padding: "9px 14px",
          marginBottom: 20,
          fontFamily: FONT,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}>
          {globalMsg.text}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Stats */}
          <div className="admin-group-frame" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            <StatCard label="Total Sources"    value={sources.length}           icon={<IconSources />} />
            <StatCard label="Enabled Sources"  value={enabledCount}             icon={<IconEnabled />} />
            <StatCard label="Chunks Indexed"   value={totalChunks.toLocaleString()} icon={<IconChunks />} />
            <StatCard
              label="Last Ingestion"
              value={lastRun ? relTime(lastRun.started_at) : "Never"}
              sub={lastRun ? `Status: ${lastRun.status}` : undefined}
              icon={<IconRun />}
            />
          </div>

          {/* Recent runs */}
          <SectionLabel label="Recent Ingestion Runs" />
          {runs.length === 0 ? (
            <div className="admin-data-group" style={{ borderRadius: 18, overflow: "hidden" }}>
              <EmptyState title="No runs yet" description="Run ingestion to index your knowledge sources." />
            </div>
          ) : (
            <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, overflow: "hidden" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    {["Started", "Duration", "Status", "Total", "OK", "Skipped", "Errors"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 10).map((r) => {
                    const dur = r.finished_at
                      ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
                      : "…";
                    const s = r.summary as Record<string, unknown>;
                    return (
                      <tr key={r.id}>
                        <td style={{ fontFamily: FONT }}>{relTime(r.started_at)}</td>
                        <td style={{ color: C.muted }}>{dur}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>{s.total != null ? String(s.total) : "—"}</td>
                        <td style={{ color: C.green, fontWeight: 600 }}>{s.ok != null ? String(s.ok) : "—"}</td>
                        <td style={{ color: C.muted }}>{s.skipped != null ? String(s.skipped) : "—"}</td>
                        <td style={{ color: Number(s.errors) > 0 ? C.red : C.muted, fontWeight: Number(s.errors) > 0 ? 600 : 400 }}>
                          {s.errors != null ? String(s.errors) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Source health summary */}
          {sources.length > 0 && (
            <>
              <SectionLabel label="Source Health" />
              <div className="admin-group-frame" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {sources.map((s) => (
                  <div key={s.id} style={{
                    ...GLASS_CARD_STYLE,
                    borderRadius: 16,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    opacity: s.enabled ? 1 : 0.55,
                  }}>
                    <div style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: s.doc_status === "ok" ? C.green : s.doc_status === "error" ? C.red : C.muted,
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.charcoal, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginTop: 1 }}>
                        {s.chunk_count != null ? `${s.chunk_count.toLocaleString()} chunks` : "Not indexed"}
                        {s.last_fetched_at ? ` · ${relTime(s.last_fetched_at)}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={s.enabled ? (s.doc_status ?? "unindexed") : "disabled"} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
