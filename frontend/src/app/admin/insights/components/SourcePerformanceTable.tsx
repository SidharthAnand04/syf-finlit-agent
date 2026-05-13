"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { SourceUsageItem, SourceRecommendation } from "@/lib/api";
import { buildSourcePerformance, truncate, type SourcePerformance } from "../utils";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";

function classificationVariant(c: SourcePerformance["classification"]) {
  switch (c) {
    case "Strong":            return "success" as const;
    case "Useful, needs edits": return "info" as const;
    case "Rarely cited":      return "warning" as const;
    case "Never cited":       return "high" as const;
    case "Archive candidate": return "neutral" as const;
    case "Compliance-important, low-traffic": return "warning" as const;
  }
}

interface SourcePerformanceTableProps {
  mostCited: SourceUsageItem[];
  leastCited: SourceUsageItem[];
  neverCited: { title: string; url: string | null }[];
  llmRecommendations?: SourceRecommendation[];
}

export function SourcePerformanceTable({
  mostCited,
  leastCited,
  neverCited,
  llmRecommendations,
}: SourcePerformanceTableProps) {
  const sources = buildSourcePerformance({
    most_cited: mostCited,
    least_cited: leastCited,
    never_cited: neverCited,
  });

  const llmRecMap = new Map<string, SourceRecommendation>();
  (llmRecommendations ?? []).forEach((rec) => {
    llmRecMap.set(rec.source_name.toLowerCase().trim(), rec);
  });

  const strongCount = sources.filter((s) => s.classification === "Strong").length;
  const problemCount = sources.filter(
    (s) => s.classification === "Never cited" || s.classification === "Rarely cited"
  ).length;

  const badges = [
    ...(strongCount > 0 ? [{ label: `${strongCount} strong`, color: "green" as const }] : []),
    ...(problemCount > 0 ? [{ label: `${problemCount} need attention`, color: "red" as const }] : []),
  ];

  return (
    <div>
      <SectionHeader
        title="Knowledge Source Performance"
        badges={badges}
        note={sources.length > 0 ? `${sources.length} source${sources.length !== 1 ? "s" : ""}` : undefined}
      />

      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        {sources.length === 0 ? (
          <EmptyState
            message="No source data available yet."
            subtext="Add and index sources to see performance metrics."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Source</th>
                  <th style={{ textAlign: "center", minWidth: 90 }}>Citations</th>
                  <th style={{ minWidth: 150 }}>Status</th>
                  <th style={{ minWidth: 220 }}>Issue / Fix</th>
                  <th style={{ minWidth: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((perf, i) => {
                  const llmRec = llmRecMap.get(perf.title.toLowerCase().trim());
                  const recommendation = llmRec?.recommendation ?? perf.recommendedFix;
                  const issue = llmRec?.finding ?? perf.issue;

                  return (
                    <tr key={i}>
                      <td style={{ padding: "11px 14px" }}>
                        {perf.url ? (
                          <a
                            href={perf.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.blue,
                              fontFamily: FONT,
                              textDecoration: "none",
                            }}
                          >
                            {truncate(perf.title, 42)}
                          </a>
                        ) : (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.charcoal,
                              fontFamily: FONT,
                            }}
                          >
                            {truncate(perf.title, 42)}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: C.charcoal,
                            fontFamily: FONT,
                          }}
                        >
                          {perf.citationCount}
                        </span>
                        {/* TODO: Show cited/retrieved ratio when backend tracks retrieved_count per source */}
                      </td>

                      <td style={{ padding: "11px 14px" }}>
                        <StatusBadge
                          label={perf.classification}
                          variant={classificationVariant(perf.classification)}
                        />
                      </td>

                      <td style={{ padding: "11px 14px" }}>
                        {issue && (
                          <div
                            style={{
                              fontSize: 11,
                              color: C.muted,
                              fontFamily: FONT,
                              marginBottom: 3,
                              lineHeight: 1.35,
                            }}
                          >
                            {truncate(issue, 60)}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 12,
                            color: "#065f46",
                            fontFamily: FONT,
                            lineHeight: 1.35,
                          }}
                        >
                          {truncate(recommendation, 55)}
                        </div>
                      </td>

                      <td style={{ padding: "11px 14px" }}>
                        {/* TODO: Wire action buttons to the Sources admin page for the specific source */}
                        <button
                          className="admin-btn-ghost"
                          style={{ fontSize: 11, padding: "3px 10px" }}
                          onClick={() => window.alert(`Review source: ${perf.title}\n\nIssue: ${issue || "No issue flagged"}\nFix: ${recommendation}\n\nTODO: wire this to a source-detail edit drawer.`)}
                        >
                          {perf.classification === "Never cited"
                            ? "Archive"
                            : perf.classification === "Compliance-important, low-traffic"
                            ? "Review"
                            : perf.classification === "Strong"
                            ? "View"
                            : "Edit"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
