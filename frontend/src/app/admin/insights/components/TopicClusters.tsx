"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { TopicCluster } from "@/lib/api";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge, llmCoverageVariant } from "./StatusBadge";
import { EmptyState } from "./EmptyState";
import { truncate } from "../utils";

const COVERAGE_LABEL: Record<TopicCluster["coverage"], string> = {
  good:    "Good Coverage",
  partial: "Partial Coverage",
  gap:     "Coverage Gap",
};

function ClusterCard({ cluster }: { cluster: TopicCluster }) {
  const coverageVariant = llmCoverageVariant(cluster.coverage);
  const coverageLabel = COVERAGE_LABEL[cluster.coverage];

  return (
    <div
      style={{
        ...GLASS_CARD_STYLE,
        borderRadius: 18,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Title + coverage badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.charcoal,
            fontFamily: FONT,
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {cluster.topic}
        </div>
        <StatusBadge label={coverageLabel} variant={coverageVariant} uppercase />
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 12,
          color: C.muted,
          fontFamily: FONT,
          lineHeight: 1.6,
        }}
      >
        {cluster.coverage_note || truncate(cluster.description, 120)}
      </div>

      {/* Question count + example queries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontFamily: FONT,
          }}
        >
          {cluster.question_count} question{cluster.question_count !== 1 ? "s" : ""} · example{cluster.example_questions.length !== 1 ? "s" : ""}
        </div>
        {cluster.example_questions.slice(0, 2).map((q, i) => (
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
            &ldquo;{truncate(q, 70)}&rdquo;
          </div>
        ))}
      </div>
    </div>
  );
}

interface TopicClustersProps {
  topicClusters?: TopicCluster[];
  onRunAI: () => void;
  llmLoading: boolean;
}

export function TopicClusters({ topicClusters, onRunAI, llmLoading }: TopicClustersProps) {
  const hasClusters = topicClusters && topicClusters.length > 0;
  const gapCount = hasClusters ? topicClusters.filter((c) => c.coverage === "gap").length : 0;
  const goodCount = hasClusters ? topicClusters.filter((c) => c.coverage === "good").length : 0;

  const badges = hasClusters
    ? [
        ...(gapCount > 0 ? [{ label: `${gapCount} gap${gapCount !== 1 ? "s" : ""}`, color: "red" as const }] : []),
        ...(goodCount > 0 ? [{ label: `${goodCount} strong`, color: "green" as const }] : []),
      ]
    : [];

  const runAiAction = !hasClusters && !llmLoading ? (
    <button
      className="admin-btn-ghost"
      onClick={onRunAI}
      style={{ fontSize: 11 }}
    >
      Run AI Analysis
    </button>
  ) : llmLoading ? (
    <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>Analyzing…</span>
  ) : null;

  return (
    <div>
      <SectionHeader
        title="Topic Coverage"
        badges={badges}
        note={!hasClusters && !llmLoading ? "Run AI Analysis to see topic coverage" : undefined}
        action={runAiAction ?? undefined}
        mb={14}
      />

      {!hasClusters ? (
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <EmptyState
            message="No topic coverage data yet."
            subtext="Run AI Analysis above to generate topic cluster analysis from recent interactions."
          />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 10,
          }}
        >
          {topicClusters.map((cluster, i) => (
            <ClusterCard key={i} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  );
}
