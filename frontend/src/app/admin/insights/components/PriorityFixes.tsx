"use client";

import { useState } from "react";
import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { GapQuery, InsightsSummary, RetrievalIssue, ContentGap } from "@/lib/api";
import { buildPriorityFixes, truncate, type PriorityFix, type PriorityLevel } from "../utils";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";

const EFFORT_STYLES: Record<PriorityFix["effort"], { color: string; bg: string }> = {
  Quick:    { color: "#065f46", bg: "#d1fae5" },
  Medium:   { color: "#1e40af", bg: "#dbeafe" },
  Involved: { color: "#4b5563", bg: "rgba(255,252,245,0.88)" },
};

function EffortBadge({ effort }: { effort: PriorityFix["effort"] }) {
  const s = EFFORT_STYLES[effort];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        fontFamily: FONT,
        whiteSpace: "nowrap" as const,
      }}
    >
      {effort} effort
    </span>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="admin-btn-ghost"
      style={{ fontSize: 11, padding: "4px 10px" }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function FixCard({ fix }: { fix: PriorityFix }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        ...GLASS_CARD_STYLE,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 18px" }}>
        {/* Badges + title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9 }}>
          <div style={{ display: "flex", gap: 5, flexShrink: 0, marginTop: 1 }}>
            <StatusBadge
              label={fix.severity}
              variant={fix.severity === "High" ? "high" : fix.severity === "Medium" ? "medium" : "low"}
              uppercase
            />
            <EffortBadge effort={fix.effort} />
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.charcoal,
              fontFamily: FONT,
              flex: 1,
              lineHeight: 1.35,
            }}
          >
            {fix.title}
          </div>
        </div>

        {/* Evidence */}
        <div
          style={{
            fontSize: 12,
            color: C.charcoal,
            fontFamily: FONT,
            background: C.inset,
            border: `1px solid ${C.insetBorder}`,
            borderRadius: 12,
            padding: "8px 11px",
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          {fix.evidence}
        </div>

        {/* Suggested fix */}
        <div
          style={{
            fontSize: 12,
            color: "#065f46",
            fontFamily: FONT,
            marginBottom: 12,
            lineHeight: 1.45,
          }}
        >
          <strong style={{ fontWeight: 700 }}>Fix:</strong> {fix.suggestedFix}
        </div>

        {/* Why it matters (expandable) */}
        {expanded && (
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              fontFamily: FONT,
              marginBottom: 12,
              lineHeight: 1.6,
              borderTop: `1px solid ${C.dividerWarm}`,
              paddingTop: 10,
            }}
          >
            {fix.whyItMatters}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {(fix.category === "content" || fix.category === "retrieval") && (
            <>
              {/* TODO: Wire Review to filter the FAQ table to this category */}
              <ActionButton label="Review" onClick={() => console.log("TODO: Review fix", fix.id)} />
              {/* TODO: Wire Generate FAQ to FAQs admin page with topic pre-filled */}
              <ActionButton label="Generate FAQ" onClick={() => console.log("TODO: Generate FAQ for", fix.id)} />
              {/* TODO: Wire Create KB Draft to Sources admin page with topic pre-filled */}
              <ActionButton label="Create KB Draft" onClick={() => console.log("TODO: Create KB Draft for", fix.id)} />
            </>
          )}
          {fix.category === "source" && (
            <ActionButton label="Review Sources" onClick={() => console.log("TODO: Review sources for", fix.id)} />
          )}
          {(fix.category === "response" || fix.category === "performance") && (
            <ActionButton label="Review" onClick={() => console.log("TODO: Review", fix.id)} />
          )}
          {/* TODO: Wire Mark Resolved to persist dismissal in localStorage or backend */}
          <ActionButton label="Mark Resolved" onClick={() => console.log("TODO: Mark Resolved", fix.id)} />
          {/* TODO: Wire Ignore to persist dismissal preference */}
          <ActionButton label="Ignore" onClick={() => console.log("TODO: Ignore", fix.id)} />
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              color: C.muted,
              fontFamily: FONT,
              padding: "4px 0",
              marginLeft: "auto",
            }}
          >
            {expanded ? "Hide detail ↑" : "Why this matters ↓"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PriorityFixesProps {
  knowledgeGaps: GapQuery[];
  lowCitation: GapQuery[];
  neverCited: { title: string; url: string | null }[];
  summary: InsightsSummary;
  llmQuickWins?: string[];
  llmRetrievalIssues?: RetrievalIssue[];
  llmContentGaps?: ContentGap[];
  llmError: string;
  llmLoading: boolean;
  onRunAI: () => void;
  hasLlmAnalysis: boolean;
}

export function PriorityFixes({
  knowledgeGaps,
  lowCitation,
  neverCited,
  summary,
  llmQuickWins,
  llmRetrievalIssues,
  llmContentGaps,
  llmError,
  llmLoading,
  onRunAI,
  hasLlmAnalysis,
}: PriorityFixesProps) {
  const computedFixes = buildPriorityFixes({ summary, knowledgeGaps, lowCitation, neverCited });

  // LLM quick wins as priority fix cards
  const quickWinFixes: PriorityFix[] = (llmQuickWins ?? []).map((win, i) => ({
    id: `llm-win-${i}`,
    severity: "Medium" as PriorityLevel,
    title: truncate(win, 90),
    evidence: "Identified by AI analysis of question patterns and KB coverage",
    whyItMatters: win,
    suggestedFix: win,
    effort: "Quick" as const,
    category: "content" as const,
  }));

  // LLM content gaps surfaced as High/Medium priority fix cards
  const contentGapFixes: PriorityFix[] = (llmContentGaps ?? []).map((gap, i) => {
    const rawPriority = gap.priority.charAt(0).toUpperCase() + gap.priority.slice(1);
    const severity = (["High", "Medium", "Low"].includes(rawPriority)
      ? rawPriority
      : "Medium") as PriorityLevel;
    return {
      id: `llm-gap-${i}`,
      severity,
      title: gap.title,
      evidence: gap.evidence.length > 0
        ? `Example queries: ${gap.evidence.slice(0, 2).map((e) => `"${truncate(e, 45)}"`).join(", ")}`
        : "Identified by AI analysis",
      whyItMatters: gap.description,
      suggestedFix: gap.suggested_action,
      effort: "Medium" as const,
      category: "content" as const,
    };
  });

  // LLM retrieval issues surfaced as Medium priority fix cards
  const retrievalIssueFixes: PriorityFix[] = (llmRetrievalIssues ?? []).map((issue, i) => ({
    id: `llm-retrieval-${i}`,
    severity: "Medium" as PriorityLevel,
    title: issue.title,
    evidence: issue.affected_questions.length > 0
      ? `Affected queries: ${issue.affected_questions.slice(0, 2).map((q) => `"${truncate(q, 45)}"`).join(", ")}`
      : "Identified by AI retrieval analysis",
    whyItMatters: issue.description,
    suggestedFix: issue.suggested_fix,
    effort: "Involved" as const,
    category: "retrieval" as const,
  }));

  // Merge all fixes, deduplicate by title to avoid computed + LLM overlap
  const seenTitles = new Set<string>();
  const allFixes: PriorityFix[] = [];
  for (const fix of [...computedFixes, ...contentGapFixes, ...retrievalIssueFixes, ...quickWinFixes]) {
    const key = fix.title.toLowerCase().trim().slice(0, 60);
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      allFixes.push(fix);
    }
  }

  const highFixes = allFixes.filter((f) => f.severity === "High");
  const sevOrder: Record<PriorityLevel, number> = { High: 0, Medium: 1, Low: 2 };
  allFixes.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  if (allFixes.length === 0) return null;

  const badges = [
    ...(highFixes.length > 0 ? [{ label: `${highFixes.length} High`, color: "red" as const }] : []),
    { label: `${allFixes.length} total`, color: "neutral" as const },
  ];

  const action = !hasLlmAnalysis && !llmLoading ? (
    <button className="admin-btn-ghost" onClick={onRunAI} style={{ fontSize: 11 }}>
      + Run AI Analysis for more
    </button>
  ) : llmLoading ? (
    <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>AI analyzing…</span>
  ) : undefined;

  return (
    <div>
      <SectionHeader title="Priority Fixes" badges={badges} action={action} />

      {llmError && (
        <div
          style={{
            fontSize: 12,
            color: C.red,
            background: C.redBg,
            border: `1px solid ${C.redBorder}`,
            borderRadius: 6,
            padding: "7px 12px",
            marginBottom: 12,
            fontFamily: FONT,
          }}
        >
          AI analysis failed: {llmError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {allFixes.map((fix) => (
          <FixCard key={fix.id} fix={fix} />
        ))}
      </div>
    </div>
  );
}
