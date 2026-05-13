"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import { LoadingState } from "../../components/LoadingState";
import { useInsights } from "../InsightsContext";
import { InsightsRouteHeader } from "../components/InsightsRouteHeader";
import { DecisionContentGaps, UserQuestionThemes } from "../components/DecisionDashboard";
import { FAQOpportunityTable } from "../components/FAQOpportunityTable";

export default function InsightsQuestionsPage() {
  const { data, loading, error, activeAnalysis, setActiveAction } = useInsights();

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <InsightsRouteHeader
        title="Questions & gaps"
        subtitle="User themes, FAQ opportunities, and content gaps ranked by impact."
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
            <UserQuestionThemes data={data} analysis={activeAnalysis} />
          </div>

          <div className="admin-group-frame">
            <FAQOpportunityTable
              topQuestions={data.top_questions}
              knowledgeGaps={data.knowledge_gaps}
              lowCitation={data.low_citation}
            />
          </div>

          <div className="admin-group-frame">
            <DecisionContentGaps
              gaps={activeAnalysis?.contentGaps ?? activeAnalysis?.content_gaps}
              fallbackGaps={data.knowledge_gaps}
              onAction={setActiveAction}
            />
          </div>
        </div>
      )}
    </div>
  );
}
