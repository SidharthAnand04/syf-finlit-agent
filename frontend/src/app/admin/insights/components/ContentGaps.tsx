"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { ContentGap, GapQuery } from "@/lib/api";
import { filterNoiseQueries, truncate, type PriorityLevel } from "../utils";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";

function LlmGapCard({ gap }: { gap: ContentGap }) {
  const rawPriority = gap.priority.charAt(0).toUpperCase() + gap.priority.slice(1);
  const priorityKey = (["High", "Medium", "Low"].includes(rawPriority)
    ? rawPriority
    : "Medium") as PriorityLevel;

  return (
    <div
      style={{
        ...GLASS_CARD_STYLE,
        borderRadius: 18,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
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
          {gap.title}
        </div>
        <StatusBadge
          label={priorityKey}
          variant={priorityKey === "High" ? "high" : priorityKey === "Medium" ? "medium" : "low"}
          uppercase
        />
      </div>

      <div
        style={{
          fontSize: 12,
          color: C.muted,
          fontFamily: FONT,
          lineHeight: 1.6,
          marginBottom: 10,
        }}
      >
        {gap.description}
      </div>

      {gap.evidence.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: FONT,
              marginBottom: 5,
            }}
          >
            Evidence Queries
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {gap.evidence.slice(0, 3).map((e, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: C.charcoal,
                  background: C.inset,
                  border: `1px solid ${C.insetBorder}`,
                  borderRadius: 10,
                  padding: "4px 9px",
                  fontFamily: FONT,
                  lineHeight: 1.4,
                }}
              >
                &ldquo;{truncate(e, 70)}&rdquo;
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#065f46",
            background: "#d1fae5",
            borderRadius: 5,
            padding: "4px 9px",
            fontFamily: FONT,
            lineHeight: 1.4,
          }}
        >
          {gap.suggested_action}
        </div>
        {/* TODO: Wire "Generate KB Draft" to open Sources page with title pre-filled */}
        <button
          className="admin-btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px" }}
          onClick={() => console.log("TODO: Generate KB Draft for gap:", gap.title)}
        >
          Generate KB Draft
        </button>
      </div>
    </div>
  );
}

function FallbackGapRow({ query }: { query: GapQuery }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: `1px solid ${C.dividerWarm}`,
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.charcoal,
          fontFamily: FONT,
          flex: 1,
          lineHeight: 1.4,
        }}
      >
        {truncate(query.user_message, 80)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.charcoal,
            fontFamily: FONT,
          }}
        >
          {query.times_asked}×
        </span>
        {/* TODO: Wire "Add KB Draft" to open Sources admin page with query pre-filled as title */}
        <button
          className="admin-btn-ghost"
          style={{ fontSize: 11, padding: "3px 9px" }}
          onClick={() => console.log("TODO: Add KB Draft for query:", query.user_message)}
        >
          Add KB Draft
        </button>
      </div>
    </div>
  );
}

interface ContentGapsProps {
  llmContentGaps?: ContentGap[];
  knowledgeGaps: GapQuery[];
}

export function ContentGaps({ llmContentGaps, knowledgeGaps }: ContentGapsProps) {
  const hasLlmGaps = llmContentGaps && llmContentGaps.length > 0;
  const realKBGaps = filterNoiseQueries(knowledgeGaps);

  if (!hasLlmGaps && realKBGaps.length === 0) return null;

  const highCount = hasLlmGaps
    ? llmContentGaps.filter((g) => g.priority === "high").length
    : 0;

  const badges = [
    ...(highCount > 0 ? [{ label: `${highCount} high priority`, color: "red" as const }] : []),
  ];

  const note = hasLlmGaps
    ? `${llmContentGaps.length} gap${llmContentGaps.length !== 1 ? "s" : ""} from AI analysis`
    : `${realKBGaps.length} unanswered quer${realKBGaps.length !== 1 ? "ies" : "y"}`;

  return (
    <div>
      <SectionHeader
        title="Content Gaps"
        badges={badges}
        note={!hasLlmGaps ? "Run AI Analysis for richer gap descriptions" : note}
        action={hasLlmGaps ? (
          <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{note}</span>
        ) : undefined}
      />

      {hasLlmGaps ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 10,
          }}
        >
          {llmContentGaps.map((gap, i) => (
            <LlmGapCard key={i} gap={gap} />
          ))}
        </div>
      ) : (
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              borderBottom: `1px solid ${C.dividerWarm}`,
              fontSize: 12,
              color: C.muted,
              fontFamily: FONT,
            }}
          >
            Queries that retrieved no KB chunks — these represent potential content gaps
          </div>
          {realKBGaps.slice(0, 12).map((q, i) => (
            <FallbackGapRow key={i} query={q} />
          ))}
          {realKBGaps.length > 12 && (
            <div
              style={{
                padding: "10px 16px",
                fontSize: 12,
                color: C.muted,
                fontFamily: FONT,
                textAlign: "center",
              }}
            >
              + {realKBGaps.length - 12} more unanswered queries
            </div>
          )}
        </div>
      )}
    </div>
  );
}
