"use client";

/**
 * Admin page – Knowledge Base Management
 *
 * Gated by an inline token entry so the ADMIN_TOKEN is never baked into
 * the JS bundle.  The token is kept only in React state (in-memory) and
 * is cleared on page reload.
 *
 * URL: /admin
 */

import { useEffect, useState, useRef } from "react";
import { adminApi, Source, IngestionRun } from "@/lib/api";

// ──────────────────────────────────────────────
// Tiny inline styles – no external CSS deps
// ──────────────────────────────────────────────
const S = {
  page: {
    fontFamily: "system-ui, sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    padding: "24px 16px",
    color: "#111",
  } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4 } as React.CSSProperties,
  h2: { fontSize: 16, fontWeight: 600, marginTop: 28, marginBottom: 10 } as React.CSSProperties,
  card: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 10,
    background: "#fafafa",
  } as React.CSSProperties,
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const },
  input: {
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 14,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  btn: (color = "#0070f3") =>
    ({
      border: "none",
      borderRadius: 6,
      padding: "7px 14px",
      fontSize: 13,
      cursor: "pointer",
      background: color,
      color: "#fff",
      whiteSpace: "nowrap",
    } as React.CSSProperties),
  btnOutline: {
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    background: "#fff",
    color: "#333",
    whiteSpace: "nowrap",
  } as React.CSSProperties,
  badge: (status: string | null) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background:
      status === "ok" ? "#d1fae5" :
      status === "error" ? "#fee2e2" :
      status === "pending" ? "#fef3c7" : "#e5e7eb",
    color:
      status === "ok" ? "#065f46" :
      status === "error" ? "#991b1b" :
      status === "pending" ? "#92400e" : "#374151",
  } as React.CSSProperties),
  mono: { fontFamily: "monospace", fontSize: 12, color: "#555" } as React.CSSProperties,
  err: { color: "#dc2626", fontSize: 13, marginTop: 4 } as React.CSSProperties,
  ok: { color: "#059669", fontSize: 13, marginTop: 4 } as React.CSSProperties,
};

// ──────────────────────────────────────────────
// Token gate
// ──────────────────────────────────────────────
function TokenGate({ onAuth }: { onAuth: (t: string) => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  return (
    <div style={{ ...S.page, maxWidth: 400, marginTop: 80 }}>
      <h1 style={S.h1}>Admin Login</h1>
      <p style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>
        Enter your ADMIN_TOKEN to continue.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!val.trim()) { setErr("Token required."); return; }
          onAuth(val.trim());
        }}
      >
        <div style={S.row}>
          <input
            type="password"
            placeholder="ADMIN_TOKEN"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            style={S.input}
            autoFocus
          />
          <button type="submit" style={S.btn()}>Enter</button>
        </div>
        {err && <p style={S.err}>{err}</p>}
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// Source row component
// ──────────────────────────────────────────────
function SourceRow({
  source,
  token,
  onRefresh,
}: {
  source: Source;
  token: string;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setMsg(null);
    try {
      await adminApi.toggleEnabled(token, source.id, !source.enabled);
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function ingest() {
    setBusy(true); setMsg(null);
    try {
      const res = await adminApi.ingestOne(token, source.id);
      setMsg(`✓ Done — ${(res as any).chunks_stored ?? 0} chunks stored.`);
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function del() {
    if (!confirm(`Delete "${source.name}"? This removes all its chunks.`)) return;
    setBusy(true); setMsg(null);
    try {
      await adminApi.deleteSource(token, source.id);
      onRefresh();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  const tag = source.type === "url" ? "🔗 URL" : "📄 PDF";
  const fetched = source.last_fetched_at
    ? new Date(source.last_fetched_at).toLocaleString()
    : "Never";

  return (
    <div style={S.card}>
      <div style={S.row}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
          {tag} &nbsp;{source.name}
          {!source.enabled && (
            <span style={{ marginLeft: 8, color: "#888", fontWeight: 400 }}>(disabled)</span>
          )}
        </span>
        <span style={S.badge(source.doc_status)}>{source.doc_status ?? "unindexed"}</span>
        <button style={S.btnOutline} disabled={busy} onClick={toggle}>
          {source.enabled ? "Disable" : "Enable"}
        </button>
        <button style={S.btn("#059669")} disabled={busy} onClick={ingest}>
          {busy ? "…" : "Refresh"}
        </button>
        <button style={S.btn("#dc2626")} disabled={busy} onClick={del}>
          Delete
        </button>
      </div>
      {source.url && (
        <p style={{ ...S.mono, marginTop: 4 }}>
          {source.url}
        </p>
      )}
      <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
        Last fetched: {fetched}
        {source.chunk_count != null && ` · ${source.chunk_count} chunks`}
      </p>
      {source.doc_error && (
        <p style={S.err}>Error: {source.doc_error}</p>
      )}
      {msg && <p style={msg.startsWith("✓") ? S.ok : S.err}>{msg}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────
// Main admin page
// ──────────────────────────────────────────────
function AdminPage({ token }: { token: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);

  // Add URL form
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlMsg, setUrlMsg] = useState<string | null>(null);

  // Upload PDF form
  const [pdfName, setPdfName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);

  // Ingest all
  const [ingestBusy, setIngestBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        adminApi.listSources(token),
        adminApi.listRuns(token),
      ]);
      setSources(s);
      setRuns(r);
    } catch (e: any) {
      setGlobalMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlBusy(true); setUrlMsg(null);
    try {
      await adminApi.addUrl(token, newName, newUrl);
      setNewName(""); setNewUrl("");
      setUrlMsg("✓ URL source added.");
      await load();
    } catch (err: any) { setUrlMsg(err.message); }
    finally { setUrlBusy(false); }
  }

  async function uploadPdf(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) { setPdfMsg("Select a PDF file."); return; }
    setPdfBusy(true); setPdfMsg(null);
    try {
      await adminApi.uploadPdf(token, pdfName || pdfFile.name, pdfFile);
      setPdfName(""); setPdfFile(null);
      setPdfMsg("✓ PDF uploaded. Run ingestion to index it.");
      await load();
    } catch (err: any) { setPdfMsg(err.message); }
    finally { setPdfBusy(false); }
  }

  async function ingestAll() {
    setIngestBusy(true); setGlobalMsg(null);
    try {
      const res = await adminApi.ingestAll(token);
      setGlobalMsg(
        `✓ Ingestion complete — ${(res as any).ok ?? 0} ok, ` +
        `${(res as any).skipped ?? 0} skipped, ` +
        `${(res as any).errors ?? 0} errors.`
      );
      await load();
    } catch (e: any) { setGlobalMsg(e.message); }
    finally { setIngestBusy(false); }
  }

  return (
    <div style={S.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={S.h1}>Knowledge Base Admin</h1>
          <p style={{ fontSize: 13, color: "#555", margin: 0 }}>
            Manage sources, trigger ingestion, and view run history.
          </p>
        </div>
        <button
          style={S.btn("#6366f1")}
          disabled={ingestBusy}
          onClick={ingestAll}
        >
          {ingestBusy ? "Running…" : "▶ Ingest All"}
        </button>
      </div>
      {globalMsg && (
        <p style={globalMsg.startsWith("✓") ? S.ok : S.err}>{globalMsg}</p>
      )}

      {/* ── Sources list ── */}
      <h2 style={S.h2}>Sources ({sources.length})</h2>
      {loading ? (
        <p style={{ color: "#888", fontSize: 14 }}>Loading…</p>
      ) : sources.length === 0 ? (
        <p style={{ color: "#888", fontSize: 14 }}>No sources yet. Add one below.</p>
      ) : (
        sources.map((s) => (
          <SourceRow key={s.id} source={s} token={token} onRefresh={load} />
        ))
      )}

      {/* ── Add URL ── */}
      <h2 style={S.h2}>Add URL Source</h2>
      <form onSubmit={addUrl}>
        <div style={{ ...S.row, marginBottom: 8 }}>
          <input
            style={S.input}
            placeholder="Name (e.g. Synchrony Credit Cards)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <input
            style={{ ...S.input, flex: 2 }}
            placeholder="https://…"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            type="url"
            required
          />
          <button type="submit" style={S.btn()} disabled={urlBusy}>
            {urlBusy ? "…" : "Add"}
          </button>
        </div>
        {urlMsg && <p style={urlMsg.startsWith("✓") ? S.ok : S.err}>{urlMsg}</p>}
      </form>

      {/* ── Upload PDF ── */}
      <h2 style={S.h2}>Upload PDF Source</h2>
      <form onSubmit={uploadPdf}>
        <div style={{ ...S.row, marginBottom: 8 }}>
          <input
            style={S.input}
            placeholder="Name (optional, defaults to filename)"
            value={pdfName}
            onChange={(e) => setPdfName(e.target.value)}
          />
          <input
            type="file"
            accept=".pdf"
            style={{ fontSize: 13 }}
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" style={S.btn()} disabled={pdfBusy}>
            {pdfBusy ? "Uploading…" : "Upload"}
          </button>
        </div>
        {pdfMsg && <p style={pdfMsg.startsWith("✓") ? S.ok : S.err}>{pdfMsg}</p>}
      </form>

      {/* ── Recent runs ── */}
      <h2 style={S.h2}>Recent Ingestion Runs</h2>
      {runs.length === 0 ? (
        <p style={{ color: "#888", fontSize: 14 }}>No runs yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "6px 10px" }}>ID</th>
                <th style={{ padding: "6px 10px" }}>Started</th>
                <th style={{ padding: "6px 10px" }}>Duration</th>
                <th style={{ padding: "6px 10px" }}>Status</th>
                <th style={{ padding: "6px 10px" }}>Total</th>
                <th style={{ padding: "6px 10px" }}>OK</th>
                <th style={{ padding: "6px 10px" }}>Skipped</th>
                <th style={{ padding: "6px 10px" }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const dur = r.finished_at
                  ? Math.round(
                      (new Date(r.finished_at).getTime() -
                        new Date(r.started_at).getTime()) /
                        1000
                    ) + "s"
                  : "…";
                const s = r.summary as any;
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 10px" }}>{r.id}</td>
                    <td style={{ padding: "6px 10px" }}>
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "6px 10px" }}>{dur}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={S.badge(r.status)}>{r.status}</span>
                    </td>
                    <td style={{ padding: "6px 10px" }}>{s.total ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{s.ok ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{s.skipped ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{s.errors ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Top-level export: token gate
// ──────────────────────────────────────────────
export default function AdminRoute() {
  const [token, setToken] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState("");

  async function handleAuth(t: string) {
    // Quick validation: try listSources
    try {
      await adminApi.listSources(t);
      setToken(t);
      setAuthErr("");
    } catch (e: any) {
      setAuthErr(e.message.includes("401") || e.message.includes("Invalid")
        ? "Invalid token."
        : e.message);
    }
  }

  if (!token) {
    return (
      <div>
        <TokenGate onAuth={handleAuth} />
        {authErr && (
          <p style={{ textAlign: "center", color: "#dc2626", fontSize: 13 }}>
            {authErr}
          </p>
        )}
      </div>
    );
  }

  return <AdminPage token={token} />;
}
