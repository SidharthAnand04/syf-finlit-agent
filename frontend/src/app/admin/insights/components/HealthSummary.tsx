"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { InsightsSummary } from "@/lib/api";
import { calculateHealthScore, fmt, type HealthLabel } from "../utils";

function StatItem({
  value,
  label,
  note,
  noteColor,
}: {
  value: string;
  label: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 96, padding: "0 16px" }}>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: C.charcoal,
          fontFamily: FONT,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{label}</div>
      {note && (
        <div style={{ fontSize: 10, color: noteColor ?? C.muted, fontFamily: FONT, fontWeight: 500 }}>
          {note}
        </div>
      )}
    </div>
  );
}

function VDivider() {
  return (
    <div
      style={{
        width: 1,
        background: C.dividerWarm,
        alignSelf: "stretch",
        flexShrink: 0,
        margin: "4px 0",
      }}
    />
  );
}

interface HealthSummaryProps {
  summary: InsightsSummary;
  llmScore?: number;
  llmReasoning?: string;
  /** AI executive summary — shown as a highlighted banner when present */
  executiveSummary?: string;
}

export function HealthSummary({ summary, llmScore, llmReasoning, executiveSummary }: HealthSummaryProps) {
  const health = calculateHealthScore(summary);

  const displayScore = llmScore != null ? llmScore : health.score;
  const displayLabel: HealthLabel =
    llmScore != null
      ? llmScore >= 8
        ? "Excellent"
        : llmScore >= 6
        ? "Good"
        : llmScore >= 4
        ? "Needs Attention"
        : "Critical"
      : health.label;

  const colorMap: Record<HealthLabel, { color: string; bg: string; border: string }> = {
    Excellent:         { color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
    Good:              { color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
    "Needs Attention": { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    Critical:          { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  };
  const { color, bg, border } = colorMap[displayLabel];

  const total = summary.total_interactions ?? 0;
  const noMatchPct =
    total > 0 ? ((summary.zero_chunk_queries ?? 0) / total) * 100 : 0;
  const followup = summary.followup_pct ?? 0;
  const p95 = summary.p95_response_ms ?? 0;
  const avgChunks = summary.avg_chunks_retrieved ?? 0;

  const followupNote = followup > 60 ? "High" : followup > 35 ? "Elevated" : null;
  const noMatchNote =
    noMatchPct > 15
      ? "High — needs attention"
      : noMatchPct > 8
      ? "Moderate"
      : `${noMatchPct.toFixed(0)}% of total`;
  const p95Note = p95 > 4000 ? "Slow" : p95 > 2500 ? "Above average" : null;
  const chunksNote =
    avgChunks < 1 && total > 0
      ? "Too low — check indexing"
      : avgChunks > 7
      ? "May indicate duplicates"
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* AI Executive Summary banner — shown only when LLM analysis is available */}
      {executiveSummary && (
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 18,
            padding: "14px 20px",
            border: `1px solid ${C.goldGlassBorder}`,
            background: "rgba(255,251,235,0.88)",
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: C.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              color: C.charcoal,
              marginTop: 1,
            }}
          >
            AI
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: FONT,
                marginBottom: 4,
              }}
            >
              AI Executive Summary
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.charcoal,
                fontFamily: FONT,
                lineHeight: 1.6,
              }}
            >
              {executiveSummary}
            </div>
          </div>
        </div>
      )}

      {/* Health score card */}
      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {/* Status bar */}
        <div
          style={{
            background: bg,
            borderBottom: `1px solid ${border}`,
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 12px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
              background: color,
            color: C.white,
              fontFamily: FONT,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: C.white,
                opacity: 0.85,
                display: "inline-block",
              }}
            />
            {displayLabel}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color,
              fontFamily: FONT,
              lineHeight: 1,
            }}
          >
            {displayScore}
            <span style={{ fontSize: 13, fontWeight: 400, color, opacity: 0.75, marginLeft: 2 }}>
              /10
            </span>
          </span>
          <span
            style={{
              fontSize: 13,
              color: C.charcoal,
              fontFamily: FONT,
              lineHeight: 1.4,
              flex: 1,
              minWidth: 200,
            }}
          >
            {llmReasoning ?? health.diagnosis}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: top issues */}
          {health.topIssues.length > 0 && (
            <div
              style={{
                padding: "16px 24px",
                borderRight: `1px solid ${C.dividerWarm}`,
                minWidth: 260,
                flex: "0 0 auto",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.muted,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontFamily: FONT,
                  marginBottom: 8,
                }}
              >
                Top Issues
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {health.topIssues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "flex-start",
                      padding: "5px 9px",
                      background: C.inset,
                      border: `1px solid ${C.insetBorder}`,
                      borderRadius: 8,
                      fontSize: 12,
                      color: C.charcoal,
                      fontFamily: FONT,
                      lineHeight: 1.4,
                    }}
                  >
                    <span
                      style={{ flexShrink: 0, color: health.color, fontWeight: 700, marginTop: 1, fontSize: 11 }}
                    >
                      !
                    </span>
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Right: KPI strip */}
          <div style={{ flex: 1, padding: "16px 0", minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: FONT,
                marginBottom: 12,
                paddingLeft: 16,
              }}
            >
              Key Metrics
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                flexWrap: "wrap",
                rowGap: 16,
              }}
            >
              <StatItem value={fmt(summary.total_interactions)} label="Total Interactions" />
              <VDivider />
              <StatItem value={fmt(summary.unique_sessions)} label="Unique Sessions" />
              <VDivider />
              <StatItem
                value={`${followup}%`}
                label="Follow-up Rate"
                note={followupNote ?? undefined}
                noteColor={followupNote ? C.orange : undefined}
              />
              <VDivider />
              <StatItem
                value={fmt(summary.zero_chunk_queries)}
                label="No-Match Queries"
                note={noMatchNote}
                noteColor={noMatchPct > 10 ? C.red : C.muted}
              />
              <VDivider />
              <StatItem value={`${fmt(summary.avg_response_ms)}ms`} label="Avg Response" />
              <VDivider />
              <StatItem
                value={`${fmt(summary.p95_response_ms)}ms`}
                label="P95 Response"
                note={p95Note ?? undefined}
                noteColor={p95Note ? C.orange : undefined}
              />
              <VDivider />
              <StatItem
                value={`${Math.round((avgChunks) * 10) / 10}`}
                label="Avg Chunks / Query"
                note={chunksNote ?? undefined}
                noteColor={chunksNote ? (avgChunks < 1 ? C.red : C.orange) : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
