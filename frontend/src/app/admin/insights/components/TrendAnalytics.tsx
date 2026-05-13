"use client";

import { useState } from "react";
import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { DailyCount, HourlyCount, QuestionTypeCount } from "@/lib/api";
import { truncate } from "../utils";
import { SectionHeader } from "./SectionHeader";

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: DailyCount[] }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: "28px 0",
          textAlign: "center",
          fontSize: 12,
          color: C.muted,
          fontFamily: FONT,
        }}
      >
        No activity data recorded yet.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => a.day.localeCompare(b.day));
  const vals = sorted.map((d) => d.interactions);
  const max = Math.max(...vals, 1);
  const W = 560;
  const H = 80;
  const pts = vals.map((v, i) => {
    const x = (i / Math.max(vals.length - 1, 1)) * (W - 20) + 10;
    const y = H - 12 - (v / max) * (H - 24);
    return `${x},${y}`;
  });

  const totalInteractions = data.reduce((a, b) => a + b.interactions, 0);

  return (
    <div>
      <svg width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={C.gold}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {vals.map((v, i) => {
          const parts = pts[i].split(",");
          const cx = parseFloat(parts[0]);
          const cy = parseFloat(parts[1]);
          return (
            <circle key={i} cx={cx} cy={cy} r={3.5} fill={C.gold} stroke={C.white} strokeWidth={1.5}>
              <title>
                {sorted[i].day}: {v} interaction{v !== 1 ? "s" : ""}
              </title>
            </circle>
          );
        })}
        {sorted.length > 0 && (
          <>
            <text x={10} y={H} fontSize={10} fill={C.muted} fontFamily={FONT}>
              {sorted[0].day}
            </text>
            <text x={W - 10} y={H} fontSize={10} fill={C.muted} textAnchor="end" fontFamily={FONT}>
              {sorted[sorted.length - 1].day}
            </text>
          </>
        )}
      </svg>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontFamily: FONT }}>
        {totalInteractions.toLocaleString()} total interactions across {data.length} day
        {data.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ── Hourly Heatmap ────────────────────────────────────────────────────────────

function HourlyHeatmap({ data }: { data: HourlyCount[] }) {
  const byHour: Record<number, number> = {};
  data.forEach((d) => {
    byHour[d.hour_utc] = d.count;
  });
  const max = Math.max(...Object.values(byHour), 1);

  if (data.every((d) => d.count === 0)) {
    return (
      <div
        style={{
          padding: "28px 0",
          textAlign: "center",
          fontSize: 12,
          color: C.muted,
          fontFamily: FONT,
        }}
      >
        No hourly data recorded yet.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {Array.from({ length: 24 }, (_, h) => {
          const count = byHour[h] ?? 0;
          const intensity = count / max;
          const bg =
            intensity === 0 ? C.insetMuted : `rgba(251,198,0,${0.15 + intensity * 0.85})`;
          return (
            <div
              key={h}
              title={`${h}:00 UTC — ${count} quer${count !== 1 ? "ies" : "y"}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: bg,
                border: `1px solid ${C.insetBorder}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "default",
              }}
            >
              <div style={{ fontSize: 9, color: C.muted, fontFamily: FONT }}>
                {String(h).padStart(2, "0")}h
              </div>
              <div
                style={{ fontSize: 11, fontWeight: 700, color: C.charcoal, fontFamily: FONT }}
              >
                {count || ""}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8, fontFamily: FONT }}>
        Hover each cell for exact count. Darker yellow = more activity. All times UTC.
      </div>
    </div>
  );
}

// ── Question Type Breakdown ───────────────────────────────────────────────────

function QuestionTypeBreakdown({ data }: { data: QuestionTypeCount[] }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: "28px 0",
          textAlign: "center",
          fontSize: 12,
          color: C.muted,
          fontFamily: FONT,
        }}
      >
        No question type data.
      </div>
    );
  }

  const total = data.reduce((a, b) => a + b.count, 0);
  const max = Math.max(...data.map((d) => d.count), 1);

  const typeColors: Record<string, string> = {
    synchrony:     C.gold,
    informational: C.blue,
    unknown:       C.muted,
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((qt) => {
          const pct = total ? ((qt.count / total) * 100).toFixed(1) : "0";
          const barWidth = (qt.count / max) * 100;
          const color = typeColors[qt.question_type] ?? C.muted;
          return (
            <div key={qt.question_type}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 5,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 9px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    background: color,
                    color: C.white,
                    fontFamily: FONT,
                  }}
                >
                  {truncate(qt.question_type, 24)}
                </span>
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: C.charcoal, fontFamily: FONT }}
                >
                  {qt.count.toLocaleString()}
                  <span style={{ color: C.muted, fontWeight: 400, marginLeft: 4 }}>
                    ({pct}%)
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: C.insetMuted,
                  border: `1px solid ${C.insetBorder}`,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 3,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 10, fontFamily: FONT }}>
        Synchrony = brand/product questions. Informational = general finance topics.
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface TrendAnalyticsProps {
  dailyCounts: DailyCount[];
  hourlyHeatmap: HourlyCount[];
  questionTypes: QuestionTypeCount[];
}

export function TrendAnalytics({
  dailyCounts,
  hourlyHeatmap,
  questionTypes,
}: TrendAnalyticsProps) {
  const [open, setOpen] = useState(true);

  const totalInteractions = dailyCounts.reduce((a, b) => a + b.interactions, 0);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "block",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: open ? 14 : 0,
          textAlign: "left" as const,
        }}
      >
        <SectionHeader
          title="Trend Analytics"
          badges={
            totalInteractions > 0
              ? [{ label: `${totalInteractions.toLocaleString()} interactions`, color: "neutral" }]
              : []
          }
          action={
            <span
              style={{
                fontSize: 14,
                color: C.muted,
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
                display: "inline-block",
                lineHeight: 1,
              }}
            >
              ›
            </span>
          }
          mb={0}
        />
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Activity over time */}
          <div
            style={{
              ...GLASS_CARD_STYLE,
              borderRadius: 18,
              padding: "16px 20px",
            }}
          >
            <div className="admin-card-heading">Activity — Last 30 Days</div>
            <Sparkline data={dailyCounts} />
          </div>

          {/* Peak hours + question types side by side */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 18,
                padding: "16px 20px",
              }}
            >
              <div className="admin-card-heading">Peak Hours (UTC)</div>
              <HourlyHeatmap data={hourlyHeatmap} />
            </div>

            {questionTypes.length > 0 && (
              <div
                style={{
                  ...GLASS_CARD_STYLE,
                  borderRadius: 18,
                  padding: "16px 20px",
                }}
              >
                <div className="admin-card-heading">Question Types</div>
                <QuestionTypeBreakdown data={questionTypes} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
