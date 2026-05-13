"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import { LoadingState } from "../../components/LoadingState";
import { useInsights } from "../InsightsContext";
import { InsightsRouteHeader } from "../components/InsightsRouteHeader";
import { RetrievalDiagnostics } from "../components/RetrievalDiagnostics";
import { TrendAnalytics } from "../components/TrendAnalytics";

export default function InsightsOperationsPage() {
  const { data, loading, error, activeAnalysis } = useInsights();

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <InsightsRouteHeader
        title="Operations"
        subtitle="Retrieval diagnostics, activity, and demand patterns over time."
      />

      {error && (
        <div
          style={{
            fontSize: 13,
            color: C.red,
            background: C.redBg,
            border: `1px solid ${C.redBorder}`,
            borderRadius: 7,
            padding: "9px 14px",
            marginBottom: 20,
            fontFamily: FONT,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18 }}>
          <LoadingState label="Loading insights…" />
        </div>
      ) : !data ? null : (
        <div className="admin-page-stack">
          <div className="admin-group-frame">
            <RetrievalDiagnostics
              knowledgeGaps={data.knowledge_gaps}
              lowCitation={data.low_citation}
              summary={data.summary}
              llmRetrievalIssues={activeAnalysis?.retrievalDiagnostics ?? activeAnalysis?.retrieval_issues}
            />
          </div>

          <div className="admin-group-frame">
            <TrendAnalytics
              dailyCounts={data.daily_counts}
              hourlyHeatmap={data.hourly_heatmap}
              questionTypes={data.question_types}
            />
          </div>
        </div>
      )}
    </div>
  );
}
