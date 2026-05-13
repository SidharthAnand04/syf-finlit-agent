"use client";

import { useState, useMemo } from "react";
import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type { TopQuestion, GapQuery } from "@/lib/api";
import {
  buildFAQOpportunities,
  truncate,
  type FAQOpportunity,
  type CoverageStatus,
} from "../utils";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge, coverageVariant, priorityVariant } from "./StatusBadge";
import { EmptyState } from "./EmptyState";

type FilterKey =
  | "all"
  | "real"
  | "high"
  | "missing"
  | "low-citation"
  | "strong"
  | "noise"
  | "conversational";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",            label: "All" },
  { key: "real",           label: "Real User" },
  { key: "high",           label: "High Priority" },
  { key: "missing",        label: "Missing Content" },
  { key: "low-citation",   label: "Low Citation" },
  { key: "strong",         label: "Strong Coverage" },
  { key: "noise",          label: "Test / Noise" },
  { key: "conversational", label: "Conversational" },
];

function FAQRow({ opp }: { opp: FAQOpportunity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <tr>
      <td style={{ padding: "11px 14px" }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, color: C.charcoal, fontFamily: FONT, lineHeight: 1.3 }}
        >
          {opp.category}
        </div>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginTop: 2 }}>
          {opp.exampleQueries.length} pattern{opp.exampleQueries.length !== 1 ? "s" : ""}
        </div>
      </td>

      <td style={{ padding: "11px 14px", maxWidth: 240 }}>
        <div style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT, lineHeight: 1.4 }}>
          {truncate(opp.exampleQueries[0] ?? "—", 58)}
        </div>
        {opp.exampleQueries.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              color: C.blue,
              fontFamily: FONT,
              padding: "2px 0",
            }}
          >
            {expanded ? "Show less" : `+${opp.exampleQueries.length - 1} more`}
          </button>
        )}
        {expanded &&
          opp.exampleQueries.slice(1).map((q, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: C.muted,
                fontFamily: FONT,
                marginTop: 3,
                lineHeight: 1.35,
              }}
            >
              {truncate(q, 58)}
            </div>
          ))}
      </td>

      <td style={{ padding: "11px 14px", textAlign: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.charcoal, fontFamily: FONT }}>
          {opp.askedCount}
        </span>
      </td>

      <td style={{ padding: "11px 14px" }}>
        <StatusBadge
          label={opp.coverageStatus}
          variant={coverageVariant(opp.coverageStatus as CoverageStatus)}
        />
      </td>

      <td style={{ padding: "11px 14px" }}>
        <StatusBadge
          label={opp.priority}
          variant={priorityVariant(opp.priority)}
          uppercase
        />
      </td>

      <td style={{ padding: "11px 14px" }}>
        {/* TODO: Citation rate not available per query — backend tracks only at source level */}
        <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>Not tracked</span>
      </td>

      <td style={{ padding: "11px 14px" }}>
        <span style={{ fontSize: 12, color: C.charcoal, fontFamily: FONT }}>
          {opp.recommendedAction}
        </span>
      </td>

      <td style={{ padding: "11px 14px" }}>
        {/* TODO: Wire action buttons to appropriate admin pages (FAQs, Sources, etc.) */}
        <button
          className="admin-btn-ghost"
          style={{ fontSize: 11, padding: "3px 10px", whiteSpace: "nowrap" }}
          onClick={() => window.alert(`${opp.recommendedAction}\n\nOpen the priority-fix or content-gap action drawer to generate a draft. TODO: wire this row directly to the draft workflow.`)}
        >
          {opp.recommendedAction.startsWith("Keep") ? "View" : "Fix"}
        </button>
      </td>
    </tr>
  );
}

function applyFilter(opps: FAQOpportunity[], key: FilterKey): FAQOpportunity[] {
  switch (key) {
    case "real":
      return opps.filter(
        (o) =>
          o.coverageStatus !== "Noise" &&
          o.category !== "Test / Noise" &&
          o.category !== "Developer Debug"
      );
    case "high":         return opps.filter((o) => o.priority === "High");
    case "missing":      return opps.filter((o) => o.coverageStatus === "Missing");
    case "low-citation": return opps.filter((o) => o.source === "low_citation" || o.source === "mixed");
    case "strong":       return opps.filter((o) => o.coverageStatus === "Strong");
    case "noise":
      return opps.filter(
        (o) =>
          o.coverageStatus === "Noise" ||
          o.category === "Test / Noise" ||
          o.category === "Developer Debug"
      );
    case "conversational": return opps.filter((o) => o.category === "Conversational" || o.category === "Conversational Greeting");
    default:             return opps;
  }
}

interface FAQOpportunityTableProps {
  topQuestions: TopQuestion[];
  knowledgeGaps: GapQuery[];
  lowCitation: GapQuery[];
}

export function FAQOpportunityTable({
  topQuestions,
  knowledgeGaps,
  lowCitation,
}: FAQOpportunityTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("real");

  const allOpportunities = useMemo(
    () => buildFAQOpportunities({ topQuestions, knowledgeGaps, lowCitation }),
    [topQuestions, knowledgeGaps, lowCitation]
  );

  const filtered = useMemo(
    () => applyFilter(allOpportunities, activeFilter),
    [allOpportunities, activeFilter]
  );

  const countFor = (key: FilterKey) => applyFilter(allOpportunities, key).length;
  const highCount = allOpportunities.filter((o) => o.priority === "High").length;
  const noiseCount = allOpportunities.filter(
    (o) => o.coverageStatus === "Noise" || o.category === "Test / Noise" || o.category === "Developer Debug"
  ).length;

  const badges = [
    ...(highCount > 0 ? [{ label: `${highCount} need attention`, color: "red" as const }] : []),
    ...(noiseCount > 0 ? [{ label: `${noiseCount} noise hidden`, color: "neutral" as const }] : []),
  ];

  return (
    <div>
      <SectionHeader
        title="FAQ Opportunities"
        badges={badges}
        note={`${filtered.length} cluster${filtered.length !== 1 ? "s" : ""} shown`}
      />

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: `1px solid ${C.dividerWarm}`,
          background: C.insetMuted,
          borderRadius: "14px 14px 0 0",
          overflowX: "auto",
        }}
      >
        {FILTERS.map(({ key, label }) => {
          const count = countFor(key);
          return (
            <button
              key={key}
              className={`admin-tab${activeFilter === key ? " active" : ""}`}
              onClick={() => setActiveFilter(key)}
              style={{ fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}
            >
              {label}
              {count > 0 && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "0 5px",
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 600,
                    background: activeFilter === key ? C.charcoal : C.insetMuted,
                    border: `1px solid ${activeFilter === key ? "transparent" : C.insetBorder}`,
                    color: activeFilter === key ? C.white : C.charcoal,
                    lineHeight: "16px",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderTop: "none",
          borderRadius: "0 0 18px 18px",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <EmptyState message="No FAQ opportunities match this filter." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>FAQ Opportunity</th>
                  <th style={{ minWidth: 210 }}>Example Queries</th>
                  <th style={{ textAlign: "center", minWidth: 70 }}>Asked</th>
                  <th style={{ minWidth: 100 }}>Coverage</th>
                  <th style={{ minWidth: 90 }}>Priority</th>
                  <th style={{ minWidth: 100 }}>Citation Rate</th>
                  <th style={{ minWidth: 160 }}>Recommended Action</th>
                  <th style={{ minWidth: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((opp) => (
                  <FAQRow key={opp.category} opp={opp} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
