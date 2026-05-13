"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adminApi,
  InsightReportSummary,
  InsightsData,
  LlmAnalysisResult,
  SavedInsightReport,
  TimeRangeParams,
} from "@/lib/api";
import { useAdmin } from "../context";
import type { DashboardAction } from "./components/DecisionDashboard";
import type { TimeFilter } from "./components/DecisionDashboard";

function rangeParams(filter: TimeFilter): TimeRangeParams | undefined {
  if (filter === "all") return undefined;
  const start = new Date();
  start.setDate(start.getDate() - (filter === "30d" ? 30 : 7));
  return { time_range_start: start.toISOString() };
}

export type { TimeFilter, DashboardAction };

export interface InsightsContextValue {
  data: InsightsData | null;
  loading: boolean;
  error: string;
  llmAnalysis: LlmAnalysisResult | null;
  llmLoading: boolean;
  llmError: string;
  setLlmError: (s: string) => void;
  activeRange: TimeFilter;
  setActiveRange: (r: TimeFilter) => void;
  reports: InsightReportSummary[];
  selectedReport: SavedInsightReport | null;
  reportsLoading: boolean;
  load: () => Promise<void>;
  loadReports: (selectLatest?: boolean) => Promise<void>;
  runLlmAnalysis: () => Promise<void>;
  selectReport: (report: InsightReportSummary) => Promise<void>;
  activeAction: DashboardAction | null;
  setActiveAction: (a: DashboardAction | null) => void;
  activeAnalysis: LlmAnalysisResult | null;
}

const InsightsContext = createContext<InsightsContextValue | null>(null);

export function InsightsProvider({ children }: { children: ReactNode }) {
  const { token } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState("");

  const [llmAnalysis, setLlmAnalysis] = useState<LlmAnalysisResult | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [activeRange, setActiveRange] = useState<TimeFilter>("all");
  const [reports, setReports] = useState<InsightReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedInsightReport | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<DashboardAction | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const d = await adminApi.getInsights(token, rangeParams(activeRange));
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [token, activeRange]);

  const loadReports = useCallback(
    async (selectLatest = false) => {
      if (!token) return;
      setReportsLoading(true);
      try {
        const list = await adminApi.listInsightReports(token, 25);
        setReports(list);
        if (selectLatest && list[0]) {
          const detail = await adminApi.getInsightReport(token, list[0].id);
          setSelectedReport(detail);
          setLlmAnalysis(detail.report);
        }
      } catch {
        // Table may not exist yet
      } finally {
        setReportsLoading(false);
      }
    },
    [token]
  );

  const runLlmAnalysis = useCallback(async () => {
    if (!token) return;
    setLlmLoading(true);
    setLlmError("");
    try {
      const result = await adminApi.getLlmAnalysis(token, rangeParams(activeRange));
      setLlmAnalysis(result);
      if (result._saved_report?.id) {
        const detail = await adminApi.getInsightReport(token, result._saved_report.id);
        setSelectedReport(detail);
      } else {
        setSelectedReport(null);
      }
      await loadReports(false);
    } catch (e: unknown) {
      setLlmError(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setLlmLoading(false);
    }
  }, [token, activeRange, loadReports]);

  const selectReport = useCallback(async (report: InsightReportSummary) => {
    if (!token) return;
    setReportsLoading(true);
    try {
      const detail = await adminApi.getInsightReport(token, report.id);
      setSelectedReport(detail);
      setLlmAnalysis(detail.report);
    } catch (e: unknown) {
      setLlmError(e instanceof Error ? e.message : "Failed to load saved report");
    } finally {
      setReportsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadReports(true);
  }, [loadReports]);

  const activeAnalysis = useMemo(
    () => selectedReport?.report ?? llmAnalysis,
    [selectedReport, llmAnalysis]
  );

  const handleSetRange = useCallback((range: TimeFilter) => {
    setSelectedReport(null);
    setActiveRange(range);
  }, []);

  const value = useMemo<InsightsContextValue>(
    () => ({
      data,
      loading,
      error,
      llmAnalysis,
      llmLoading,
      llmError,
      setLlmError,
      activeRange,
      setActiveRange: handleSetRange,
      reports,
      selectedReport,
      reportsLoading,
      load,
      loadReports,
      runLlmAnalysis,
      selectReport,
      activeAction,
      setActiveAction,
      activeAnalysis,
    }),
    [
      data,
      loading,
      error,
      llmAnalysis,
      llmLoading,
      llmError,
      activeRange,
      handleSetRange,
      reports,
      selectedReport,
      reportsLoading,
      load,
      loadReports,
      runLlmAnalysis,
      selectReport,
      activeAction,
      activeAnalysis,
    ]
  );

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export function useInsights(): InsightsContextValue {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error("useInsights must be used within /admin/insights layout");
  return ctx;
}
