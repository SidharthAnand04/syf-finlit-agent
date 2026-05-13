"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import { LoadingState } from "../../components/LoadingState";
import { useInsights } from "../InsightsContext";
import { InsightsRouteHeader } from "../components/InsightsRouteHeader";
import { SourcePerformanceTable } from "../components/SourcePerformanceTable";

export default function InsightsSourcesPage() {
  const { data, loading, error, activeAnalysis } = useInsights();

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <InsightsRouteHeader title="Sources" subtitle="Which knowledge sources drive citations—and which are idle or at risk." />

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
            <SourcePerformanceTable
              mostCited={data.source_usage.most_cited}
              leastCited={data.source_usage.least_cited}
              neverCited={data.source_usage.never_cited}
              llmRecommendations={activeAnalysis?.sourceRecommendations ?? activeAnalysis?.source_recommendations}
            />
          </div>
        </div>
      )}
    </div>
  );
}
