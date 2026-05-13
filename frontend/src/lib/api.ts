const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ── Chat API ───────────────────────────────────────────────────────────────

export interface Citation {
  // Backward-compat keys
  source: string;
  chunk_id: number;
  snippet: string;
  // Rich metadata for UI source cards
  display_title: string;
  display_url: string | null;
  source_type: string;
  section_heading: string | null;
  page_number: number | null;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  followups: string[];
}

export async function sendMessage(
  message: string,
  session_id: string | null = null,
  markdown: boolean = true
): Promise<ChatResponse> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id, markdown }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json() as Promise<ChatResponse>;
}

// ── FAQ public API ─────────────────────────────────────────────────────────

export interface ActiveFAQ {
  id: number;
  category: string;
  question: string;
  answer_note: string;
}

export async function getActiveFaqs(): Promise<ActiveFAQ[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/faqs`);
    if (!res.ok) return [];
    return res.json() as Promise<ActiveFAQ[]>;
  } catch {
    return [];
  }
}

// ── Admin API ──────────────────────────────────────────────────────────────

export interface Source {
  id: number;
  type: string;
  name: string;
  url: string | null;
  enabled: boolean;
  tags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_fetched_at: string | null;
  doc_status: string | null;
  doc_error: string | null;
  chunk_count: number | null;
}

export interface IngestionRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: Record<string, unknown>;
}

export interface FAQ {
  id: number;
  category: string;
  question: string;
  answer_note: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PersonalityConfig {
  persona_name: string;
  tone_description: string;
  system_prompt_override: string | null;
  extra_rules: string[];
}

export interface QueryChunk {
  rank: number;
  score: number;
  source: string;
  url: string | null;
  section_heading: string | null;
  page_number: number | null;
  source_type: string;
  text_preview: string;
}

async function adminFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = parseJsonValue(text) as { detail?: string };
      detail = err.detail ?? detail;
    } catch {
      if (text) detail = text.slice(0, 240);
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return parseJsonValue(text);
}

function parseJsonValue(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Backend returned invalid JSON: ${message}`);
  }
}

function parseMaybeJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { _raw: value };
  } catch {
    return { _raw: value };
  }
}

function extractRawJsonObject(value: string): Record<string, unknown> | null {
  const start = value.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < value.length; i += 1) {
    const ch = value[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") inString = true;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return parseMaybeJsonObject(value.slice(start, i + 1));
      }
    }
  }
  return null;
}

function rawValueForKey(value: string, key: string): unknown {
  const keyMatch = value.match(new RegExp(`"${key}"\\s*:`));
  if (!keyMatch || keyMatch.index == null) return undefined;
  const afterKey = value.slice(keyMatch.index + keyMatch[0].length).trimStart();

  if (afterKey.startsWith("\"")) {
    const stringMatch = afterKey.match(/^"(?:\\.|[^"\\])*"/);
    if (!stringMatch) return undefined;
    try {
      return JSON.parse(stringMatch[0]);
    } catch {
      return undefined;
    }
  }

  if (afterKey.startsWith("{")) {
    const objectText = extractBalancedObject(afterKey);
    return objectText ? parseMaybeJsonObject(objectText) : undefined;
  }

  const scalar = afterKey.match(/^-?\d+(?:\.\d+)?|^(?:true|false|null)/)?.[0];
  if (!scalar) return undefined;
  try {
    return JSON.parse(scalar);
  } catch {
    return undefined;
  }
}

function extractBalancedObject(value: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") inString = true;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return value.slice(0, i + 1);
    }
  }
  return null;
}

function salvageRawReport(value: string): Record<string, unknown> {
  const fullObject = extractRawJsonObject(value);
  if (fullObject) return fullObject;

  const executiveSummary = rawValueForKey(value, "executiveSummary") ?? rawValueForKey(value, "executive_summary");
  const health = rawValueForKey(value, "health");
  const healthScore = rawValueForKey(value, "health_score");
  const healthReasoning = rawValueForKey(value, "health_reasoning");
  return {
    ...(typeof executiveSummary === "string" ? { executiveSummary, executive_summary: executiveSummary } : {}),
    ...(health && typeof health === "object" && !Array.isArray(health) ? { health } : {}),
    ...(typeof healthScore === "number" ? { health_score: healthScore } : {}),
    ...(typeof healthReasoning === "string" ? { health_reasoning: healthReasoning } : {}),
  };
}

function arrayValue<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeLlmAnalysis(value: unknown): LlmAnalysisResult {
  let report = parseMaybeJsonObject(value);
  const rawReport = typeof report._raw === "string" ? salvageRawReport(report._raw) : null;
  if (
    rawReport &&
    (report.health_reasoning === "Parse error" || report.executive_summary === "Analysis could not be parsed. Raw output below.")
  ) {
    report = { ...report, ...rawReport, _raw: report._raw };
  }
  const health = parseMaybeJsonObject(report.health);
  const score = numberValue(health.score) ?? numberValue(report.health_score);
  const executiveSummary = typeof report.executiveSummary === "string"
    ? report.executiveSummary
    : typeof report.executive_summary === "string"
      ? report.executive_summary
      : "No executive summary generated.";
  const contentGaps = arrayValue<ContentGap>(report.contentGaps).length
    ? arrayValue<ContentGap>(report.contentGaps)
    : arrayValue<ContentGap>(report.content_gaps);
  const sourceRecommendations = arrayValue<SourceRecommendation>(report.sourceRecommendations).length
    ? arrayValue<SourceRecommendation>(report.sourceRecommendations)
    : arrayValue<SourceRecommendation>(report.source_recommendations);
  const retrievalDiagnostics = arrayValue<RetrievalIssue>(report.retrievalDiagnostics).length
    ? arrayValue<RetrievalIssue>(report.retrievalDiagnostics)
    : arrayValue<RetrievalIssue>(report.retrieval_issues);

  return {
    ...report,
    executiveSummary,
    executive_summary: executiveSummary,
    health: {
      score,
      status: typeof health.status === "string" ? (health.status as ReportHealth["status"]) : "Unknown",
      riskLevel: typeof health.riskLevel === "string"
        ? (health.riskLevel as ReportHealth["riskLevel"])
        : typeof health.risk_level === "string"
          ? (health.risk_level as ReportHealth["riskLevel"])
          : "Unknown",
      mainProblem: typeof health.mainProblem === "string"
        ? health.mainProblem
        : typeof health.main_problem === "string"
          ? health.main_problem
          : "Review priority fixes and content gaps.",
      topAction: typeof health.topAction === "string"
        ? health.topAction
        : typeof health.top_action === "string"
          ? health.top_action
          : "Run AI Analysis again after adding more chat data.",
    },
    health_score: score,
    health_reasoning: typeof report.health_reasoning === "string" ? report.health_reasoning : "",
    priorityFixes: arrayValue<ReportPriorityFix>(report.priorityFixes),
    questionThemes: arrayValue<QuestionTheme>(report.questionThemes),
    topic_clusters: arrayValue<TopicCluster>(report.topic_clusters),
    contentGaps,
    content_gaps: contentGaps,
    riskComplianceSignals: arrayValue<RiskComplianceSignal>(report.riskComplianceSignals),
    sourceRecommendations,
    source_recommendations: sourceRecommendations,
    retrievalDiagnostics,
    retrieval_issues: retrievalDiagnostics,
    faqDrafts: arrayValue<FaqDraft>(report.faqDrafts),
    kbDrafts: arrayValue<KbDraft>(report.kbDrafts),
    visualizationData: parseMaybeJsonObject(report.visualizationData),
    quick_wins: arrayValue<string>(report.quick_wins),
  } as LlmAnalysisResult;
}

export function normalizeSavedInsightReport(value: unknown): SavedInsightReport {
  const row = parseMaybeJsonObject(value) as unknown as SavedInsightReport;
  return {
    ...row,
    report: normalizeLlmAnalysis((row as { report?: unknown }).report),
  };
}

export interface TimeRangeParams {
  time_range_start?: string | null;
  time_range_end?: string | null;
}

function withTimeRange(path: string, range?: TimeRangeParams): string {
  const params = new URLSearchParams();
  if (range?.time_range_start) params.set("time_range_start", range.time_range_start);
  if (range?.time_range_end) params.set("time_range_end", range.time_range_end);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export const adminApi = {
  listSources: (token: string) =>
    adminFetch(token, "/sources") as Promise<Source[]>,

  addUrl: (token: string, name: string, url: string) =>
    adminFetch(token, "/sources/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url }),
    }) as Promise<{ id: number; message: string }>,

  uploadPdf: (token: string, name: string, file: File) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", file);
    return adminFetch(token, "/sources/pdf", { method: "POST", body: form }) as Promise<{
      id: number;
      message: string;
    }>;
  },

  toggleEnabled: (token: string, id: number, enabled: boolean) =>
    adminFetch(token, `/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }),

  deleteSource: (token: string, id: number) =>
    adminFetch(token, `/sources/${id}`, { method: "DELETE" }),

  ingestAll: (token: string) =>
    adminFetch(token, "/ingest/run", { method: "POST" }),

  ingestOne: (token: string, id: number) =>
    adminFetch(token, `/ingest/source/${id}`, { method: "POST" }),

  listRuns: (token: string) =>
    adminFetch(token, "/ingest/runs") as Promise<IngestionRun[]>,

  getPersonality: (token: string) =>
    adminFetch(token, "/personality") as Promise<PersonalityConfig>,

  setPersonality: (token: string, update: Partial<PersonalityConfig> & { clear_override?: boolean }) =>
    adminFetch(token, "/personality", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }) as Promise<{ message: string; config: PersonalityConfig }>,

  resetPersonality: (token: string) =>
    adminFetch(token, "/personality/reset", { method: "POST" }) as Promise<{
      message: string;
      config: PersonalityConfig;
    }>,

  queryTest: (token: string, query: string, k = 4) =>
    adminFetch(token, "/query-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, k }),
    }) as Promise<{ query: string; chunks: QueryChunk[] }>,

  getInsights: (token: string, range?: TimeRangeParams) =>
    adminFetch(token, withTimeRange("/insights", range)) as Promise<InsightsData>,

  getLlmAnalysis: (token: string, range?: TimeRangeParams) =>
    adminFetch(token, withTimeRange("/insights/llm-analysis", range), { method: "POST" })
      .then(normalizeLlmAnalysis),

  listInsightReports: (token: string, limit = 20) =>
    adminFetch(token, `/insights/reports?limit=${limit}`) as Promise<InsightReportSummary[]>,

  getInsightReport: (token: string, id: string) =>
    adminFetch(token, `/insights/reports/${encodeURIComponent(id)}`)
      .then(normalizeSavedInsightReport),

  listFaqs: (token: string) =>
    adminFetch(token, "/faqs") as Promise<FAQ[]>,

  addFaq: (token: string, faq: { category: string; question: string; answer_note: string; active: boolean; sort_order?: number }) =>
    adminFetch(token, "/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(faq),
    }) as Promise<FAQ>,

  updateFaq: (token: string, id: number, update: Partial<{ category: string; question: string; answer_note: string; active: boolean; sort_order: number }>) =>
    adminFetch(token, `/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }) as Promise<{ message: string }>,

  deleteFaq: (token: string, id: number) =>
    adminFetch(token, `/faqs/${id}`, { method: "DELETE" }) as Promise<{ message: string }>,
};

// ── Insights API types ────────────────────────────────────────────────────────

export interface InsightsSummary {
  total_interactions: number;
  unique_sessions: number;
  avg_response_ms: number;
  p95_response_ms: number;
  followup_pct: number;
  avg_chunks_retrieved: number;
  zero_chunk_queries: number;
}

export interface QuestionTypeCount {
  question_type: string;
  count: number;
}

export interface TopQuestion {
  user_message: string;
  times_asked: number;
  question_type: string;
  last_asked: string;
}

export interface DailyCount {
  day: string;
  interactions: number;
  sessions: number;
}

export interface SourceUsageItem {
  title: string;
  url: string | null;
  citation_count: number;
}

export interface GapQuery {
  user_message: string;
  times_asked: number;
  last_asked: string;
  avg_chunks?: number;
}

export interface HourlyCount {
  hour_utc: number;
  count: number;
}

export interface InsightsData {
  summary: InsightsSummary;
  question_types: QuestionTypeCount[];
  top_questions: TopQuestion[];
  daily_counts: DailyCount[];
  source_usage: {
    most_cited: SourceUsageItem[];
    least_cited: SourceUsageItem[];
    never_cited: { title: string; url: string | null }[];
  };
  knowledge_gaps: GapQuery[];
  low_citation: GapQuery[];
  hourly_heatmap: HourlyCount[];
}

// ── LLM Analysis types ────────────────────────────────────────────────────────

export interface TopicCluster {
  topic: string;
  description: string;
  question_count: number;
  example_questions: string[];
  coverage: "good" | "partial" | "gap";
  coverage_note: string;
}

export interface ContentGap {
  title: string;
  description: string;
  evidence: string[];
  priority: "high" | "medium" | "low";
  suggested_action: string;
  suggestedAction?: string;
  riskLevel?: "Low" | "Medium" | "High";
  currentCoverage?: string;
  missingSource?: string;
}

export interface SourceRecommendation {
  source_name: string;
  finding: string;
  recommendation: string;
  type: "improve" | "add" | "remove" | "review";
}

export interface RetrievalIssue {
  title: string;
  description: string;
  affected_questions: string[];
  suggested_fix: string;
}

export interface ReportHealth {
  score: number | null;
  status: "Excellent" | "Good" | "Needs Attention" | "Critical" | "Unknown";
  riskLevel: "Low" | "Medium" | "High" | "Unknown";
  mainProblem: string;
  topAction: string;
}

export interface ReportPriorityFix {
  problem: string;
  severity: "High" | "Medium" | "Low";
  evidence: string;
  impact: string;
  recommendedFix: string;
  effort: "Quick" | "Medium" | "Involved";
  confidence: "High" | "Medium" | "Low";
  owner: "Content" | "Engineering" | "Compliance" | "Admin" | string;
  actionType: "faq" | "kb" | "source" | "retrieval" | "risk" | "performance" | string;
}

export interface QuestionTheme {
  theme: string;
  description: string;
  askedCount: number;
  coverage: "Strong" | "Partial" | "Weak" | "Missing";
  riskLevel: "Low" | "Medium" | "High";
  exampleQueries: string[];
  recommendedAction: string;
}

export interface RiskComplianceSignal {
  category: string;
  count: number;
  severity: "High" | "Medium" | "Low";
  exampleQueries: string[];
  safeHandling: "Not tracked" | "Handled safely" | "Needs review" | string;
  recommendedRouting: string;
}

export interface FaqDraft {
  canonicalQuestion: string;
  alternatePhrasings: string[];
  suggestedAnswer: string;
  suggestedSources: string[];
  tags: string[];
}

export interface KbDraft {
  title: string;
  body: string;
  tags: string[];
  relatedQueries: string[];
  riskDisclaimer?: string;
}

export interface LlmAnalysisResult {
  executiveSummary?: string;
  executive_summary: string;
  health?: ReportHealth;
  health_score: number | null;
  health_reasoning: string;
  priorityFixes?: ReportPriorityFix[];
  questionThemes?: QuestionTheme[];
  topic_clusters: TopicCluster[];
  contentGaps?: ContentGap[];
  content_gaps: ContentGap[];
  riskComplianceSignals?: RiskComplianceSignal[];
  sourceRecommendations?: SourceRecommendation[];
  source_recommendations: SourceRecommendation[];
  retrievalDiagnostics?: RetrievalIssue[];
  retrieval_issues: RetrievalIssue[];
  faqDrafts?: FaqDraft[];
  kbDrafts?: KbDraft[];
  visualizationData?: Record<string, unknown>;
  quick_wins: string[];
  _saved_report?: SavedInsightReport;
  _raw?: string;
}

export interface InsightReportSummary {
  id: string;
  created_at: string;
  updated_at: string;
  report_type: string;
  time_range_start: string | null;
  time_range_end: string | null;
  status: "running" | "completed" | "failed";
  health_score: number | null;
  health_status: string | null;
  risk_level: string | null;
  executive_summary: string | null;
  main_problem: string | null;
  top_action: string | null;
  model_name: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SavedInsightReport extends InsightReportSummary {
  input_snapshot: Record<string, unknown> | null;
  report: LlmAnalysisResult;
  created_by: string | null;
}
