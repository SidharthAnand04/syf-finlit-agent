"use client";

import { C, FONT } from "../../components/tokens";
import { useInsights } from "../InsightsContext";
import { InsightsRouteHeader } from "../components/InsightsRouteHeader";
import { SavedInsightReports } from "../components/SavedInsightReports";

export default function InsightsReportsPage() {
  const { reports, reportsLoading, selectedReport, selectReport, llmError } = useInsights();

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <InsightsRouteHeader
        title="Saved AI reports"
        subtitle="Select a report to load its analysis across Dashboard, Questions, Risk, and other Insights views."
      />

      {llmError && (
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
          {llmError}
        </div>
      )}

      <div className="admin-page-stack">
        <div className="admin-group-frame">
          <SavedInsightReports
            reports={reports}
            selectedReport={selectedReport}
            loading={reportsLoading}
            onSelect={selectReport}
          />
        </div>
      </div>
    </div>
  );
}
