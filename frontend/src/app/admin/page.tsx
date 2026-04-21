"use client";

import { useEffect, useState, useCallback } from "react";
import { adminApi, Source, IngestionRun, PersonalityConfig, QueryChunk } from "@/lib/api";

// ── Shared design tokens (match chatbot globals.css) ─────────────────────────
const C = {
  gold:        "#FBC600",
  goldDark:    "#D9A800",
  goldSubtle:  "#fffae8",
  charcoal:    "#3B3C43",
  charcoalDark:"#2a2b30",
  border:      "#E0E1DF",
  bg:          "#F7F7F6",
  white:       "#ffffff",
  muted:       "#94969A",
  red:         "#dc2626",
  green:       "#059669",
  blue:        "#0057a8",
};

const FONT = "'Synchrony Sans', Arial, sans-serif";

const S = {
  page: {
    fontFamily: FONT,
    maxWidth: 1000,
    margin: "0 auto",
    padding: "24px 16px 48px",
    color: C.charcoal,
  } as React.CSSProperties,

  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4, fontFamily: FONT } as React.CSSProperties,
  h2: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 32,
    marginBottom: 12,
    paddingBottom: 7,
    borderBottom: `2px solid ${C.gold}`,
    display: "flex",
    alignItems: "center",
    gap: 8,
    letterSpacing: "0.01em",
    textTransform: "uppercase" as const,
    color: C.charcoal,
  } as React.CSSProperties,

  card: {
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 10,
    background: C.white,
    boxShadow: "0 1px 3px rgba(59,60,67,0.06)",
  } as React.CSSProperties,

  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const },

  input: {
    border: `1.5px solid ${C.border}`,
    borderRadius: 6,
    padding: "7px 11px",
    fontSize: 13,
    flex: 1,
    minWidth: 0,
    fontFamily: FONT,
    outline: "none",
    color: C.charcoal,
    background: C.bg,
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  textarea: {
    border: `1.5px solid ${C.border}`,
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    width: "100%",
    fontFamily: "monospace",
    resize: "vertical" as const,
    lineHeight: 1.55,
    outline: "none",
    color: C.charcoal,
  } as React.CSSProperties,

  btn: (color = C.charcoal) =>
    ({
      border: "none",
      borderRadius: 6,
      padding: "7px 16px",
      fontSize: 13,
      cursor: "pointer",
      background: color,
      color: color === C.gold ? C.charcoal : C.white,
      whiteSpace: "nowrap",
      fontFamily: FONT,
      fontWeight: 600,
      transition: "opacity 0.15s",
    } as React.CSSProperties),

  btnOutline: {
    border: `1.5px solid ${C.border}`,
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
    background: C.white,
    color: C.charcoal,
    whiteSpace: "nowrap",
    fontFamily: FONT,
    fontWeight: 500,
  } as React.CSSProperties,

  badge: (status: string | null) =>
    ({
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

  mono: { fontFamily: "monospace", fontSize: 12, color: C.muted } as React.CSSProperties,
  err: { color: C.red, fontSize: 13, marginTop: 6 } as React.CSSProperties,
  ok: { color: C.green, fontSize: 13, marginTop: 6 } as React.CSSProperties,
  muted: { color: C.muted, fontSize: 13 } as React.CSSProperties,
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function msgStyle(msg: string | null): React.CSSProperties {
  if (!msg) return { display: "none" };
  return msg.startsWith("✓") ? S.ok : S.err;
}

// ── Token gate ────────────────────────────────────────────────────────────────
function TokenGate({ onAuth, authErr }: { onAuth: (t: string) => void; authErr: string }) {
  const [val, setVal] = useState("");
  const [localErr, setLocalErr] = useState("");
  return (
    <div style={{ minHeight: "100dvh", background: "#eaecea", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ width: 380, background: C.white, borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 40px rgba(59,60,67,0.18)", border: `1px solid ${C.border}` }}>
        {/* Gold header bar matching chatbot widget */}
        <div style={{ background: C.gold, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: C.charcoal, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: C.gold, flexShrink: 0 }}>S</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: C.charcoal }}>Synchrony Assistant</div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, color: C.charcoal, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>Admin Portal</div>
          </div>
        </div>
        {/* Form body */}
        <div style={{ padding: "24px 24px 28px" }}>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
            Enter your <code style={{ background: C.bg, padding: "1px 5px", borderRadius: 4, fontSize: 12 }}>ADMIN_TOKEN</code> to access the knowledge base and settings.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (!val.trim()) { setLocalErr("Token required."); return; } onAuth(val.trim()); }}>
            <input
              type="password"
              placeholder="Paste admin token…"
              value={val}
              onChange={(e) => { setVal(e.target.value); setLocalErr(""); }}
              style={{ ...S.input, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
              autoFocus
            />
            <button type="submit" style={{ ...S.btn(C.gold), width: "100%", padding: "9px 0", fontSize: 14, borderRadius: 8, textAlign: "center" }}>
              Sign in
            </button>
            {(localErr || authErr) && <p style={{ ...S.err, marginTop: 8 }}>{localErr || authErr}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ sources }: { sources: Source[] }) {
  const enabled = sources.filter((s) => s.enabled).length;
  const chunks  = sources.reduce((sum, s) => sum + (s.chunk_count ?? 0), 0);

  const stat = (label: string, value: string | number) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: "12px 16px", borderRight: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: C.charcoal, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 4, boxShadow: "0 1px 3px rgba(59,60,67,0.06)" }}>
      {stat("Sources", sources.length)}
      {stat("Enabled", enabled)}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, padding: "12px 16px" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: C.charcoal, lineHeight: 1 }}>{chunks.toLocaleString()}</span>
        <span style={{ fontSize: 11, color: C.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>Chunks Indexed</span>
      </div>
    </div>
  );
}

// ── Source row ────────────────────────────────────────────────────────────────
function SourceRow({ source, token, onRefresh }: {
  source: Source;
  token: string;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setMsg(null);
    try { await adminApi.toggleEnabled(token, source.id, !source.enabled); onRefresh(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function ingest() {
    setBusy(true); setMsg(null);
    try {
      const res = await adminApi.ingestOne(token, source.id);
      setMsg(`✓ Done — ${(res as any).chunks_stored ?? 0} chunks stored.`);
      onRefresh();
    }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function del() {
    if (!confirm(`Delete "${source.name}"? This removes all its chunks.`)) return;
    setBusy(true); setMsg(null);
    try { await adminApi.deleteSource(token, source.id); onRefresh(); }
    catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  const isUrl = source.type === "url";

  return (
    <div style={{
      ...S.card,
      borderLeft: `3px solid ${source.enabled ? C.gold : C.border}`,
      opacity: source.enabled ? 1 : 0.72,
    }}>
      {/* Top row: type badge + name + status */}
      <div style={{ ...S.row, marginBottom: 5 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10, flexShrink: 0,
          background: isUrl ? "#dbeafe" : "#ede9fe",
          color:      isUrl ? "#1d4ed8"  : "#6d28d9",
        }}>
          {isUrl ? "URL" : "PDF"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {source.name}
        </span>
        <span style={S.badge(source.doc_status)}>{source.doc_status ?? "unindexed"}</span>
      </div>
      {/* URL link */}
      {source.url && (
        <p style={{ ...S.mono, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>{source.url}</a>
        </p>
      )}
      {/* Bottom row: meta + actions */}
      <div style={S.row}>
        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>
          Fetched {relativeTime(source.last_fetched_at)}
          {source.chunk_count != null && ` · ${source.chunk_count.toLocaleString()} chunks`}
        </span>
        <button style={{ ...S.btnOutline, fontSize: 12, padding: "4px 11px" }} disabled={busy} onClick={toggle}>
          {source.enabled ? "Disable" : "Enable"}
        </button>
        <button style={{ ...S.btn(C.green), fontSize: 12, padding: "4px 11px" }} disabled={busy} onClick={ingest}>
          {busy ? "…" : "Refresh"}
        </button>
        <button style={{ ...S.btn(C.red), fontSize: 12, padding: "4px 11px" }} disabled={busy} onClick={del}>
          Delete
        </button>
      </div>
      {source.doc_error && <p style={S.err}>⚠ {source.doc_error}</p>}
      {msg && <p style={msgStyle(msg)}>{msg}</p>}
    </div>
  );
}

// ── Add source (tabbed URL / PDF) ─────────────────────────────────────────────
function AddSource({ token, onRefresh }: { token: string; onRefresh: () => void }) {
  const [tab, setTab] = useState<"url" | "pdf">("url");

  const [newName, setNewName] = useState("");
  const [newUrl,  setNewUrl]  = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlMsg,  setUrlMsg]  = useState<string | null>(null);

  const [pdfName, setPdfName] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg,  setPdfMsg]  = useState<string | null>(null);

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    setUrlBusy(true); setUrlMsg(null);
    try {
      await adminApi.addUrl(token, newName, newUrl);
      setNewName(""); setNewUrl("");
      setUrlMsg("✓ URL source added. Run ingestion to index it.");
      onRefresh();
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
      onRefresh();
    } catch (err: any) { setPdfMsg(err.message); }
    finally { setPdfBusy(false); }
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "7px 18px",
    fontSize: 13,
    fontWeight: tab === t ? 700 : 500,
    cursor: "pointer",
    border: "none",
    borderBottom: tab === t ? `2px solid ${C.gold}` : "2px solid transparent",
    background: "none",
    color: tab === t ? C.charcoal : C.muted,
    fontFamily: FONT,
  });

  return (
    <div style={S.card}>
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        <button style={tabStyle("url")} onClick={() => setTab("url")}>🔗 URL</button>
        <button style={tabStyle("pdf")} onClick={() => setTab("pdf")}>📄 PDF</button>
      </div>

      {tab === "url" && (
        <form onSubmit={addUrl}>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <input style={S.input} placeholder="Name (e.g. Synchrony FAQs)" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <input style={{ ...S.input, flex: 2 }} placeholder="https://…" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} type="url" required />
            <button type="submit" style={S.btn()} disabled={urlBusy}>{urlBusy ? "Adding…" : "Add URL"}</button>
          </div>
          {urlMsg && <p style={msgStyle(urlMsg)}>{urlMsg}</p>}
        </form>
      )}

      {tab === "pdf" && (
        <form onSubmit={uploadPdf}>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <input style={S.input} placeholder="Name (optional, defaults to filename)" value={pdfName} onChange={(e) => setPdfName(e.target.value)} />
            <input type="file" accept=".pdf" style={{ fontSize: 13 }} onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            <button type="submit" style={S.btn()} disabled={pdfBusy}>{pdfBusy ? "Uploading…" : "Upload PDF"}</button>
          </div>
          {pdfMsg && <p style={msgStyle(pdfMsg)}>{pdfMsg}</p>}
        </form>
      )}
    </div>
  );
}

// ── Personality editor ────────────────────────────────────────────────────────
function PersonalityEditor({ token }: { token: string }) {
  const [config, setConfig] = useState<PersonalityConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"settings" | "advanced">("settings");
  const [newRule, setNewRule] = useState("");

  // Local editable state
  const [personaName, setPersonaName] = useState("");
  const [tone, setTone] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [overrideText, setOverrideText] = useState("");
  const [useOverride, setUseOverride] = useState(false);

  useEffect(() => {
    adminApi.getPersonality(token).then((cfg) => {
      setConfig(cfg);
      setPersonaName(cfg.persona_name);
      setTone(cfg.tone_description);
      setRules(cfg.extra_rules ?? []);
      setOverrideText(cfg.system_prompt_override ?? "");
      setUseOverride(!!cfg.system_prompt_override);
    }).catch((e) => setMsg(e.message));
  }, [token]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const update: any = { persona_name: personaName, tone_description: tone, extra_rules: rules };
      if (useOverride && overrideText.trim()) {
        update.system_prompt_override = overrideText.trim();
      } else {
        update.clear_override = true;
      }
      const res = await adminApi.setPersonality(token, update);
      setConfig(res.config);
      setMsg("✓ Personality saved.");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!confirm("Reset personality to factory defaults?")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await adminApi.resetPersonality(token);
      const cfg = res.config;
      setConfig(cfg);
      setPersonaName(cfg.persona_name);
      setTone(cfg.tone_description);
      setRules(cfg.extra_rules ?? []);
      setOverrideText("");
      setUseOverride(false);
      setMsg("✓ Reset to defaults.");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  if (!config) return <p style={S.muted}>Loading personality config…</p>;

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: tab === t ? 700 : 400,
    cursor: "pointer",
    border: "none",
    borderBottom: tab === t ? `2px solid ${C.gold}` : "2px solid transparent",
    background: "none",
    color: tab === t ? C.charcoal : C.muted,
    fontFamily: FONT,
    transition: "color 0.15s",
  });

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        <button style={tabStyle("settings")} onClick={() => setTab("settings")}>Settings</button>
        <button style={tabStyle("advanced")} onClick={() => setTab("advanced")}>Advanced (Full Override)</button>
      </div>

      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>
              Persona Name
            </label>
            <input
              style={{ ...S.input, maxWidth: 400 }}
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              placeholder="e.g. Synchrony virtual assistant"
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 5 }}>
              Tone Description
            </label>
            <input
              style={{ ...S.input, maxWidth: 500 }}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. warm, calm, professional"
            />
            <p style={{ ...S.muted, fontSize: 12, marginTop: 4 }}>
              Injected into the system prompt as: &quot;Speak in a [tone] tone.&quot;
            </p>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Custom Rules
            </label>
            {rules.length === 0 && (
              <p style={{ ...S.muted, fontSize: 12, marginBottom: 8 }}>No custom rules. Add one below.</p>
            )}
            {rules.map((rule, i) => (
              <div key={i} style={{ ...S.row, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 13, padding: "5px 0" }}>{i + 7}. {rule}</span>
                <button
                  style={{ ...S.btn(C.red), padding: "4px 10px" }}
                  onClick={() => setRules(rules.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <div style={S.row}>
              <input
                style={{ ...S.input, flex: 2 }}
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                placeholder="Add a custom rule…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newRule.trim()) {
                    setRules([...rules, newRule.trim()]);
                    setNewRule("");
                  }
                }}
              />
              <button
                style={S.btn()}
                disabled={!newRule.trim()}
                onClick={() => {
                  if (newRule.trim()) { setRules([...rules, newRule.trim()]); setNewRule(""); }
                }}
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "advanced" && (
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={useOverride}
              onChange={(e) => setUseOverride(e.target.checked)}
            />
            Enable full system prompt override (replaces all settings above)
          </label>
          <textarea
            style={{ ...S.textarea, minHeight: 280, opacity: useOverride ? 1 : 0.45 }}
            value={overrideText}
            onChange={(e) => setOverrideText(e.target.value)}
            disabled={!useOverride}
            placeholder="Enter a complete system prompt to override all other settings…"
          />
          {!useOverride && (
            <p style={{ ...S.muted, fontSize: 12, marginTop: 6 }}>
              Override is disabled. The prompt is built from the Settings tab values.
            </p>
          )}
        </div>
      )}

      <div style={{ ...S.row, marginTop: 18 }}>
        <button style={S.btn(C.charcoal)} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save Personality"}
        </button>
        <button style={S.btnOutline} disabled={busy} onClick={reset}>
          Reset to Defaults
        </button>
      </div>
      {msg && <p style={msg.startsWith("✓") ? S.ok : S.err}>{msg}</p>}
    </div>
  );
}

// ── Query test tool ───────────────────────────────────────────────────────────
function QueryTester({ token }: { token: string }) {
  const [query, setQuery] = useState("");
  const [k, setK] = useState(4);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<QueryChunk[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!query.trim()) return;
    setBusy(true); setErr(null); setResults(null);
    try {
      const res = await adminApi.queryTest(token, query.trim(), k);
      setResults(res.chunks);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const scoreBar = (score: number) => {
    const pct = Math.min(100, Math.round(score * 100));
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <div style={{ flex: 1, height: 4, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: C.gold, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{score.toFixed(4)}</span>
      </div>
    );
  };

  return (
    <div>
      <p style={{ ...S.muted, marginBottom: 12 }}>
        Run a query to see exactly which chunks the retrieval pipeline returns. Useful for debugging
        relevance and tuning sources.
      </p>
      <div style={{ ...S.row, marginBottom: 8 }}>
        <input
          style={{ ...S.input, flex: 3 }}
          placeholder="Enter a test query…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
        />
        <label style={{ fontSize: 13, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
          Top&nbsp;
          <select
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            style={{ ...S.input, flex: "none", width: 56, padding: "6px 6px" }}
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button style={S.btn(C.charcoal)} disabled={busy || !query.trim()} onClick={run}>
          {busy ? "Running…" : "▶ Run"}
        </button>
      </div>
      {err && <p style={S.err}>{err}</p>}
      {results !== null && results.length === 0 && (
        <p style={S.muted}>No chunks retrieved. Try a different query or check your sources.</p>
      )}
      {results && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {results.map((chunk) => (
            <div key={chunk.rank} style={{ ...S.card, borderLeft: `3px solid ${C.gold}` }}>
              <div style={{ ...S.row, marginBottom: 4 }}>
                <span style={{
                  background: C.charcoal,
                  color: C.white,
                  borderRadius: 4,
                  padding: "2px 7px",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  #{chunk.rank}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{chunk.source}</span>
                <span style={S.badge(chunk.source_type === "website" ? "ok" : "pending")}>
                  {chunk.source_type}
                </span>
              </div>
              {scoreBar(chunk.score)}
              {chunk.section_heading && (
                <p style={{ fontSize: 12, color: C.muted, marginTop: 4, fontStyle: "italic" }}>
                  § {chunk.section_heading}
                  {chunk.page_number != null && ` · p.${chunk.page_number}`}
                </p>
              )}
              {chunk.url && (
                <p style={{ ...S.mono, marginTop: 4 }}>
                  <a href={chunk.url} target="_blank" rel="noopener noreferrer" style={{ color: "#0057a8" }}>
                    {chunk.url}
                  </a>
                </p>
              )}
              <p style={{ fontSize: 12, color: "#444", marginTop: 8, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {chunk.text_preview}
                {chunk.text_preview.length >= 400 && <span style={{ color: C.muted }}> …</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────
function AdminPage({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([adminApi.listSources(token), adminApi.listRuns(token)]);
      setSources(s);
      setRuns(r);
    } catch (e: any) { setGlobalMsg(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

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
    <div style={{ background: "#eaecea", minHeight: "100dvh", fontFamily: FONT }}>
      {/* ── Branded header bar ── */}
      <div style={{ background: C.gold, padding: "0 24px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(59,60,67,0.12)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: C.charcoal, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: C.gold, flexShrink: 0 }}>S</div>
          <span style={{ fontWeight: 700, fontSize: "0.88rem", color: C.charcoal, letterSpacing: "0.01em" }}>Synchrony Assistant</span>
          <span style={{ fontSize: "0.57rem", fontWeight: 700, color: C.charcoal, background: "rgba(59,60,67,0.13)", borderRadius: 20, padding: "2px 7px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Admin</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={S.btn(C.charcoalDark)} disabled={ingestBusy} onClick={ingestAll}>
            {ingestBusy ? "Running…" : "▶ Ingest All"}
          </button>
          <button style={{ ...S.btnOutline, borderColor: "rgba(59,60,67,0.25)", background: "rgba(255,255,255,0.55)" }} onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </div>

      <div style={S.page}>
        {/* Global message */}
        {globalMsg && <p style={msgStyle(globalMsg)}>{globalMsg}</p>}

        {/* Stats summary */}
        {!loading && <StatsBar sources={sources} />}

        {/* ── Sources ── */}
        <h2 style={S.h2}>📚 Knowledge Sources {!loading && `(${sources.length})`}</h2>
        {loading ? (
          <p style={S.muted}>Loading…</p>
        ) : sources.length === 0 ? (
          <p style={S.muted}>No sources yet. Add one below.</p>
        ) : (
          sources.map((s) => (
            <SourceRow key={s.id} source={s} token={token} onRefresh={load} />
          ))
        )}

        {/* ── Add Source (tabbed) ── */}
        <h2 style={S.h2}>➕ Add Source</h2>
        <AddSource token={token} onRefresh={load} />

        {/* ── Assistant Personality ── */}
        <h2 style={S.h2}>🤖 Assistant Personality</h2>
        <PersonalityEditor token={token} />

        {/* ── Query Test Tool ── */}
        <h2 style={S.h2}>🔍 Retrieval Query Tester</h2>
        <QueryTester token={token} />

        {/* ── Ingestion runs ── */}
        <h2 style={S.h2}>📋 Recent Ingestion Runs</h2>
        {runs.length === 0 ? (
          <p style={S.muted}>No runs yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `2px solid ${C.border}` }}>
                  {["ID", "Started", "Duration", "Status", "Total", "OK", "Skipped", "Errors"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const dur = r.finished_at
                    ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000) + "s"
                    : "…";
                  const s = r.summary as any;
                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid #eee` }}>
                      <td style={{ padding: "6px 10px", color: C.muted }}>{r.id}</td>
                      <td style={{ padding: "6px 10px" }}>{relativeTime(r.started_at)}</td>
                      <td style={{ padding: "6px 10px", color: C.muted }}>{dur}</td>
                      <td style={{ padding: "6px 10px" }}><span style={S.badge(r.status)}>{r.status}</span></td>
                      <td style={{ padding: "6px 10px" }}>{s.total ?? "—"}</td>
                      <td style={{ padding: "6px 10px", color: C.green }}>{s.ok ?? "—"}</td>
                      <td style={{ padding: "6px 10px", color: C.muted }}>{s.skipped ?? "—"}</td>
                      <td style={{ padding: "6px 10px", color: s.errors ? C.red : C.muted }}>{s.errors ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Top-level export ──────────────────────────────────────────────────────────
export default function AdminRoute() {
  const [token, setToken] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  // Try to load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("syf-admin-token");
    if (savedToken) {
      handleAuth(savedToken).finally(() => setIsInitializing(false));
    } else {
      setIsInitializing(false);
    }
  }, []);

  async function handleAuth(t: string) {
    try {
      await adminApi.listSources(t);
      setToken(t);
      localStorage.setItem("syf-admin-token", t);
      setAuthErr("");
    } catch (e: any) {
      localStorage.removeItem("syf-admin-token");
      setAuthErr(
        e.message.includes("401") || e.message.includes("Invalid")
          ? "Invalid token."
          : e.message
      );
    }
  }

  if (isInitializing) {
    return (
      <div style={{ minHeight: "100dvh", background: "#eaecea", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, color: C.muted, fontSize: 14 }}>
        Verifying token…
      </div>
    );
  }

  function handleSignOut() {
    localStorage.removeItem("syf-admin-token");
    setToken(null);
    setAuthErr("");
  }

  if (!token) {
    return <TokenGate onAuth={handleAuth} authErr={authErr} />;
  }

  return <AdminPage token={token} onSignOut={handleSignOut} />;

}
