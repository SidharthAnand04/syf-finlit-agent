"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import { LoadingState } from "../../components/LoadingState";
import { useInsights } from "../InsightsContext";
import { InsightsRouteHeader } from "../components/InsightsRouteHeader";
import { RiskComplianceSection } from "../components/DecisionDashboard";

export default function InsightsRiskPage() {
  const { data, loading, error, activeAnalysis } = useInsights();

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <InsightsRouteHeader
        title="Risk & compliance"
        subtitle="Patterns that may need policy-safe routing, disclosure, or escalation."
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
            <RiskComplianceSection data={data} analysis={activeAnalysis} />
          </div>
        </div>
      )}
    </div>
  );
}
