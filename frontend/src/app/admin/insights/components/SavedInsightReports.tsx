"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { InsightReportSummary, SavedInsightReport } from "@/lib/api";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";

function variantFor(status?: string | null) {
  if (status === "failed") return "high" as const;
  if (status === "running") return "medium" as const;
  return "success" as const;
}

export function SavedInsightReports({
  reports,
  selectedReport,
  loading,
  onSelect,
}: {
  reports: InsightReportSummary[];
  selectedReport: SavedInsightReport | null;
  loading: boolean;
  onSelect: (report: InsightReportSummary) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Saved AI Insight Reports"
        badges={reports.length ? [{ label: `${reports.length} saved`, color: "blue" }] : []}
        note="Reports are append-only snapshots stored in Supabase"
      />
      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 12, overflow: "hidden" }}>
        {reports.length === 0 ? (
          <div style={{ padding: 22, fontSize: 13, color: C.muted, fontFamily: FONT }}>
            No saved AI insight reports yet. Run AI Analysis to generate the first report.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 0 }}>
            {reports.map((report) => {
              const active = selectedReport?.id === report.id;
              return (
                <button
                  key={report.id}
                  onClick={() => onSelect(report)}
                  disabled={loading}
                  style={{
                    textAlign: "left",
                    border: "none",
                    borderBottom: `1px solid ${C.dividerWarm}`,
                    background: active ? "rgba(251,198,0,0.16)" : C.insetMuted,
                    padding: "13px 16px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: C.charcoal, fontFamily: FONT }}>
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                        <StatusBadge label={report.status} variant={variantFor(report.status)} />
                        {report.risk_level && <StatusBadge label={`${report.risk_level} risk`} variant={report.risk_level === "High" ? "high" : report.risk_level === "Medium" ? "medium" : "success"} />}
                      </div>
                      <div style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT, lineHeight: 1.45 }}>
                        {report.main_problem ?? report.executive_summary ?? "No summary saved."}
                      </div>
                      <div style={{ fontSize: 11, color: "#065f46", fontFamily: FONT, marginTop: 4 }}>
                        {report.top_action ?? "Open report for details"}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.charcoal, fontFamily: FONT, minWidth: 54, textAlign: "right" }}>
                      {report.health_score == null ? "—" : Number(report.health_score).toFixed(1)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
