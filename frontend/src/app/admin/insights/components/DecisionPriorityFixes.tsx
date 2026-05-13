"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { InsightsData, LlmAnalysisResult, ReportPriorityFix } from "@/lib/api";
import { buildPriorityFixes, truncate } from "../utils";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";
import type { DashboardAction } from "./DecisionDashboard";

function severityVariant(severity: string) {
  if (severity === "High") return "high" as const;
  if (severity === "Medium") return "medium" as const;
  return "low" as const;
}

function fallbackFixes(data: InsightsData): ReportPriorityFix[] {
  return buildPriorityFixes({
    summary: data.summary,
    knowledgeGaps: data.knowledge_gaps,
    lowCitation: data.low_citation,
    neverCited: data.source_usage.never_cited,
  }).map((fix) => ({
    problem: fix.title,
    severity: fix.severity,
    evidence: fix.evidence,
    impact: fix.whyItMatters,
    recommendedFix: fix.suggestedFix,
    effort: fix.effort,
    confidence: "Medium",
    owner: fix.category === "performance" || fix.category === "retrieval" ? "Engineering" : "Content",
    actionType: fix.category === "source" ? "source" : fix.category === "response" ? "faq" : fix.category,
  }));
}

export function DecisionPriorityFixes({
  data,
  analysis,
  onAction,
}: {
  data: InsightsData;
  analysis: LlmAnalysisResult | null;
  onAction: (action: DashboardAction) => void;
}) {
  const fixes = (analysis?.priorityFixes?.length ? analysis.priorityFixes : fallbackFixes(data)).slice(0, 6);
  if (!fixes.length) return null;
  const highCount = fixes.filter((fix) => fix.severity === "High").length;

  return (
    <div>
      <SectionHeader
        title="Top Priority Fixes"
        badges={[
          ...(highCount ? [{ label: `${highCount} high`, color: "red" as const }] : []),
          { label: `${fixes.length} total`, color: "neutral" as const },
        ]}
        note="Ordered by trust impact"
      />
      <div style={{ display: "grid", gap: 10 }}>
        {fixes.map((fix, i) => (
          <div key={`${fix.problem}-${i}`} style={{ ...GLASS_CARD_STYLE, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <StatusBadge label={fix.severity} variant={severityVariant(fix.severity)} uppercase />
                  <StatusBadge label={`${fix.effort} effort`} variant="neutral" />
                  <StatusBadge label={`${fix.confidence} confidence`} variant="info" />
                  <StatusBadge label={fix.owner} variant="neutral" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.charcoal, fontFamily: FONT, lineHeight: 1.3 }}>
                  {fix.problem}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.goldDark, fontFamily: FONT }}>#{i + 1}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
              <div style={{ background: C.inset, border: `1px solid ${C.insetBorder}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, fontWeight: 800, fontFamily: FONT }}>Evidence</div>
                <div style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT, lineHeight: 1.5, marginTop: 4 }}>{truncate(fix.evidence, 160)}</div>
              </div>
              <div style={{ background: C.inset, border: `1px solid ${C.insetBorder}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, fontWeight: 800, fontFamily: FONT }}>Impact</div>
                <div style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT, lineHeight: 1.5, marginTop: 4 }}>{truncate(fix.impact, 160)}</div>
              </div>
            </div>
            <div style={{ marginTop: 11, fontSize: 13, color: "#065f46", fontFamily: FONT, lineHeight: 1.45 }}>
              <strong>Recommended fix:</strong> {fix.recommendedFix}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              <button className="admin-btn-ghost" onClick={() => onAction({ type: "review", title: `Review Evidence: ${fix.problem}`, payload: { fix } })}>
                Review Evidence
              </button>
              <button className="admin-btn-ghost" onClick={() => onAction({ type: "faq", title: `Generate FAQ Draft: ${fix.problem}`, payload: { fix } })}>
                Generate FAQ Draft
              </button>
              <button className="admin-btn-ghost" onClick={() => onAction({ type: "kb", title: `Create KB Draft: ${fix.problem}`, payload: { fix } })}>
                Create KB Draft
              </button>
              <button className="admin-btn-ghost" onClick={() => onAction({ type: "source", title: `Review Sources: ${fix.problem}`, payload: { fix } })}>
                Review Sources
              </button>
              <button className="admin-btn-ghost" onClick={() => onAction({ type: "resolved", title: `Mark Resolved: ${fix.problem}`, payload: { fix } })}>
                Mark Resolved
              </button>
              <button className="admin-btn-ghost" onClick={() => onAction({ type: "ignore", title: `Ignore: ${fix.problem}`, payload: { fix } })}>
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
