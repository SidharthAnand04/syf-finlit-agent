"use client";

import { useEffect, useState } from "react";
import { adminApi, PersonalityConfig } from "@/lib/api";
import { useAdmin } from "../context";
import { C, FONT } from "../components/tokens";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "@/components/ui/layout";

const TONE_PRESETS = [
  "warm, calm, professional",
  "concise, confident, helpful",
  "plain-language, reassuring, neutral",
  "detailed, careful, educational",
];

function DataGroup({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="admin-data-group">
      <div className="admin-data-group-header">
        <div>
          <h2 className="admin-data-group-title">{title}</h2>
          {subtitle && <p className="admin-data-group-subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="admin-data-group-body">{children}</div>
    </section>
  );
}

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.charcoal, fontFamily: FONT, marginBottom: 6 }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5, fontFamily: FONT }}>{hint}</span>}
    </label>
  );
}

export default function PersonalityPage() {
  const { token } = useAdmin();
  const [config, setConfig] = useState<PersonalityConfig | null>(null);
  const [tab, setTab] = useState<"settings" | "advanced">("settings");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [newRule, setNewRule] = useState("");

  const [personaName, setPersonaName] = useState("");
  const [tone, setTone] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [overrideText, setOverrideText] = useState("");
  const [useOverride, setUseOverride] = useState(false);

  useEffect(() => {
    if (!token) return;
    adminApi.getPersonality(token).then((cfg) => {
      setConfig(cfg);
      setPersonaName(cfg.persona_name);
      setTone(cfg.tone_description);
      setRules(cfg.extra_rules ?? []);
      setOverrideText(cfg.system_prompt_override ?? "");
      setUseOverride(!!cfg.system_prompt_override);
    }).catch((e: Error) => setMsg({ text: e.message, ok: false }));
  }, [token]);

  async function save() {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      const update: Partial<PersonalityConfig> & { clear_override?: boolean } = {
        persona_name: personaName,
        tone_description: tone,
        extra_rules: rules,
      };
      if (useOverride && overrideText.trim()) {
        update.system_prompt_override = overrideText.trim();
      } else {
        update.clear_override = true;
      }
      const res = await adminApi.setPersonality(token, update);
      setConfig(res.config);
      setMsg({ text: "Personality saved.", ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Error", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminApi.resetPersonality(token);
      const cfg = res.config;
      setConfig(cfg);
      setPersonaName(cfg.persona_name);
      setTone(cfg.tone_description);
      setRules(cfg.extra_rules ?? []);
      setOverrideText("");
      setUseOverride(false);
      setMsg({ text: "Reset to defaults.", ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Error", ok: false });
    } finally {
      setBusy(false);
    }
  }

  function addRule() {
    const r = newRule.trim();
    if (r) {
      setRules([...rules, r]);
      setNewRule("");
    }
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Personality"
        subtitle="Configure how the assistant introduces itself and communicates."
        action={
          config && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="admin-btn-ghost" disabled={busy} onClick={reset}>
                Reset to Defaults
              </button>
              <button className="admin-btn-primary" disabled={busy} onClick={save}>
                {busy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )
        }
      />

      {!config ? (
        <div className="admin-data-group">
          <LoadingState />
        </div>
      ) : (
        <div className="admin-page-stack">
          <div className="admin-data-group">
            <div style={{ display: "flex", borderBottom: `1px solid ${C.dividerWarm}`, padding: "0 16px", background: C.insetMuted, overflowX: "auto" }}>
              <button className={`admin-tab${tab === "settings" ? " active" : ""}`} onClick={() => setTab("settings")}>
                Settings
              </button>
              <button className={`admin-tab${tab === "advanced" ? " active" : ""}`} onClick={() => setTab("advanced")}>
                System Prompt Override
              </button>
            </div>
          </div>

          {msg && (
            <div className={`admin-alert ${msg.ok ? "admin-alert-success" : "admin-alert-error"}`}>
              {msg.text}
            </div>
          )}

          {tab === "settings" && (
            <>
              <DataGroup
                title="Assistant Identity"
                subtitle="These values shape the generated system prompt while keeping the assistant inside the app's normal guardrails."
              >
                <div className="admin-field-grid">
                  <FieldLabel label="Persona Name" hint="Used in the system prompt as the assistant's name.">
                    <input
                      className="admin-input"
                      value={personaName}
                      onChange={(e) => setPersonaName(e.target.value)}
                      placeholder="e.g. Synchrony virtual assistant"
                    />
                  </FieldLabel>
                  <FieldLabel label="Tone Description" hint='Injected as: "Speak in a [tone] tone."'>
                    <input
                      className="admin-input"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      placeholder="e.g. warm, calm, professional"
                    />
                  </FieldLabel>
                </div>
              </DataGroup>

              <DataGroup
                title="Tone Presets"
                subtitle="Quick choices styled like the rest of the dashboard. Selecting one updates the tone field above."
              >
                <div className="admin-field-grid">
                  {TONE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`admin-choice-card${tone === preset ? " active" : ""}`}
                      onClick={() => setTone(preset)}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: tone === preset ? C.gold : C.muted, marginTop: 4, flexShrink: 0 }} />
                      <span>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{preset}</span>
                        <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 3 }}>Apply to assistant response style</span>
                      </span>
                    </button>
                  ))}
                </div>
              </DataGroup>

              <DataGroup
                title="Custom Rules"
                subtitle="Additional behavioral instructions layered after the default safety and scope rules."
              >
                {rules.length === 0 ? (
                  <div style={{ borderRadius: 16, border: `1px solid ${C.insetBorder}`, background: C.insetMuted, padding: "16px 18px", color: C.muted, fontSize: 13, fontFamily: FONT }}>
                    No custom rules. Add one below.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                    {rules.map((rule, i) => (
                      <div key={`${rule}-${i}`} className="admin-choice-card active">
                        <span style={{ color: C.muted, fontSize: 12, fontWeight: 900, minWidth: 22 }}>{i + 7}.</span>
                        <span style={{ flex: 1, fontSize: 13, color: C.charcoal, lineHeight: 1.45 }}>{rule}</span>
                        <button
                          aria-label={`Remove rule ${i + 1}`}
                          className="admin-btn-ghost"
                          style={{ minHeight: 30, padding: "4px 10px", fontSize: 11 }}
                          onClick={() => setRules(rules.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: rules.length === 0 ? 14 : 0 }}>
                  <input
                    className="admin-input"
                    style={{ flex: "1 1 320px" }}
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value)}
                    placeholder="Add a custom rule..."
                    onKeyDown={(e) => { if (e.key === "Enter") addRule(); }}
                  />
                  <button className="admin-btn-ghost" disabled={!newRule.trim()} onClick={addRule}>
                    Add Rule
                  </button>
                </div>
              </DataGroup>
            </>
          )}

          {tab === "advanced" && (
            <>
              <DataGroup
                title="Override Mode"
                subtitle="Advanced control for replacing the generated system prompt entirely."
              >
                <label className={`admin-choice-card${useOverride ? " active" : ""}`} style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={useOverride}
                    onChange={(e) => setUseOverride(e.target.checked)}
                  />
                  <span>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 900 }}>Enable full system prompt override</span>
                    <span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                      This ignores the Settings tab values and sends only the custom prompt below.
                    </span>
                  </span>
                </label>
              </DataGroup>

              <DataGroup
                title="System Prompt"
                subtitle="Use only when the normal personality builder is not expressive enough."
              >
                <div className="admin-alert" style={{ marginBottom: 16, color: C.orange, background: C.orangeBg, border: "1px solid #fed7aa" }}>
                  A full override replaces the system prompt entirely. Keep safety, scope, and refusal behavior explicit if enabled.
                </div>
                <textarea
                  className="admin-textarea"
                  style={{ minHeight: 360, opacity: useOverride ? 1 : 0.48 }}
                  value={overrideText}
                  onChange={(e) => setOverrideText(e.target.value)}
                  disabled={!useOverride}
                  placeholder="Enter a complete system prompt to override all other settings..."
                />
                {!useOverride && (
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 8, fontFamily: FONT }}>
                    Override is disabled. The prompt is built from the Settings tab.
                  </p>
                )}
              </DataGroup>
            </>
          )}
        </div>
      )}
    </div>
  );
}
