"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi, Source, QueryChunk } from "@/lib/api";
import { useAdmin } from "../context";
import { C, FONT, GLASS_CARD_STYLE } from "../components/tokens";
import { StatusBadge } from "../components/StatusBadge";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";

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

// ── Source row ────────────────────────────────────────────────────────────────

function SourceRow({ source, token, onRefresh }: { source: Source; token: string; onRefresh: () => void }) {
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [confirming, setConfirm] = useState(false);

  async function toggle() {
    setBusy(true); setMsg(null);
    try { await adminApi.toggleEnabled(token, source.id, !source.enabled); onRefresh(); }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : "Error", ok: false }); }
    finally { setBusy(false); }
  }

  async function ingest() {
    setBusy(true); setMsg(null);
    try {
      const res = await adminApi.ingestOne(token, source.id) as Record<string, unknown>;
      setMsg({ text: `Done — ${res.chunks_stored ?? 0} chunks stored.`, ok: true });
      onRefresh();
    } catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : "Error", ok: false }); }
    finally { setBusy(false); }
  }

  async function del() {
    setBusy(true); setMsg(null); setConfirm(false);
    try { await adminApi.deleteSource(token, source.id); onRefresh(); }
    catch (e: unknown) { setMsg({ text: e instanceof Error ? e.message : "Error", ok: false }); }
    finally { setBusy(false); }
  }

  const typeBg    = source.type === "url" ? "#dbeafe" : "#ede9fe";
  const typeColor = source.type === "url" ? "#1d4ed8" : "#6d28d9";

  return (
    <tr style={{ opacity: source.enabled ? 1 : 0.6 }}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: typeBg, color: typeColor, flexShrink: 0 }}>
            {source.type.toUpperCase()}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.charcoal, fontFamily: FONT }}>{source.name}</div>
            {source.url && (
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginTop: 1 }}>
                <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: "none" }}>
                  {source.url.length > 60 ? source.url.slice(0, 57) + "…" : source.url}
                </a>
              </div>
            )}
            {source.doc_error && (
              <div style={{ fontSize: 11, color: C.red, marginTop: 2, fontFamily: FONT }}>
                {source.doc_error}
              </div>
            )}
            {msg && (
              <div style={{ fontSize: 11, color: msg.ok ? C.green : C.red, marginTop: 2, fontFamily: FONT }}>
                {msg.text}
              </div>
            )}
          </div>
        </div>
      </td>
      <td><StatusBadge status={source.enabled ? (source.doc_status ?? "unindexed") : "disabled"} /></td>
      <td style={{ color: C.muted }}>{source.chunk_count != null ? source.chunk_count.toLocaleString() : "—"}</td>
      <td style={{ color: C.muted }}>{relTime(source.last_fetched_at)}</td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          <button className="admin-btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={busy} onClick={toggle}>
            {source.enabled ? "Disable" : "Enable"}
          </button>
          <button className="admin-btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }} disabled={busy} onClick={ingest}>
            {busy ? "…" : "Refresh"}
          </button>
          {confirming ? (
            <>
              <span style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT }}>Confirm?</span>
              <button className="admin-btn-danger" style={{ fontSize: 12, padding: "5px 10px" }} disabled={busy} onClick={del}>Yes</button>
              <button className="admin-btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setConfirm(false)}>No</button>
            </>
          ) : (
            <button className="admin-btn-danger" style={{ fontSize: 12, padding: "5px 12px" }} disabled={busy} onClick={() => setConfirm(true)}>
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Add source ────────────────────────────────────────────────────────────────

function AddSource({ token, onRefresh }: { token: string; onRefresh: () => void }) {
  const [tab, setTab] = useState<"url" | "pdf">("url");

  const [urlName, setUrlName] = useState("");
  const [urlVal,  setUrlVal]  = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlMsg,  setUrlMsg]  = useState<{ text: string; ok: boolean } | null>(null);

  const [pdfName, setPdfName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg,  setPdfMsg]  = useState<{ text: string; ok: boolean } | null>(null);

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlBusy(true); setUrlMsg(null);
    try {
      await adminApi.addUrl(token, urlName, urlVal);
      setUrlName(""); setUrlVal("");
      setUrlMsg({ text: "URL source added. Run ingestion to index it.", ok: true });
      onRefresh();
    } catch (e: unknown) { setUrlMsg({ text: e instanceof Error ? e.message : "Error", ok: false }); }
    finally { setUrlBusy(false); }
  }

  async function uploadPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) { setPdfMsg({ text: "Select a PDF file.", ok: false }); return; }
    setPdfBusy(true); setPdfMsg(null);
    try {
      await adminApi.uploadPdf(token, pdfName || pdfFile.name, pdfFile);
      setPdfName(""); setPdfFile(null);
      setPdfMsg({ text: "PDF uploaded. Run ingestion to index it.", ok: true });
      onRefresh();
    } catch (e: unknown) { setPdfMsg({ text: e instanceof Error ? e.message : "Error", ok: false }); }
    finally { setPdfBusy(false); }
  }

  return (
    <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${C.dividerWarm}`, padding: "0 16px", background: C.insetMuted, borderRadius: "14px 14px 0 0" }}>
        {(["url", "pdf"] as const).map((t) => (
          <button key={t} className={`admin-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "url" ? "URL Source" : "PDF Upload"}
          </button>
        ))}
      </div>
      <div style={{ padding: "18px 20px" }}>
        {tab === "url" && (
          <form onSubmit={addUrl}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input className="admin-input" style={{ flex: "1 1 180px" }} placeholder="Name (e.g. Synchrony FAQs)" value={urlName} onChange={(e) => setUrlName(e.target.value)} required />
              <input className="admin-input" style={{ flex: "2 1 280px" }} placeholder="https://…" type="url" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} required />
              <button type="submit" className="admin-btn-secondary" disabled={urlBusy}>{urlBusy ? "Adding…" : "Add URL"}</button>
            </div>
            {urlMsg && <div style={{ fontSize: 12, color: urlMsg.ok ? C.green : C.red, marginTop: 8, fontFamily: FONT }}>{urlMsg.text}</div>}
          </form>
        )}
        {tab === "pdf" && (
          <form onSubmit={uploadPdf}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input className="admin-input" style={{ flex: "1 1 200px" }} placeholder="Name (optional, defaults to filename)" value={pdfName} onChange={(e) => setPdfName(e.target.value)} />
              <input type="file" accept=".pdf" style={{ fontSize: 13, fontFamily: FONT }} onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
              <button type="submit" className="admin-btn-secondary" disabled={pdfBusy}>{pdfBusy ? "Uploading…" : "Upload PDF"}</button>
            </div>
            {pdfMsg && <div style={{ fontSize: 12, color: pdfMsg.ok ? C.green : C.red, marginTop: 8, fontFamily: FONT }}>{pdfMsg.text}</div>}
          </form>
        )}
      </div>
    </div>
  );
}

// ── Query tester ──────────────────────────────────────────────────────────────

function QueryTester({ token }: { token: string }) {
  const [query,   setQuery]   = useState("");
  const [k,       setK]       = useState(4);
  const [busy,    setBusy]    = useState(false);
  const [results, setResults] = useState<QueryChunk[] | null>(null);
  const [err,     setErr]     = useState<string | null>(null);
  const [open,    setOpen]    = useState(false);

  async function run() {
    if (!query.trim()) return;
    setBusy(true); setErr(null); setResults(null);
    try {
      const res = await adminApi.queryTest(token, query.trim(), k);
      setResults(res.chunks);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 600,
          color: C.charcoal,
        }}
      >
        Retrieval Query Tester
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${C.dividerWarm}` }}>
          <p style={{ fontSize: 12, color: C.muted, margin: "14px 0 12px", fontFamily: FONT }}>
            Run a query to inspect which chunks the retrieval pipeline returns.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="admin-input"
              style={{ flex: "1 1 300px" }}
              placeholder="Enter a test query…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            />
            <select className="admin-select" value={k} onChange={(e) => setK(Number(e.target.value))} style={{ width: 80 }}>
              {[1,2,3,4,5,6,8,10].map((n) => <option key={n} value={n}>Top {n}</option>)}
            </select>
            <button className="admin-btn-secondary" disabled={busy || !query.trim()} onClick={run}>
              {busy ? "Running…" : "Run"}
            </button>
          </div>

          {err && <div style={{ fontSize: 12, color: C.red, marginTop: 8, fontFamily: FONT }}>{err}</div>}

          {results !== null && results.length === 0 && (
            <p style={{ fontSize: 13, color: C.muted, marginTop: 12, fontFamily: FONT }}>No chunks retrieved. Try a different query.</p>
          )}

          {results && results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              {results.map((chunk) => {
                const pct = Math.min(100, Math.round(chunk.score * 100));
                return (
                  <div key={chunk.rank} style={{ background: "rgba(255,255,255,0.42)", border: `1px solid rgba(255,255,255,0.46)`, borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ background: C.charcoal, color: C.white, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        #{chunk.rank}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chunk.source}
                      </span>
                      <StatusBadge status={chunk.source_type === "website" ? "ok" : "pending"} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: C.insetMuted, border: `1px solid ${C.insetBorder}`, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: C.gold, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{chunk.score.toFixed(4)}</span>
                    </div>
                    {chunk.section_heading && (
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 5, fontStyle: "italic", fontFamily: FONT }}>
                        § {chunk.section_heading}{chunk.page_number != null ? ` · p.${chunk.page_number}` : ""}
                      </p>
                    )}
                    {chunk.url && (
                      <p style={{ fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
                        <a href={chunk.url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>{chunk.url}</a>
                      </p>
                    )}
                    <p style={{ fontSize: 12, color: "#444", marginTop: 7, lineHeight: 1.55, fontFamily: FONT, whiteSpace: "pre-wrap" }}>
                      {chunk.text_preview}{chunk.text_preview.length >= 400 && <span style={{ color: C.muted }}> …</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SourcesPage() {
  const { token } = useAdmin();
  const [sources,  setSources]  = useState<Source[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [ingestBusy, setIBusy]  = useState(false);
  const [globalMsg,  setGMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const s = await adminApi.listSources(token);
      setSources(s);
    } catch (e: unknown) {
      setGMsg({ text: e instanceof Error ? e.message : "Failed to load", ok: false });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function ingestAll() {
    if (!token) return;
    setIBusy(true); setGMsg(null);
    try {
      const res = await adminApi.ingestAll(token) as Record<string, unknown>;
      setGMsg({ text: `Ingestion complete — ${res.ok ?? 0} ok, ${res.skipped ?? 0} skipped, ${res.errors ?? 0} errors.`, ok: true });
      await load();
    } catch (e: unknown) {
      setGMsg({ text: e instanceof Error ? e.message : "Ingestion failed", ok: false });
    } finally {
      setIBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: C.white, fontFamily: FONT, margin: 0, letterSpacing: "-0.03em" }}>Knowledge Sources</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.66)", marginTop: 6, fontFamily: FONT }}>Manage the documents and URLs that power the chatbot.</p>
        </div>
        <button className="admin-btn-primary" onClick={ingestAll} disabled={ingestBusy || loading}>
          {ingestBusy ? "Running…" : "Ingest All"}
        </button>
      </div>

      {globalMsg && (
        <div style={{ fontSize: 13, color: globalMsg.ok ? C.green : C.red, background: globalMsg.ok ? C.greenBg : C.redBg, border: `1px solid ${globalMsg.ok ? "#bbf7d0" : C.redBorder}`, borderRadius: 7, padding: "9px 14px", marginBottom: 18, fontFamily: FONT, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          {globalMsg.text}
        </div>
      )}

      {/* Sources table */}
      <div className="admin-group-frame" style={{ marginBottom: 20 }}>
        <div className="admin-section-label">
          {loading ? "Sources" : `Sources (${sources.length})`}
        </div>
        {loading ? (
          <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18 }}>
            <LoadingState />
          </div>
        ) : sources.length === 0 ? (
          <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18 }}>
            <EmptyState title="No sources yet" description="Add a URL or upload a PDF to get started." />
          </div>
        ) : (
          <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, overflow: "hidden" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Chunks</th>
                  <th>Last Fetched</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <SourceRow key={s.id} source={s} token={token!} onRefresh={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add source */}
      <div className="admin-group-frame" style={{ marginBottom: 20 }}>
        <div className="admin-section-label">
          Add Source
        </div>
        {token && <AddSource token={token} onRefresh={load} />}
      </div>

      {/* Query tester */}
      <div className="admin-group-frame">
        <div className="admin-section-label">
          Debug Tools
        </div>
        {token && <QueryTester token={token} />}
      </div>
    </div>
  );
}
