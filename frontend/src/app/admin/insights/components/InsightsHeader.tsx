"use client";

import { C, FONT } from "../../components/tokens";

interface InsightsHeaderProps {
  onRefresh: () => void;
  loading: boolean;
  onRunAI: () => void;
  llmLoading: boolean;
  hasLlmAnalysis: boolean;
}

export function InsightsHeader({
  onRefresh,
  loading,
  onRunAI,
  llmLoading,
  hasLlmAnalysis,
}: InsightsHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: C.white,
            fontFamily: FONT,
            margin: 0,
            lineHeight: 1.2,
            letterSpacing: "-0.03em",
          }}
        >
          Insights
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.66)", marginTop: 6, fontFamily: FONT }}>
          Chatbot quality, FAQ coverage, and knowledge-base performance
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          className="admin-btn-ghost"
          onClick={onRefresh}
          disabled={loading}
          style={{ fontSize: 12 }}
        >
          {loading ? "Refreshing…" : "Refresh Data"}
        </button>
        <button
          className={hasLlmAnalysis ? "admin-btn-ghost" : "admin-btn-primary"}
          onClick={onRunAI}
          disabled={llmLoading}
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {llmLoading ? "Analyzing…" : hasLlmAnalysis ? "Re-run AI Analysis" : "Run AI Analysis"}
        </button>
      </div>
    </div>
  );
}
