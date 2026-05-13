import type {
  InsightsSummary,
  TopQuestion,
  GapQuery,
  SourceUsageItem,
  ContentGap,
  RetrievalIssue,
} from "@/lib/api";

// ── Query Classification ──────────────────────────────────────────────────────

export type QueryCategory =
  | "Credit Card Application"
  | "Eligibility & Requirements"
  | "Financing Options"
  | "Health & Wellness Financing"
  | "Credit Score Viewing"
  | "Digital Wallets"
  | "Payments & Autopay"
  | "Security & Fraud"
  | "Account Management"
  | "Competitor Comparison"
  | "Risk / Compliance"
  | "Conversational Greeting"
  | "Conversational"
  | "Test / Noise"
  | "Developer Debug"
  | "Unknown";

export type CoverageStatus = "Strong" | "Partial" | "Weak" | "Missing" | "Noise";
export type PriorityLevel = "High" | "Medium" | "Low";

const NOISE_PATTERNS: RegExp[] = [
  /^(hello|hi|hey|howdy|hiya|sup|whats up|yo)\s*[!?.]*$/i,
  /^(thanks|thank you|thx|ty)\s*[!?.]*$/i,
  /^(bye|goodbye|ok|okay|k|yes|no|yeah|nope|sure|cool|nice|great|good|fine|lol|haha)\s*[!?.]*$/i,
  /^test\s*(msg|message|query|123|abc|\d)?\s*[!?.]*$/i,
  /^(ping|check|foo|bar|baz|hello world|lorem ipsum)\s*$/i,
];

const DEV_PATTERNS: RegExp[] = [
  /supabase/i,
  /api[_-]?test/i,
  /rest[_-]?test/i,
  /\bdebug\b/i,
  /admin[_-]?test/i,
  /localhost/i,
  /bearer\s+/i,
];

const GREETING_PATTERNS: RegExp[] = [
  /^(hello|hi|hey|good (morning|afternoon|evening))\b/i,
  /^(can you help|i need help|i have a question|quick question)\b/i,
  /^(what can you do|who are you|are you a bot|what are you)\b/i,
];

const CATEGORY_PATTERNS: Array<{ category: QueryCategory; patterns: RegExp[] }> = [
  {
    category: "Credit Card Application",
    patterns: [
      /\b(apply|application|applying|sign up|new card|open (an?|the) account)\b/i,
      /\bhow (do|can) i (get|apply|obtain|sign up for)\b/i,
    ],
  },
  {
    category: "Eligibility & Requirements",
    patterns: [
      /\b(eligible|eligibility|qualify|qualification|requirements?|who can apply)\b/i,
      /\bcredit score (needed|required|minimum|to qualify)\b/i,
      /\bdo i (qualify|need|have to)\b/i,
    ],
  },
  {
    category: "Financing Options",
    patterns: [
      /\b(financing|finance|payment plan|installment|0% interest|deferred interest|promotional)\b/i,
      /\b(apr|annual percentage rate|interest rate)\b/i,
      /\bpay over time\b/i,
    ],
  },
  {
    category: "Health & Wellness Financing",
    patterns: [
      /\b(health|medical|dental|vision|vet(erinary)?|pet|wellness|carecredit|care credit)\b/i,
      /\b(doctor|hospital|procedure|treatment|surgery|prescription)\b/i,
    ],
  },
  {
    category: "Credit Score Viewing",
    patterns: [
      /\b(credit score|fico|vantage|score monitoring)\b/i,
      /\bcheck (my|the) (credit|score)\b/i,
      /\bview (my|the) (credit|score)\b/i,
      /\bcredit monitoring\b/i,
    ],
  },
  {
    category: "Digital Wallets",
    patterns: [
      /\b(apple pay|google pay|samsung pay|digital wallet|mobile pay|contactless|tap to pay)\b/i,
      /\badd (to|my) wallet\b/i,
    ],
  },
  {
    category: "Payments & Autopay",
    patterns: [
      /\b(autopay|auto.?pay|automatic payment|minimum payment|statement balance|make a payment|pay (my|the) bill)\b/i,
      /\b(due date|payment due|pay off|pay down)\b/i,
      /\b(bank account|routing number|checking account)\b/i,
    ],
  },
  {
    category: "Security & Fraud",
    patterns: [
      /\b(fraud|scam|unauthorized|suspicious|stolen|lost card|dispute|identity theft)\b/i,
      /\b(lock (my|the) card|freeze|compromised|phishing|security alert)\b/i,
    ],
  },
  {
    category: "Account Management",
    patterns: [
      /\b(account|log.?in|sign.?in|password|username|update|change (my|the))\b/i,
      /\b(statement|balance|credit limit|available credit|rewards|points)\b/i,
      /\b(close (my|the) account|cancel|customer service|contact)\b/i,
    ],
  },
  {
    category: "Competitor Comparison",
    patterns: [
      /\b(compare|vs\.?|versus|better than|best card|alternative to)\b/i,
      /\b(chase|capital one|discover|american express|amex|citi|wells fargo|bank of america)\b/i,
      /\bwhich (card|is better|should i|do you recommend)\b/i,
    ],
  },
];

// ── Query helpers ─────────────────────────────────────────────────────────────

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function classifyQuery(query: string): QueryCategory {
  const normalized = normalizeQuery(query);
  if (normalized.length < 4) return "Test / Noise";
  if (DEV_PATTERNS.some((p) => p.test(query))) return "Developer Debug";
  if (NOISE_PATTERNS.some((p) => p.test(normalized))) return "Test / Noise";
  if (
    /\b(fraud|dispute|stolen|lost card|identity theft|unauthorized|ssn|social security|password|financial advice|legal advice|tax advice)\b/i.test(query)
  ) {
    return "Risk / Compliance";
  }
  if (GREETING_PATTERNS.some((p) => p.test(normalized))) return "Conversational Greeting";
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((p) => p.test(query))) return category;
  }
  return "Unknown";
}

export function filterNoiseQueries<T extends { user_message: string }>(items: T[]): T[] {
  return items.filter((item) => {
    const norm = normalizeQuery(item.user_message);
    if (norm.length < 4) return false;
    if (DEV_PATTERNS.some((p) => p.test(item.user_message))) return false;
    if (NOISE_PATTERNS.some((p) => p.test(norm))) return false;
    return true;
  });
}

// ── FAQ Opportunities ─────────────────────────────────────────────────────────

export interface FAQOpportunity {
  category: QueryCategory;
  exampleQueries: string[];
  askedCount: number;
  coverageStatus: CoverageStatus;
  priority: PriorityLevel;
  recommendedAction: string;
  source: "top" | "gap" | "low_citation" | "mixed";
}

type QueryEntry = {
  messages: string[];
  askedCount: number;
  avgChunks: number;
  isGap: boolean;
  isLowCitation: boolean;
};

export function buildFAQOpportunities(params: {
  topQuestions: TopQuestion[];
  knowledgeGaps: GapQuery[];
  lowCitation: GapQuery[];
}): FAQOpportunity[] {
  const { topQuestions, knowledgeGaps, lowCitation } = params;
  const queryMap = new Map<string, QueryEntry>();

  const upsert = (
    msg: string,
    count: number,
    avgChunks: number,
    isGap: boolean,
    isLowCitation: boolean
  ) => {
    const key = normalizeQuery(msg);
    const existing = queryMap.get(key);
    if (existing) {
      if (!existing.messages.includes(msg)) existing.messages.push(msg);
      existing.askedCount = Math.max(existing.askedCount, count);
      if (isGap) existing.isGap = true;
      if (isLowCitation) existing.isLowCitation = true;
      existing.avgChunks = Math.max(existing.avgChunks, avgChunks);
    } else {
      queryMap.set(key, { messages: [msg], askedCount: count, avgChunks, isGap, isLowCitation });
    }
  };

  topQuestions.forEach((q) => upsert(q.user_message, q.times_asked, 2, false, false));
  knowledgeGaps.forEach((q) => upsert(q.user_message, q.times_asked, q.avg_chunks ?? 0, true, false));
  lowCitation.forEach((q) => upsert(q.user_message, q.times_asked, q.avg_chunks ?? 1, false, true));

  // Cluster by category
  const catMap = new Map<QueryCategory, { queries: QueryEntry[]; totalAsked: number }>();
  for (const entry of queryMap.values()) {
    const cat = classifyQuery(entry.messages[0]);
    const existing = catMap.get(cat);
    if (existing) {
      existing.queries.push(entry);
      existing.totalAsked += entry.askedCount;
    } else {
      catMap.set(cat, { queries: [entry], totalAsked: entry.askedCount });
    }
  }

  const results: FAQOpportunity[] = [];

  for (const [category, { queries, totalAsked }] of catMap.entries()) {
    const gapRatio = queries.filter((q) => q.isGap).length / queries.length;
    const lowCiteRatio = queries.filter((q) => q.isLowCitation).length / queries.length;
    const avgChunks = queries.reduce((s, q) => s + q.avgChunks, 0) / queries.length;

    let coverageStatus: CoverageStatus;
    if (category === "Test / Noise" || category === "Developer Debug") {
      coverageStatus = "Noise";
    } else if (gapRatio >= 0.5 || avgChunks < 0.5) {
      coverageStatus = "Missing";
    } else if (gapRatio >= 0.2 || avgChunks < 1.5) {
      coverageStatus = "Weak";
    } else if (lowCiteRatio >= 0.3 || avgChunks < 2.5) {
      coverageStatus = "Partial";
    } else {
      coverageStatus = "Strong";
    }

    const priority = calculatePriority({ coverageStatus, totalAsked, category });
    const recommendedAction = getRecommendedAction({ coverageStatus, category });
    const sorted = [...queries].sort((a, b) => b.askedCount - a.askedCount);
    const exampleQueries = sorted.slice(0, 3).map((q) => q.messages[0]);
    const hasGap = queries.some((q) => q.isGap);
    const hasLow = queries.some((q) => q.isLowCitation);
    const source = hasGap && hasLow ? "mixed" : hasGap ? "gap" : hasLow ? "low_citation" : "top";

    results.push({ category, exampleQueries, askedCount: totalAsked, coverageStatus, priority, recommendedAction, source });
  }

  const priorityOrder: Record<PriorityLevel, number> = { High: 0, Medium: 1, Low: 2 };
  return results.sort((a, b) =>
    priorityOrder[a.priority] !== priorityOrder[b.priority]
      ? priorityOrder[a.priority] - priorityOrder[b.priority]
      : b.askedCount - a.askedCount
  );
}

// ── Priority / Coverage helpers ───────────────────────────────────────────────

export function calculatePriority(item: {
  coverageStatus: CoverageStatus;
  totalAsked: number;
  category: QueryCategory;
}): PriorityLevel {
  const { coverageStatus, totalAsked, category } = item;
  if (category === "Test / Noise" || category === "Developer Debug" || category === "Conversational" || category === "Conversational Greeting") return "Low";
  if (category === "Risk / Compliance" && coverageStatus !== "Strong") return "High";
  if (coverageStatus === "Missing" && totalAsked >= 2) return "High";
  if (coverageStatus === "Missing") return "Medium";
  if (coverageStatus === "Weak" && totalAsked >= 3) return "High";
  if (coverageStatus === "Partial" && totalAsked >= 5) return "Medium";
  if (coverageStatus === "Strong") return "Low";
  return "Medium";
}

export function getRecommendedAction(item: {
  coverageStatus: CoverageStatus;
  category: QueryCategory;
}): string {
  const { coverageStatus, category } = item;
  if (category === "Test / Noise" || category === "Developer Debug") return "Ignore / Filter";
  if (category === "Conversational" || category === "Conversational Greeting") return "Add fallback response";
  if (category === "Risk / Compliance") return "Add compliance-safe routing";
  switch (coverageStatus) {
    case "Missing": return "Add KB draft";
    case "Weak": return "Improve source quality";
    case "Partial": return "Rewrite source metadata";
    case "Strong": return "Keep as-is";
    case "Noise": return "Ignore / Filter";
    default: return "Review";
  }
}

// ── Health Score ──────────────────────────────────────────────────────────────

export type HealthLabel = "Excellent" | "Good" | "Needs Attention" | "Critical";

export interface HealthResult {
  score: number;
  label: HealthLabel;
  color: string;
  bgColor: string;
  borderColor: string;
  diagnosis: string;
  topIssues: string[];
}

export function calculateHealthScore(summary: InsightsSummary): HealthResult {
  let score = 10;
  const issues: string[] = [];
  const total = summary.total_interactions ?? 0;
  const noMatchPct = total > 0 ? ((summary.zero_chunk_queries ?? 0) / total) * 100 : 0;

  if (noMatchPct > 20) {
    score -= 2.5;
    issues.push(`${noMatchPct.toFixed(0)}% of queries return no KB results`);
  } else if (noMatchPct > 10) {
    score -= 1.5;
    issues.push(`${noMatchPct.toFixed(0)}% no-match rate — KB coverage may be insufficient`);
  }

  const followupPct = summary.followup_pct ?? 0;
  if (followupPct > 60) {
    score -= 2;
    issues.push("Very high follow-up rate suggests answers are frequently incomplete");
  } else if (followupPct > 35) {
    score -= 1;
    issues.push(`${followupPct}% follow-up rate — answers may leave users with unanswered questions`);
  }

  const avgChunks = summary.avg_chunks_retrieved ?? 0;
  if (avgChunks < 1 && total > 0) {
    score -= 2;
    issues.push("Avg chunks/query below 1 — KB may be under-indexed or retrieval is failing");
  } else if (avgChunks > 8) {
    score -= 1;
    issues.push("High avg chunks/query — duplicate or overlapping sources may degrade precision");
  }

  const p95 = summary.p95_response_ms ?? 0;
  if (p95 > 5000) {
    score -= 1.5;
    issues.push("P95 response time above 5s — users are experiencing significant delays");
  } else if (p95 > 3000) {
    score -= 0.5;
    issues.push("P95 response time above 3s — response latency could be improved");
  }

  const finalScore = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  const label: HealthLabel =
    finalScore >= 8 ? "Excellent" : finalScore >= 6 ? "Good" : finalScore >= 4 ? "Needs Attention" : "Critical";

  const colorMap: Record<HealthLabel, { color: string; bg: string; border: string }> = {
    Excellent:        { color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
    Good:             { color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
    "Needs Attention":{ color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    Critical:         { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  };
  const { color, bg, border } = colorMap[label];

  const diagnosisMap: Record<HealthLabel, string> = {
    Excellent:         "The chatbot is performing well across KB coverage, retrieval, and response quality.",
    Good:              "The chatbot is working correctly. A few areas could be tightened for better coverage.",
    "Needs Attention": "Several issues are impacting response quality and KB coverage. Review the priority fixes below.",
    Critical:          "Significant issues are preventing the chatbot from reliably serving users. Immediate action recommended.",
  };

  return {
    score: finalScore,
    label,
    color,
    bgColor: bg,
    borderColor: border,
    diagnosis: diagnosisMap[label],
    topIssues: issues.slice(0, 3),
  };
}

// ── Source Performance ────────────────────────────────────────────────────────

export type SourceClassification =
  | "Strong"
  | "Useful, needs edits"
  | "Rarely cited"
  | "Never cited"
  | "Archive candidate"
  | "Compliance-important, low-traffic";

export interface SourcePerformance {
  title: string;
  url: string | null;
  citationCount: number;
  classification: SourceClassification;
  classificationColor: string;
  classificationBg: string;
  issue: string;
  recommendedFix: string;
}

export function classifySourcePerformance(source: {
  title: string;
  url: string | null;
  citation_count: number;
}): SourcePerformance {
  const { title, url, citation_count } = source;
  const riskImportant = /\b(fraud|dispute|stolen|identity|apr|interest|approval|eligib|account|payment|autopay|deferred|promotional)\b/i.test(title);
  if (citation_count === 0) {
    if (riskImportant) {
      return {
        title, url, citationCount: citation_count,
        classification: "Compliance-important, low-traffic",
        classificationColor: "#92400e", classificationBg: "#fef3c7",
        issue: "Low traffic, but topic appears risk-sensitive",
        recommendedFix: "Review before archiving; improve metadata if this should be easier to retrieve",
      };
    }
    return {
      title, url, citationCount: citation_count,
      classification: "Never cited",
      classificationColor: "#991b1b", classificationBg: "#fee2e2",
      issue: "This source has never been cited in any response",
      recommendedFix: "Rewrite source metadata/title, or archive if outdated",
    };
  }
  if (citation_count === 1) {
    return {
      title, url, citationCount: citation_count,
      classification: "Rarely cited",
      classificationColor: "#92400e", classificationBg: "#fef3c7",
      issue: "Cited only once — may be too narrow or hard to retrieve",
      recommendedFix: "Add related query phrasings to the source metadata",
    };
  }
  if (citation_count <= 3) {
    return {
      title, url, citationCount: citation_count,
      classification: "Useful, needs edits",
      classificationColor: "#1e40af", classificationBg: "#dbeafe",
      issue: "Below-average citation rate",
      recommendedFix: "Improve content specificity or add related query phrasings",
    };
  }
  if (citation_count >= 8) {
    return {
      title, url, citationCount: citation_count,
      classification: "Strong",
      classificationColor: "#065f46", classificationBg: "#d1fae5",
      issue: "",
      recommendedFix: "Keep as-is",
    };
  }
  return {
    title, url, citationCount: citation_count,
    classification: "Useful, needs edits",
    classificationColor: "#1e40af", classificationBg: "#dbeafe",
    issue: "Moderate usage — review for quality improvements",
    recommendedFix: "Review content quality and coverage breadth",
  };
}

export function buildSourcePerformance(sourceUsage: {
  most_cited: SourceUsageItem[];
  least_cited: SourceUsageItem[];
  never_cited: { title: string; url: string | null }[];
}): SourcePerformance[] {
  const seen = new Set<string>();
  const all: SourcePerformance[] = [];

  const add = (s: SourceUsageItem) => {
    if (seen.has(s.title)) return;
    seen.add(s.title);
    all.push(classifySourcePerformance(s));
  };

  sourceUsage.most_cited.forEach(add);
  sourceUsage.least_cited.forEach(add);
  sourceUsage.never_cited.forEach((s) => {
    if (seen.has(s.title)) return;
    seen.add(s.title);
    all.push(classifySourcePerformance({ ...s, citation_count: 0 }));
  });

  const order: Record<SourceClassification, number> = {
    Strong: 4,
    "Useful, needs edits": 3,
    "Rarely cited": 2,
    "Never cited": 1,
    "Archive candidate": 0,
    "Compliance-important, low-traffic": 2,
  };
  return all.sort((a, b) => order[b.classification] - order[a.classification]);
}

// ── Priority Fixes ────────────────────────────────────────────────────────────

export interface PriorityFix {
  id: string;
  severity: PriorityLevel;
  title: string;
  evidence: string;
  whyItMatters: string;
  suggestedFix: string;
  effort: "Quick" | "Medium" | "Involved";
  category: "retrieval" | "content" | "source" | "response" | "performance";
}

export function buildPriorityFixes(params: {
  summary: InsightsSummary;
  knowledgeGaps: GapQuery[];
  lowCitation: GapQuery[];
  neverCited: { title: string; url: string | null }[];
}): PriorityFix[] {
  const { summary, knowledgeGaps, lowCitation, neverCited } = params;
  const fixes: PriorityFix[] = [];
  const total = summary.total_interactions ?? 0;
  const noMatchPct = total > 0 ? ((summary.zero_chunk_queries ?? 0) / total) * 100 : 0;

  if ((summary.zero_chunk_queries ?? 0) > 0) {
    fixes.push({
      id: "no-match-rate",
      severity: noMatchPct > 20 ? "High" : noMatchPct > 8 ? "Medium" : "Low",
      title: "Queries retrieving zero KB content",
      evidence: `${summary.zero_chunk_queries} of ${total} queries (${noMatchPct.toFixed(0)}%) retrieved no KB chunks`,
      whyItMatters:
        "When no KB content is retrieved, the chatbot answers from its base model alone, reducing accuracy and trustworthiness for Synchrony-specific questions.",
      suggestedFix: "Review knowledge gaps below and expand KB sources to cover frequent no-match query topics",
      effort: "Involved",
      category: "retrieval",
    });
  }

  const conversationalGaps = knowledgeGaps.filter((q) => classifyQuery(q.user_message) === "Conversational Greeting");
  if (conversationalGaps.length > 0) {
    fixes.push({
      id: "conversational-gaps",
      severity: "Medium",
      title: "Conversational greetings fail retrieval",
      evidence: `${conversationalGaps.length} greeting-type quer${conversationalGaps.length === 1 ? "y" : "ies"} (e.g. "${conversationalGaps[0].user_message}") retrieved no KB results`,
      whyItMatters:
        "Users opening with a greeting receive a generic fallback instead of a welcoming, helpful response that guides them to their next question.",
      suggestedFix: "Add a KB article or chatbot rule to handle conversational openers with a friendly intro",
      effort: "Quick",
      category: "response",
    });
  }

  const realLowCite = filterNoiseQueries(lowCitation);
  if (realLowCite.length > 0) {
    fixes.push({
      id: "low-citation-retrieval",
      severity: realLowCite.length > 5 ? "High" : "Medium",
      title: "KB chunks retrieved but not cited in responses",
      evidence: `${realLowCite.length} quer${realLowCite.length === 1 ? "y" : "ies"} retrieved KB content that was not cited. Example: "${truncate(realLowCite[0].user_message, 60)}"`,
      whyItMatters:
        "Retrieved but uncited content wastes retrieval effort and may indicate irrelevant or poorly structured sources that the LLM chose not to use.",
      suggestedFix: "Improve source content quality and ensure headings/titles clearly match user intent",
      effort: "Medium",
      category: "source",
    });
  }

  if (neverCited.length > 0) {
    fixes.push({
      id: "never-cited-sources",
      severity: neverCited.length > 5 ? "Medium" : "Low",
      title: `${neverCited.length} KB source${neverCited.length > 1 ? "s" : ""} never cited`,
      evidence: `Sources: ${neverCited
        .slice(0, 2)
        .map((s) => `"${truncate(s.title, 35)}"`)
        .join(", ")}${neverCited.length > 2 ? ` and ${neverCited.length - 2} more` : ""}`,
      whyItMatters:
        "Never-cited sources add noise to retrieval without contributing to answers, potentially crowding out relevant content from being surfaced.",
      suggestedFix:
        "Review these sources: rewrite metadata to improve retrieval, merge with related sources, or archive if outdated",
      effort: "Medium",
      category: "source",
    });
  }

  const followupPct = summary.followup_pct ?? 0;
  if (followupPct > 35) {
    fixes.push({
      id: "high-followup-rate",
      severity: followupPct > 60 ? "High" : "Medium",
      title: "Elevated conversational follow-up rate",
      evidence: `${followupPct}% of turns are follow-up messages (threshold: 35%)`,
      whyItMatters:
        "Users asking multiple follow-ups signals that initial answers are incomplete or leave important questions unanswered — increasing session length and support burden.",
      suggestedFix: "Review KB sources for the most common question clusters and expand answer completeness",
      effort: "Involved",
      category: "response",
    });
  }

  const p95 = summary.p95_response_ms ?? 0;
  if (p95 > 4000) {
    fixes.push({
      id: "slow-p95",
      severity: p95 > 6000 ? "High" : "Medium",
      title: "Slow P95 response time",
      evidence: `P95 response time is ${p95.toLocaleString()}ms — 5% of responses take longer than ${(p95 / 1000).toFixed(1)}s`,
      whyItMatters: "Slow responses degrade user experience and may cause users to abandon the chat before getting an answer.",
      suggestedFix: "Profile retrieval latency; consider reducing top-k chunks or optimizing the vector index",
      effort: "Involved",
      category: "performance",
    });
  }

  const sevOrder: Record<PriorityLevel, number> = { High: 0, Medium: 1, Low: 2 };
  return fixes.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null) return "—";
  return n.toLocaleString() + suffix;
}

export function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function relTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Re-export LLM types used across components for convenience
export type { ContentGap, RetrievalIssue };
