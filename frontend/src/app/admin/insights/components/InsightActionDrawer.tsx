"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { DashboardAction } from "./DecisionDashboard";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function InsightActionDrawer({
  action,
  onClose,
}: {
  action: DashboardAction | null;
  onClose: () => void;
}) {
  if (!action) return null;
  const gap = asRecord(action.payload.gap);
  const fix = asRecord(action.payload.fix);
  const title = getString(gap.title, getString(fix.problem, action.title));
  const evidence = Array.isArray(gap.evidence) ? gap.evidence : [];
  const recommended = getString(gap.suggestedAction, getString(gap.suggested_action, getString(fix.recommendedFix, "")));

  const draftQuestion = action.type === "faq"
    ? title.replace(/^Generate FAQ Draft:\s*/i, "")
    : `What should I know about ${title.toLowerCase()}?`;

  const kbBody = [
    `Title: ${title}`,
    "",
    "Purpose:",
    getString(gap.description, getString(fix.impact, "Explain this topic in clear, source-grounded language.")),
    "",
    "Suggested content:",
    recommended || "Add a concise Synchrony-approved explanation, eligibility boundaries, and safe routing guidance.",
    "",
    "Related queries:",
    ...(evidence.length ? evidence.map((item) => `- ${String(item)}`) : ["- Not tracked"]),
    "",
    "Risk note:",
    getString(gap.riskLevel, "Not tracked") === "High"
      ? "Include routing language for account-specific or high-risk support needs."
      : "Keep this educational and avoid account-specific advice.",
  ].join("\n");

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,10,18,0.48)",
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          ...GLASS_CARD_STYLE,
          width: "min(560px, 94vw)",
          height: "100%",
          overflowY: "auto",
          padding: 24,
          borderRadius: "18px 0 0 18px",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, fontFamily: FONT }}>
              Admin action
            </div>
            <h2 style={{ margin: "5px 0 0", fontSize: 20, color: C.charcoal, fontFamily: FONT }}>
              {action.title}
            </h2>
          </div>
          <button className="admin-btn-ghost" onClick={onClose} style={{ fontSize: 12, alignSelf: "flex-start" }}>
            Close
          </button>
        </div>

        {(action.type === "faq" || action.type === "kb") && (
          <div style={{ display: "grid", gap: 12 }}>
            <section style={{ background: "rgba(255,255,255,0.52)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: FONT, marginBottom: 8 }}>
                Draft preview
              </div>
              {action.type === "faq" ? (
                <>
                  <div style={{ fontSize: 13, color: C.charcoal, fontFamily: FONT, fontWeight: 800 }}>{draftQuestion}</div>
                  <p style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT, lineHeight: 1.55 }}>
                    {recommended || "Provide a short, source-grounded answer and route account-specific follow-up to authenticated Synchrony support."}
                  </p>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                    Alternate phrasings: {evidence.length ? evidence.slice(0, 2).join(" | ") : "Not tracked"}
                  </div>
                </>
              ) : (
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: C.charcoal, fontFamily: FONT, lineHeight: 1.55, margin: 0 }}>
                  {kbBody}
                </pre>
              )}
            </section>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT, lineHeight: 1.5 }}>
              TODO: persist this draft as a first-class KB/FAQ draft when backend draft tables are added. Existing FAQ creation can be wired when the admin confirms category and final answer text.
            </div>
          </div>
        )}

        {action.type === "source" && (
          <div style={{ fontSize: 13, color: C.charcoal, fontFamily: FONT, lineHeight: 1.6 }}>
            Review the related source metadata, headings, and freshness before editing or archiving. Compliance-heavy sources should be reviewed before removal even when traffic is low.
          </div>
        )}

        {(action.type === "resolved" || action.type === "ignore" || action.type === "review") && (
          <div style={{ fontSize: 13, color: C.charcoal, fontFamily: FONT, lineHeight: 1.6 }}>
            This action is tracked locally for this session. TODO: add an insight-status persistence table for resolved and ignored findings.
          </div>
        )}
      </div>
    </div>
  );
}
