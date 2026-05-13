"use client";

import { C, FONT, GLASS_CARD_STYLE } from "../../components/tokens";
import type {
  ContentGap,
  GapQuery,
  InsightReportSummary,
  InsightsData,
  LlmAnalysisResult,
  QuestionTheme,
  RiskComplianceSignal,
  SavedInsightReport,
  TopQuestion,
} from "@/lib/api";
import { calculateHealthScore, buildFAQOpportunities, classifyQuery, truncate } from "../utils";
import { SectionHeader } from "./SectionHeader";
import { StatusBadge } from "./StatusBadge";

export type TimeFilter = "all" | "30d" | "7d";

export interface DashboardAction {
  type: "faq" | "kb" | "source" | "review" | "resolved" | "ignore";
  title: string;
  payload: Record<string, unknown>;
}

function statusVariant(status: string) {
  if (status === "Excellent" || status === "Good") return "success" as const;
  if (status === "Needs Attention") return "medium" as const;
  if (status === "Critical") return "high" as const;
  return "neutral" as const;
}

function riskVariant(risk: string) {
  if (risk === "High") return "high" as const;
  if (risk === "Medium") return "medium" as const;
  return "success" as const;
}

function pct(n: number) {
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

function metricColor(score: number) {
  if (score >= 75) return C.green;
  if (score >= 50) return C.orange;
  return C.red;
}

function SmallMetric({ label, score, note }: { label: string; score: number; note: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: C.charcoal, fontWeight: 700, fontFamily: FONT }}>{label}</span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{pct(score)}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: C.insetMuted, border: `1px solid ${C.insetBorder}`, overflow: "hidden" }}>
        <div style={{ width: pct(score), height: "100%", background: metricColor(score), borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontFamily: FONT }}>{note}</div>
    </div>
  );
}

function getReportAnalysis(selectedReport: SavedInsightReport | null, llmAnalysis: LlmAnalysisResult | null) {
  return selectedReport?.report ?? llmAnalysis;
}

export function ExecutiveDecisionSummary({
  data,
  llmAnalysis,
  selectedReport,
  reports,
  llmLoading,
  loading,
  activeRange,
  onRangeChange,
  onRunAI,
  onOpenReports,
}: {
  data: InsightsData;
  llmAnalysis: LlmAnalysisResult | null;
  selectedReport: SavedInsightReport | null;
  reports: InsightReportSummary[];
  llmLoading: boolean;
  loading: boolean;
  activeRange: TimeFilter;
  onRangeChange: (range: TimeFilter) => void;
  onRunAI: () => void;
  onOpenReports: () => void;
}) {
  const analysis = getReportAnalysis(selectedReport, llmAnalysis);
  const computed = calculateHealthScore(data.summary);
  const health = analysis?.health;
  const score = health?.score ?? analysis?.health_score ?? computed.score;
  const status = health?.status ?? computed.label;
  const riskLevel = health?.riskLevel ?? "Low";
  const noMatchPct = data.summary.total_interactions
    ? (data.summary.zero_chunk_queries / data.summary.total_interactions) * 100
    : 0;
  const lowCitationPressure = data.low_citation.length > 0
    ? Math.min(60, data.low_citation.length * 4)
    : 0;
  const faqOpportunities = buildFAQOpportunities({
    topQuestions: data.top_questions,
    knowledgeGaps: data.knowledge_gaps,
    lowCitation: data.low_citation,
  });
  const weakFaqs = faqOpportunities.filter((o) => ["Missing", "Weak", "Partial"].includes(o.coverageStatus)).length;
  const neverCited = data.source_usage.never_cited.length;
  const riskSignals = deriveRiskSignals(data.top_questions, data.knowledge_gaps, analysis?.riskComplianceSignals);
  const riskScore = riskSignals.some((r) => r.safeHandling === "Not tracked") ? 45 : riskSignals.length ? 65 : 90;
  const selectedStamp = selectedReport?.created_at ?? analysis?._saved_report?.created_at ?? null;

  return (
    <div style={{ ...GLASS_CARD_STYLE, borderRadius: 16, overflow: "hidden" }}>
      <div
        style={{
          padding: "20px 24px",
          background: "linear-gradient(135deg, rgba(251,198,0,0.22), rgba(255,255,255,0.10))",
          borderBottom: `1px solid ${C.glassBorder}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <StatusBadge label={status} variant={statusVariant(status)} size="md" />
              <StatusBadge label={`${riskLevel} risk`} variant={riskVariant(riskLevel)} size="md" />
              {selectedReport && <StatusBadge label="Saved report" variant="info" size="md" />}
            </div>
            <h1 style={{ margin: 0, color: C.charcoal, fontFamily: FONT, fontSize: 25, lineHeight: 1.15 }}>
              Priority Fix
            </h1>
            <p style={{ margin: "8px 0 0", color: C.charcoal, fontFamily: FONT, fontSize: 14, lineHeight: 1.55 }}>
              {health?.mainProblem ?? analysis?.health_reasoning ?? computed.diagnosis}
            </p>
          </div>
          <div style={{ minWidth: 210, textAlign: "right" }}>
            <div style={{ fontSize: 42, lineHeight: 1, color: C.charcoal, fontFamily: FONT, fontWeight: 800 }}>
              {score == null ? "—" : Number(score).toFixed(1)}
              <span style={{ fontSize: 15, color: C.muted, fontWeight: 500 }}>/10</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginTop: 6 }}>
              Last analysis: {selectedStamp ? new Date(selectedStamp).toLocaleString() : "Not run yet"}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.50)",
            border: "1px solid rgba(255,255,255,0.50)",
            color: C.charcoal,
            fontFamily: FONT,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong>Recommended Action:</strong> {health?.topAction ?? "Start with high-priority content gaps and weak sources below."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button className="admin-btn-primary" onClick={onRunAI} disabled={llmLoading}>
            {llmLoading ? "Analyzing..." : "Run AI Analysis"}
          </button>
          <button className="admin-btn-ghost" onClick={onOpenReports}>
            View Previous Reports ({reports.length})
          </button>
          {(["all", "30d", "7d"] as TimeFilter[]).map((range) => (
            <button
              key={range}
              className={`admin-btn-ghost${activeRange === range ? " active" : ""}`}
              onClick={() => onRangeChange(range)}
              disabled={loading}
              style={{
                background: activeRange === range ? C.charcoal : undefined,
                color: activeRange === range ? C.white : undefined,
              }}
            >
              {range === "all" ? "All data" : range === "30d" ? "Last 30 days" : "Last 7 days"}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-insights-metric-strip" style={{ padding: "16px 20px" }}>
        <SmallMetric label="Retrieval Coverage" score={100 - noMatchPct * 4} note={`${data.summary.zero_chunk_queries} questions found no KB match`} />
        <SmallMetric label="Citation Quality" score={100 - lowCitationPressure} note={`${data.low_citation.length} answers retrieved sources but did not cite them`} />
        <SmallMetric label="Response Speed" score={data.summary.p95_response_ms > 5000 ? 35 : data.summary.p95_response_ms > 3000 ? 62 : 88} note={`95th percentile: ${data.summary.p95_response_ms ?? 0}ms`} />
        <SmallMetric label="FAQ Coverage" score={100 - Math.min(70, weakFaqs * 8)} note={`${weakFaqs} topic clusters need stronger FAQ coverage`} />
        <SmallMetric label="Source Health" score={100 - Math.min(75, neverCited * 6)} note={`${neverCited} knowledge sources were never cited`} />
        <SmallMetric label="Risk Handling" score={riskScore} note={riskSignals.length ? `${riskSignals.length} risk patterns need review` : "No risk patterns found"} />
      </div>
    </div>
  );
}

export function QueryOutcomeFunnel({ data }: { data: InsightsData }) {
  const total = data.summary.total_interactions || 0;
  const noMatch = data.summary.zero_chunk_queries || 0;
  const retrieved = Math.max(total - noMatch, 0);
  const lowCitation = data.low_citation.reduce((sum, q) => sum + (q.times_asked || 1), 0);
  const cited = Math.max(retrieved - lowCitation, 0);
  const followups = Math.round((total * (data.summary.followup_pct || 0)) / 100);
  const rows = [
    { label: "Total Queries", value: total, note: "All user questions in this reporting window" },
    { label: "Retrieved KB Chunks", value: retrieved, note: "Questions where grounding content was available" },
    { label: "Cited Answers", value: cited, note: "Answers that likely used retrieved source material" },
    { label: "Follow-Ups", value: followups, note: "Follow-up questions may indicate unclear or incomplete answers" },
    { label: "No-Match Queries", value: noMatch, note: "Questions answered without a knowledge-base match" },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div>
      <SectionHeader title="Grounded Answer Flow" badges={[{ label: `${noMatch} No Match`, color: noMatch > 0 ? "yellow" : "green" }]} />
      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div key={row.label}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.charcoal, fontFamily: FONT }}>{row.label}</span>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>{row.value.toLocaleString()}</span>
              </div>
              <div style={{ height: 9, borderRadius: 99, background: C.insetMuted, border: `1px solid ${C.insetBorder}`, overflow: "hidden" }}>
                <div style={{ width: pct((row.value / max) * 100), height: "100%", background: row.label.includes("No-Match") ? C.red : C.gold, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT, marginTop: 3 }}>{row.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function themeFromOpportunity(opp: ReturnType<typeof buildFAQOpportunities>[number]): QuestionTheme {
  const riskLevel = classifyRiskText(opp.exampleQueries.join(" ")).severity;
  return {
    theme: opp.category,
    description: `${opp.coverageStatus} coverage across ${opp.exampleQueries.length} observed pattern${opp.exampleQueries.length === 1 ? "" : "s"}.`,
    askedCount: opp.askedCount,
    coverage: opp.coverageStatus === "Noise" ? "Missing" : opp.coverageStatus,
    riskLevel,
    exampleQueries: opp.exampleQueries,
    recommendedAction: opp.recommendedAction,
  };
}

export function UserQuestionThemes({
  data,
  analysis,
}: {
  data: InsightsData;
  analysis: LlmAnalysisResult | null;
}) {
  const derived = buildFAQOpportunities({
    topQuestions: data.top_questions,
    knowledgeGaps: data.knowledge_gaps,
    lowCitation: data.low_citation,
  })
    .filter((o) => o.category !== "Test / Noise" && o.category !== "Developer Debug")
    .slice(0, 8)
    .map(themeFromOpportunity);
  const themes = analysis?.questionThemes?.length ? analysis.questionThemes : derived;
  const maxDemand = Math.max(...themes.map((t) => t.askedCount || 0), 1);

  return (
    <div>
      <SectionHeader title="Top User Question Themes" badges={[{ label: `${themes.length} Themes`, color: "blue" }]} />
      <div className="admin-insights-grid">
        {themes.map((theme) => {
          const coverageScore = theme.coverage === "Strong" ? 88 : theme.coverage === "Partial" ? 60 : theme.coverage === "Weak" ? 35 : 12;
          const fixFirst = (theme.askedCount / maxDemand) > 0.55 && coverageScore < 55;
          return (
            <div key={theme.theme} style={{ ...GLASS_CARD_STYLE, borderRadius: 12, padding: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.charcoal, fontFamily: FONT }}>{theme.theme}</div>
                <StatusBadge label={fixFirst ? "Fix First" : theme.coverage} variant={fixFirst ? "high" : theme.coverage === "Strong" ? "success" : "medium"} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT, lineHeight: 1.5, marginBottom: 9 }}>{theme.description}</div>
              <SmallMetric label="Demand vs Coverage" score={(theme.askedCount / maxDemand) * 50 + coverageScore / 2} note={`${theme.askedCount} asks, ${theme.riskLevel} risk`} />
              <div style={{ marginTop: 10, fontSize: 11, color: C.charcoal, fontFamily: FONT, lineHeight: 1.45 }}>
                “{truncate(theme.exampleQueries[0] ?? "No example query", 72)}”
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#065f46", fontFamily: FONT, fontWeight: 700 }}>{theme.recommendedAction}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function deriveRiskSignals(
  topQuestions: TopQuestion[],
  gaps: GapQuery[],
  aiSignals?: RiskComplianceSignal[]
): RiskComplianceSignal[] {
  if (aiSignals?.length) return aiSignals;
  const buckets = new Map<string, { severity: "High" | "Medium" | "Low"; queries: string[]; routing: string }>();
  [...topQuestions.map((q) => q.user_message), ...gaps.map((q) => q.user_message)].forEach((query) => {
    const hit = classifyRiskText(query);
    if (!hit.category) return;
    const existing = buckets.get(hit.category) ?? { severity: hit.severity, queries: [], routing: hit.routing };
    if (existing.queries.length < 3 && !existing.queries.includes(query)) existing.queries.push(query);
    if (hit.severity === "High") existing.severity = "High";
    buckets.set(hit.category, existing);
  });
  return Array.from(buckets.entries()).map(([category, info]) => ({
    category,
    count: info.queries.length,
    severity: info.severity,
    exampleQueries: info.queries,
    safeHandling: "Not tracked",
    recommendedRouting: info.routing,
  }));
}

function classifyRiskText(text: string): { category: string; severity: "High" | "Medium" | "Low"; routing: string } {
  const q = text.toLowerCase();
  if (/(fraud|dispute|stolen|lost card|identity theft|unauthorized)/.test(q)) {
    return { category: "fraud/disputes", severity: "High", routing: "Route to official fraud or card-support channels; do not resolve account-specific claims in chat." };
  }
  if (/(my account|my balance|my payment|my card|account number|ssn|social security|password)/.test(q)) {
    return { category: "account-specific/personal data", severity: "High", routing: "Avoid collecting personal data and route to authenticated Synchrony account support." };
  }
  if (/(approve|approval|qualify|eligible|credit limit|will i get)/.test(q)) {
    return { category: "approval/eligibility", severity: "Medium", routing: "Explain general criteria only; do not guarantee approval or credit terms." };
  }
  if (/(apr|deferred interest|promotional|0%|interest)/.test(q)) {
    return { category: "apr/promotional financing", severity: "Medium", routing: "Use sourced educational language and clarify deferred-interest conditions." };
  }
  if (/(should i|recommend|financial advice|legal advice|tax)/.test(q)) {
    return { category: "advice requests", severity: "Medium", routing: "Give general education and recommend consulting a qualified professional for personal advice." };
  }
  return { category: "", severity: "Low", routing: "" };
}

export function RiskComplianceSection({
  data,
  analysis,
}: {
  data: InsightsData;
  analysis: LlmAnalysisResult | null;
}) {
  const signals = deriveRiskSignals(data.top_questions, data.knowledge_gaps, analysis?.riskComplianceSignals);
  return (
    <div>
      <SectionHeader
        title="Risk And Compliance Signals"
        badges={[{ label: signals.length ? `${signals.length} signals` : "No signals", color: signals.length ? "yellow" : "green" }]}
        note="AI analysis improves these signals when available"
      />
      {signals.length === 0 ? (
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 12, padding: 18, fontSize: 13, color: C.muted, fontFamily: FONT }}>
          No risk-heavy question patterns detected in the current analytics window.
        </div>
      ) : (
        <div className="admin-insights-grid">
          {signals.map((signal) => (
            <div key={signal.category} style={{ ...GLASS_CARD_STYLE, borderRadius: 12, padding: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.charcoal, fontFamily: FONT }}>{signal.category}</div>
                <StatusBadge label={signal.severity} variant={riskVariant(signal.severity)} uppercase />
              </div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT, marginBottom: 8 }}>
                {signal.count} example{signal.count === 1 ? "" : "s"} · Safe handling: {signal.safeHandling}
              </div>
              {signal.exampleQueries.slice(0, 2).map((query) => (
                <div key={query} style={{ fontSize: 11, color: C.charcoal, background: C.inset, border: `1px solid ${C.insetBorder}`, borderRadius: 8, padding: "4px 8px", marginBottom: 4, fontFamily: FONT }}>
                  “{truncate(query, 70)}”
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 11, color: "#065f46", fontFamily: FONT, lineHeight: 1.45 }}>
                {signal.recommendedRouting}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DecisionContentGaps({
  gaps,
  fallbackGaps,
  onAction,
}: {
  gaps?: ContentGap[];
  fallbackGaps: GapQuery[];
  onAction: (action: DashboardAction) => void;
}) {
  const source = gaps?.length
    ? gaps
    : fallbackGaps.slice(0, 6).map((gap) => ({
        title: truncate(gap.user_message, 55),
        description: "This query retrieved no KB chunks and may need a new source or FAQ.",
        evidence: [gap.user_message],
        priority: gap.times_asked > 2 ? "high" as const : "medium" as const,
        suggestedAction: "Add or improve KB content for this question pattern.",
        suggested_action: "Add or improve KB content for this question pattern.",
        currentCoverage: "Missing",
        missingSource: "Not tracked",
      }));
  if (!source.length) return null;
  return (
    <div>
      <SectionHeader title="Missing Synchrony Content" badges={[{ label: `${source.length} Gaps`, color: "red" }]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
        {source.map((gap, i) => (
          <div key={`${gap.title}-${i}`} style={{ ...GLASS_CARD_STYLE, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.charcoal, fontFamily: FONT }}>{gap.title}</div>
              <StatusBadge label={gap.priority} variant={gap.priority === "high" ? "high" : gap.priority === "medium" ? "medium" : "low"} uppercase />
            </div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT, lineHeight: 1.5, marginBottom: 9 }}>{gap.description}</div>
            <div style={{ fontSize: 11, color: C.charcoal, fontFamily: FONT, marginBottom: 8 }}>
              Demand signal: {gap.evidence?.length ? `${gap.evidence.length} evidence quer${gap.evidence.length === 1 ? "y" : "ies"}` : "Not tracked"}
            </div>
            {gap.evidence?.slice(0, 2).map((query) => (
              <div key={query} style={{ fontSize: 11, color: C.charcoal, background: C.inset, border: `1px solid ${C.insetBorder}`, borderRadius: 8, padding: "4px 8px", marginBottom: 4, fontFamily: FONT }}>
                “{truncate(query, 70)}”
              </div>
            ))}
            <div style={{ marginTop: 9, fontSize: 11, color: "#065f46", fontFamily: FONT, fontWeight: 700 }}>
              {gap.suggestedAction ?? gap.suggested_action}
            </div>
            <button
              className="admin-btn-ghost"
              style={{ marginTop: 10, fontSize: 11 }}
              onClick={() => onAction({ type: "kb", title: `Generate KB Draft: ${gap.title}`, payload: { gap } })}
            >
              Generate KB Draft
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
