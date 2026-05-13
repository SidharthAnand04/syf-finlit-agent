"use client";

import { useRouter } from "next/navigation";
import { C, FONT, GLASS_CARD_STYLE } from "../components/tokens";
import { LoadingState } from "../components/LoadingState";
import { useInsights } from "./InsightsContext";
import { InsightsRouteHeader } from "./components/InsightsRouteHeader";
import {
  ExecutiveDecisionSummary,
  QueryOutcomeFunnel,
} from "./components/DecisionDashboard";
import { DecisionPriorityFixes } from "./components/DecisionPriorityFixes";

export default function InsightsDashboardPage() {
  const router = useRouter();
  const {
    data,
    loading,
    error,
    llmAnalysis,
    llmLoading,
    llmError,
    activeRange,
    setActiveRange,
    runLlmAnalysis,
    reports,
    selectedReport,
    activeAnalysis,
    setActiveAction,
  } = useInsights();

  return (
    <div className="admin-page" style={{ fontFamily: FONT }}>
      <InsightsRouteHeader
        title="Insights Dashboard"
        subtitle="Review chatbot health, the most important fixes, and whether user questions are reaching grounded answers."
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
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {error}
        </div>
      )}

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

      {loading ? (
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18 }}>
          <LoadingState label="Loading insights..." />
        </div>
      ) : !data ? null : (
        <div className="admin-page-stack">
          <div className="admin-group-frame">
            <ExecutiveDecisionSummary
              data={data}
              llmAnalysis={llmAnalysis}
              selectedReport={selectedReport}
              reports={reports}
              llmLoading={llmLoading}
              loading={loading}
              activeRange={activeRange}
              onRangeChange={setActiveRange}
              onRunAI={runLlmAnalysis}
              onOpenReports={() => router.push("/admin/insights/reports")}
            />
          </div>

          <div className="admin-group-frame">
            <DecisionPriorityFixes data={data} analysis={activeAnalysis} onAction={setActiveAction} />
          </div>

          <div className="admin-group-frame">
            <QueryOutcomeFunnel data={data} />
          </div>
        </div>
      )}
    </div>
  );
}
