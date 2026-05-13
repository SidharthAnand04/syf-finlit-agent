"use client";

import { useState } from "react";
import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { GapQuery, RetrievalIssue, InsightsSummary } from "@/lib/api";
import { filterNoiseQueries, truncate, fmt } from "../utils";
import { SectionHeader } from "./SectionHeader";

interface DiagCard {
  id: string;
  title: string;
  description: string;
  exampleQueries: string[];
  fix: string;
  count?: number;
}

function DiagnosticCard({ card }: { card: DiagCard }) {
  return (
    <div
      style={{
        ...GLASS_CARD_STYLE,
        borderRadius: 18,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.charcoal,
            fontFamily: FONT,
            lineHeight: 1.3,
            flex: 1,
          }}
        >
          {card.title}
        </div>
        {card.count !== undefined && (
          <span
            style={{
              display: "inline-block",
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: card.count > 0 ? "#fef3c7" : C.inset,
              border: `1px solid ${card.count > 0 ? "rgba(146,64,14,0.2)" : C.insetBorder}`,
              color: card.count > 0 ? "#92400e" : "#4b5563",
              fontFamily: FONT,
              flexShrink: 0,
            }}
          >
            {card.count}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: C.muted,
          fontFamily: FONT,
          lineHeight: 1.6,
          marginBottom: card.exampleQueries.length > 0 ? 8 : 6,
        }}
      >
        {card.description}
      </div>

      {card.exampleQueries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
          {card.exampleQueries.slice(0, 2).map((q, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: C.charcoal,
                background: "rgba(251,198,0,0.14)",
                border: `1px solid ${C.goldGlassBorder}`,
                borderRadius: 10,
                padding: "3px 8px",
                fontFamily: FONT,
                lineHeight: 1.4,
              }}
            >
              &ldquo;{truncate(q, 65)}&rdquo;
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#1e40af",
          background: C.blueBg,
          border: "1px solid rgba(30,64,175,0.14)",
          borderRadius: 10,
          padding: "3px 9px",
          display: "inline-block",
          fontFamily: FONT,
        }}
      >
        Fix: {card.fix}
      </div>
    </div>
  );
}

interface RetrievalDiagnosticsProps {
  knowledgeGaps: GapQuery[];
  lowCitation: GapQuery[];
  summary: InsightsSummary;
  llmRetrievalIssues?: RetrievalIssue[];
}

export function RetrievalDiagnostics({
  knowledgeGaps,
  lowCitation,
  summary,
  llmRetrievalIssues,
}: RetrievalDiagnosticsProps) {
  const [open, setOpen] = useState(true);

  const realGaps = filterNoiseQueries(knowledgeGaps);
  const realLowCite = filterNoiseQueries(lowCitation);
  const zeroChunk = summary.zero_chunk_queries ?? 0;
  const avgChunks = summary.avg_chunks_retrieved ?? 0;
  const p95 = summary.p95_response_ms ?? 0;

  const computedCards: DiagCard[] = [];

  if (zeroChunk > 0) {
    computedCards.push({
      id: "zero-chunk",
      title: "Zero-Chunk Retrieval",
      description:
        "These queries returned no KB chunks. The chatbot answered from its base model without KB grounding.",
      exampleQueries: realGaps.slice(0, 2).map((q) => q.user_message),
      fix: "Add KB sources covering these topics, or improve query expansion in the retrieval pipeline",
      count: zeroChunk,
    });
  }

  if (realLowCite.length > 0) {
    computedCards.push({
      id: "low-cite",
      title: "Low Citation Despite Retrieval",
      description:
        "Chunks were retrieved but not included in the final response. Retrieved content may not be relevant enough to cite.",
      exampleQueries: realLowCite.slice(0, 2).map((q) => q.user_message),
      fix: "Improve source content quality; ensure headings and titles clearly match user queries",
      count: realLowCite.length,
    });
  }

  if (avgChunks > 7) {
    computedCards.push({
      id: "high-chunks",
      title: "High Chunks Per Query",
      description: `Average of ${Math.round(avgChunks * 10) / 10} chunks/query. High counts may indicate duplicate or overly broad sources, diluting retrieval precision.`,
      exampleQueries: [],
      fix: "Audit KB sources for duplicates; split broad sources into focused topics",
    });
  }

  if (p95 > 3000) {
    computedCards.push({
      id: "slow-retrieval",
      title: "Slow Retrieval Latency",
      description: `P95 response time is ${fmt(p95)}ms. Slow responses may indicate inefficient vector search or excessive chunk processing overhead.`,
      exampleQueries: [],
      fix: "Profile retrieval steps; consider reducing top-k chunks or optimizing the vector index",
    });
  }

  const llmCards: DiagCard[] = (llmRetrievalIssues ?? []).map((issue) => ({
    id: `llm-${issue.title}`,
    title: issue.title,
    description: issue.description,
    exampleQueries: issue.affected_questions,
    fix: issue.suggested_fix,
  }));

  const allCards = [...computedCards, ...llmCards];

  if (allCards.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: open ? 12 : 0,
          width: "100%",
          textAlign: "left" as const,
        }}
      >
        <SectionHeader
          title="Retrieval Diagnostics"
          badges={[{ label: `${allCards.length} issue${allCards.length !== 1 ? "s" : ""}`, color: "yellow" }]}
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
        <>
          <div
            style={{
              fontSize: 12,
              color: C.muted,
              fontFamily: FONT,
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Technical retrieval diagnostics for engineering review. These do not block users, but
            reducing them improves answer quality.
          </div>
          <div className="admin-insights-grid">
            {allCards.map((card) => (
              <DiagnosticCard key={card.id} card={card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
