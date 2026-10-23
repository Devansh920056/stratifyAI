"use client";

import React, { useEffect, useState } from "react";
import {
  fetchDecisionAnalytics,
  fetchEvaluationsForRecommendation,
  fetchRecommendations,
  generateRecommendations,
  listRecentJobs,
  recordEvaluation,
  runBacktestSimulation,
  updateRecommendationStatus,
} from "@/lib/api";
import {
  BacktestResultResponse,
  DecisionAnalyticsSummaryResponse,
  DecisionEvaluationCreateRequest,
  DecisionEvaluationItem,
  DecisionOutcomeStatusType,
  JobDetailResponse,
  RecommendationItem,
  RecommendationStatusType,
} from "@/types/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  History,
  Layers,
  LineChart,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { DialecticDebateWorkspace } from "./DialecticDebateWorkspace";

interface ActionIntelWorkspaceProps {
  activeJob: JobDetailResponse | null;
  onSelectJob: (job: JobDetailResponse) => void;
  onNewInquiry: () => void;
}

type SubTab = "matrix" | "debate" | "backtest" | "audit";

export function ActionIntelWorkspace({
  activeJob,
  onSelectJob,
  onNewInquiry,
}: ActionIntelWorkspaceProps) {
  const [currentSubTab, setCurrentSubTab] = useState<SubTab>("matrix");
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobDetailResponse[]>([]);
  const [selectedEvidenceRec, setSelectedEvidenceRec] = useState<RecommendationItem | null>(null);

  // Decision Evaluation state
  const [evaluatingRec, setEvaluatingRec] = useState<RecommendationItem | null>(null);
  const [evalOutcomeStatus, setEvalOutcomeStatus] = useState<DecisionOutcomeStatusType>("VALIDATED");
  const [evalOutcomeNotes, setEvalOutcomeNotes] = useState("");
  const [evalActualOutcome, setEvalActualOutcome] = useState("");
  const [evalActualMetric, setEvalActualMetric] = useState("");
  const [evalImpactDelta, setEvalImpactDelta] = useState<number>(1.0);
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Analytics & Backtesting state
  const [analytics, setAnalytics] = useState<DecisionAnalyticsSummaryResponse | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResultResponse | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(60);

  // Load past completed jobs if activeJob is missing
  useEffect(() => {
    let mounted = true;
    const loadPast = async () => {
      try {
        const jobs = await listRecentJobs(10);
        if (mounted) {
          setRecentJobs(jobs);
          if (!activeJob && jobs.length > 0) {
            onSelectJob(jobs[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load recent jobs", e);
      }
    };
    loadPast();
    return () => {
      mounted = false;
    };
  }, [activeJob, onSelectJob]);

  // Load recommendations for active job
  useEffect(() => {
    if (!activeJob) return;
    let mounted = true;
    const loadRecs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const recs = await fetchRecommendations(activeJob.id);
        if (mounted) setRecommendations(recs.items || []);
      } catch (err: unknown) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load recommendations."
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadRecs();
    return () => {
      mounted = false;
    };
  }, [activeJob]);

  // Load Decision Analytics
  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const data = await fetchDecisionAnalytics();
      setAnalytics(data);
    } catch (e) {
      console.error("Failed to load decision analytics", e);
    }
  }

  // Trigger Action Generation
  const handleGenerate = async () => {
    if (!activeJob) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateRecommendations(activeJob.id);
      setRecommendations(res.items || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate recommendations."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Status Change
  const handleStatusChange = async (
    recId: string,
    newStatus: RecommendationStatusType
  ) => {
    try {
      await updateRecommendationStatus(recId, newStatus);
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update status."
      );
    }
  };

  // Open Evaluation Modal
  const handleOpenEvaluationModal = (rec: RecommendationItem) => {
    setEvaluatingRec(rec);
    setEvalOutcomeStatus("VALIDATED");
    setEvalOutcomeNotes("");
    setEvalActualOutcome("");
    setEvalActualMetric("");
    setEvalImpactDelta(1.0);
  };

  // Submit Outcome Evaluation
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingRec) return;

    setIsSubmittingEval(true);
    setError(null);
    try {
      const payload: DecisionEvaluationCreateRequest = {
        outcome_status: evalOutcomeStatus,
        evaluator_notes: evalOutcomeNotes,
        actual_outcome: evalActualOutcome,
        actual_metric_value: evalActualMetric,
        impact_delta: evalImpactDelta,
        confidence_score: 0.9,
        metric_evidence: [
          {
            metric: evaluatingRec.success_metric,
            projected: evaluatingRec.target_metric_value || "Target",
            actual: evalActualMetric,
            status: evalOutcomeStatus === "VALIDATED" ? "MET" : "MISSED",
          },
        ],
      };

      await recordEvaluation(evaluatingRec.id, payload);

      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === evaluatingRec.id
            ? { ...r, status: "REVIEWED" as RecommendationStatusType }
            : r
        )
      );

      setEvaluatingRec(null);
      await loadAnalytics();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record outcome evaluation.");
    } finally {
      setIsSubmittingEval(false);
    }
  };

  // Run Historical Backtest
  const handleRunBacktest = async () => {
    setIsBacktesting(true);
    setError(null);
    try {
      const res = await runBacktestSimulation(activeJob?.id, lookbackDays);
      setBacktestResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Backtest simulation failed.");
    } finally {
      setIsBacktesting(false);
    }
  };

  // Badges
  const getStatusBadge = (status: RecommendationStatusType) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#22396F] text-[#FCF1D0]">
            <Check className="w-3 h-3 text-[#FCF1D0]" /> Approved
          </span>
        );
      case "IMPLEMENTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#22396F] text-[#FCF1D0]">
            <CheckCircle2 className="w-3 h-3 text-[#FCF1D0]" /> Implemented
          </span>
        );
      case "REVIEWED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#22396F] text-[#FCF1D0]">
            <Award className="w-3 h-3 text-[#FCF1D0]" /> Completed
          </span>
        );
      case "DISMISSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#010736] border border-[#22396F] text-slate-400">
            <XCircle className="w-3 h-3" /> Dismissed
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
            <Clock className="w-3 h-3 text-[#FCF1D0]" /> Recommended
          </span>
        );
    }
  };

  const getHorizonBadge = (horizon: string) => {
    switch (horizon) {
      case "IMMEDIATE":
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
            Immediate (0-30 days)
          </span>
        );
      case "NEAR_TERM":
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
            Near-Term (1-3 mos)
          </span>
        );
      case "MEDIUM_TERM":
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-slate-300">
            Medium-Term (3-6 mos)
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-slate-400">
            Long-Term (6+ mos)
          </span>
        );
    }
  };

  const quickWins = recommendations.filter(
    (r) => r.estimated_impact >= 7 && r.estimated_effort <= 5
  );
  const majorBets = recommendations.filter(
    (r) => r.estimated_impact >= 7 && r.estimated_effort > 5
  );
  const operational = recommendations.filter(
    (r) => r.estimated_impact < 7 && r.estimated_effort <= 5
  );
  const reconsider = recommendations.filter(
    (r) => r.estimated_impact < 7 && r.estimated_effort > 5
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── Top Control Bar ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#22396F]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0] mb-2">
            <Target className="w-3.5 h-3.5 text-[#FCF1D0]" />
            <span>Action Plan & Strategy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FCF1D0] tracking-tight">
            Action Plan & Strategy
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Prioritize key initiatives by impact and effort, test market assumptions, and track results.
          </p>
        </div>

        {/* Inquiry Selector & Generation CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {recentJobs.length > 0 && (
            <select
              value={activeJob?.id || ""}
              onChange={(e) => {
                const found = recentJobs.find((j) => j.id === e.target.value);
                if (found) onSelectJob(found);
              }}
              className="bg-[#010736] border border-[#22396F] text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FCF1D0] cursor-pointer"
            >
              {recentJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.target_market} — {j.research_question.slice(0, 35)}...
                </option>
              ))}
            </select>
          )}

          {activeJob && recommendations.length === 0 && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#010736]" />
                  <span>Creating Action Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#010736]" />
                  <span>Create Action Plan</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─── Sub-Tabs Switcher ─────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#22396F] pb-3 overflow-x-auto">
        <button
          onClick={() => setCurrentSubTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentSubTab === "matrix"
              ? "bg-[#22396F] text-[#FCF1D0] font-semibold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-[#0D1C42]"
          }`}
        >
          <Target className="w-3.5 h-3.5 text-[#FCF1D0]" />
          <span>Priority Matrix ({recommendations.length})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab("debate")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentSubTab === "debate"
              ? "bg-[#22396F] text-[#FCF1D0] font-semibold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-[#0D1C42]"
          }`}
        >
          <Swords className="w-3.5 h-3.5 text-[#FCF1D0]" />
          <span>AI Debate (Pros & Cons)</span>
        </button>

        <button
          onClick={() => {
            setCurrentSubTab("backtest");
            if (!backtestResult) handleRunBacktest();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentSubTab === "backtest"
              ? "bg-[#22396F] text-[#FCF1D0] font-semibold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-[#0D1C42]"
          }`}
        >
          <History className="w-3.5 h-3.5 text-[#FCF1D0]" />
          <span>Historical Test</span>
        </button>

        <button
          onClick={() => setCurrentSubTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            currentSubTab === "audit"
              ? "bg-[#22396F] text-[#FCF1D0] font-semibold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-[#0D1C42]"
          }`}
        >
          <Award className="w-3.5 h-3.5 text-[#FCF1D0]" />
          <span>Outcome Tracker</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── AI Debate Sub-Tab ─────────────────────────────────── */}
      {currentSubTab === "debate" && <DialecticDebateWorkspace />}

      {/* ─── State: No active job selected ───────────────────── */}
      {!activeJob && currentSubTab !== "debate" && (
        <div className="bg-[#0D1C42] p-12 rounded-2xl border border-[#22396F] text-center space-y-4">
          <Compass className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">
            No Active Market Inquiry Selected
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Action Intelligence requires research findings from a market inquiry to
            synthesize grounded strategic initiatives.
          </p>
          <button
            onClick={onNewInquiry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] transition cursor-pointer"
          >
            <span>Start Research</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          SUB-TAB 1: 2x2 PRIORITIZATION MATRIX & ACTIONS
      ═════════════════════════════════════════════════════════ */}
      {currentSubTab === "matrix" && (
        <>
          {/* Active Job without Recommendations */}
          {activeJob && recommendations.length === 0 && !isLoading && (
            <div className="bg-[#0D1C42] p-10 rounded-2xl border border-[#22396F] text-center space-y-4">
              <Target className="w-12 h-12 text-[#FCF1D0] mx-auto animate-pulse" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#FCF1D0]">
                  Ready to Create Your Action Plan
                </h3>
                <p className="text-xs text-slate-300 max-w-lg mx-auto">
                  Research for <strong className="text-white">{activeJob.target_market}</strong> is complete.
                  Click below to generate prioritized initiatives based on your findings.
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-md transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#010736]" />
                    <span>Creating Action Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#010736]" />
                    <span>Generate Action Plan</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Recommendations Loaded */}
          {recommendations.length > 0 && (
            <div className="space-y-8">
              {/* 2x2 Prioritization Matrix */}
              <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#FCF1D0]" />
                    <h3 className="text-sm font-semibold text-[#FCF1D0]">
                      Priority Matrix (Impact vs. Effort)
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Sorted by highest return on effort
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Quick Wins */}
                  <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#FCF1D0] uppercase tracking-wider">
                        ⚡ Quick Wins (High Impact, Low Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22396F] text-[#FCF1D0]">
                        {quickWins.length} Items
                      </span>
                    </div>
                    <div className="space-y-2">
                      {quickWins.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No initiatives in this quadrant</p>
                      ) : (
                        quickWins.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 rounded-lg bg-[#0D1C42] border border-[#22396F] flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-200 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-[#FCF1D0] font-bold">
                              {r.priority_score}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Major Strategic Bets */}
                  <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#FCF1D0] uppercase tracking-wider">
                        🚀 Major Opportunities (High Impact, High Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22396F] text-[#FCF1D0]">
                        {majorBets.length} Items
                      </span>
                    </div>
                    <div className="space-y-2">
                      {majorBets.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No initiatives in this quadrant</p>
                      ) : (
                        majorBets.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 rounded-lg bg-[#0D1C42] border border-[#22396F] flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-200 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-[#FCF1D0] font-bold">
                              {r.priority_score}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Operational Optimization */}
                  <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        🔧 Routine Tasks (Low Impact, Low Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22396F] text-slate-300">
                        {operational.length} Items
                      </span>
                    </div>
                    <div className="space-y-2">
                      {operational.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No initiatives in this quadrant</p>
                      ) : (
                        operational.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 rounded-lg bg-[#0D1C42] border border-[#22396F] flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-300 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-slate-400">{r.priority_score}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Reconsider */}
                  <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        ⚠️ Low Priority (Low Impact, High Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#22396F] text-amber-300">
                        {reconsider.length} Items
                      </span>
                    </div>
                    <div className="space-y-2">
                      {reconsider.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">No initiatives in this quadrant</p>
                      ) : (
                        reconsider.map((r) => (
                          <div
                            key={r.id}
                            className="p-2.5 rounded-lg bg-[#0D1C42] border border-[#22396F] flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-400 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-amber-300">{r.priority_score}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation Detailed Cards */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Strategic Action Items ({recommendations.length})
                </h3>

                <div className="grid grid-cols-1 gap-5">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-5 hover:border-[#FCF1D0]/40 transition"
                    >
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {getStatusBadge(rec.status)}
                          {getHorizonBadge(rec.time_horizon)}
                          <span className="text-xs font-mono font-bold text-[#FCF1D0] bg-[#22396F] px-2 py-0.5 rounded">
                            Priority: {rec.priority_score}
                          </span>
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-2">
                          {rec.status === "DRAFT" && (
                            <>
                              <button
                                onClick={() => handleStatusChange(rec.id, "APPROVED")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FCF1D0] hover:bg-[#fae8b4] text-[#010736] transition cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleStatusChange(rec.id, "DISMISSED")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#22396F] transition cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Dismiss</span>
                              </button>
                            </>
                          )}

                          {rec.status === "APPROVED" && (
                            <button
                              onClick={() => handleStatusChange(rec.id, "IMPLEMENTED")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FCF1D0] hover:bg-[#fae8b4] text-[#010736] transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mark Implemented</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEvaluationModal(rec)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#22396F] hover:bg-[#2d4c94] text-[#FCF1D0] transition cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-[#FCF1D0]" />
                            <span>Track Result</span>
                          </button>

                          {(rec.status === "DISMISSED" || rec.status === "REVIEWED") && (
                            <button
                              onClick={() => handleStatusChange(rec.id, "DRAFT")}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-[#FCF1D0] hover:bg-[#22396F] transition cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content Row */}
                      <div>
                        <h4 className="text-base font-bold text-white tracking-tight">
                          {rec.title}
                        </h4>
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                          {rec.description}
                        </p>
                      </div>

                      {/* Goal & Rationale */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-[#010736] border border-[#22396F]">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#FCF1D0] uppercase tracking-wider">
                            Expected Result & Goal
                          </span>
                          <p className="text-xs text-slate-300 leading-snug">
                            {rec.outcome_hypothesis}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-400">
                            <span>KPI: <strong className="text-white">{rec.success_metric}</strong></span>
                            {rec.target_metric_value && (
                              <span>Target: <strong className="text-[#FCF1D0]">{rec.target_metric_value}</strong></span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                            Why This Matters
                          </span>
                          <p className="text-xs text-slate-400 leading-snug">
                            {rec.rationale}
                          </p>
                        </div>
                      </div>

                      {/* Impact vs Effort Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Impact:</span>
                            <div className="w-24 h-2 rounded-full bg-[#010736] border border-[#22396F] overflow-hidden">
                              <div
                                className="h-full bg-[#FCF1D0] rounded-full"
                                style={{ width: `${rec.estimated_impact * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-[#FCF1D0]">
                              {rec.estimated_impact}/10
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Effort:</span>
                            <div className="w-24 h-2 rounded-full bg-[#010736] border border-[#22396F] overflow-hidden">
                              <div
                                className="h-full bg-[#22396F] rounded-full"
                                style={{ width: `${rec.estimated_effort * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-300">
                              {rec.estimated_effort}/10
                            </span>
                          </div>
                        </div>

                        {rec.evidence_ids && rec.evidence_ids.length > 0 && (
                          <button
                            onClick={() => setSelectedEvidenceRec(rec)}
                            className="inline-flex items-center gap-1.5 text-xs text-[#FCF1D0] hover:underline font-medium cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#FCF1D0]" />
                            <span>View Sources ({rec.evidence_ids.length})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════
          SUB-TAB 2: HISTORICAL BACKTESTING SIMULATION ENGINE
      ═════════════════════════════════════════════════════════ */}
      {currentSubTab === "backtest" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#FCF1D0] flex items-center gap-2">
                  <History className="w-5 h-5 text-[#FCF1D0]" />
                  Historical Market Signal Test
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Tests recommendations against historical news and updates to verify market alignment.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Lookback:</span>
                  <select
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(Number(e.target.value))}
                    className="bg-[#010736] border border-[#22396F] text-white rounded-lg px-2.5 py-1 text-xs"
                  >
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>

                <button
                  onClick={handleRunBacktest}
                  disabled={isBacktesting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-sm transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBacktesting ? "animate-spin" : ""}`} />
                  {isBacktesting ? "Testing..." : "Run Test"}
                </button>
              </div>
            </div>

            {/* Backtest KPI Summary */}
            {backtestResult && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-[#22396F]">
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F]">
                  <span className="text-xs text-slate-400">Overall Alignment</span>
                  <p className="text-2xl font-bold text-[#FCF1D0] mt-1">
                    {backtestResult.alignment_score}%
                  </p>
                  <span className="text-[11px] text-slate-500">Market-aligned initiatives</span>
                </div>
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F]">
                  <span className="text-xs text-slate-400">Aligned Actions</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {backtestResult.aligned_recommendations}
                  </p>
                  <span className="text-[11px] text-slate-500">Reinforced by market data</span>
                </div>
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F]">
                  <span className="text-xs text-slate-400">Divergent Signals</span>
                  <p className="text-2xl font-bold text-rose-400 mt-1">
                    {backtestResult.divergent_recommendations}
                  </p>
                  <span className="text-[11px] text-slate-500">Market headwinds noticed</span>
                </div>
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F]">
                  <span className="text-xs text-slate-400">Total Actions Tested</span>
                  <p className="text-2xl font-bold text-white mt-1">
                    {backtestResult.total_recommendations}
                  </p>
                  <span className="text-[11px] text-slate-500">Across active research</span>
                </div>
              </div>
            )}
          </div>

          {/* Backtest Findings List */}
          {backtestResult && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Test Findings Log ({backtestResult.findings.length})
              </h4>
              <div className="space-y-3">
                {backtestResult.findings.map((f, idx) => {
                  const isStrong = f.backtest_verdict === "STRONGLY_ALIGNED";
                  const isMod = f.backtest_verdict === "MODERATELY_ALIGNED";
                  const isDiv = f.backtest_verdict === "DIVERGENT";

                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-3 hover:border-[#FCF1D0]/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isStrong ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22396F] text-[#FCF1D0]">
                              STRONGLY ALIGNED
                            </span>
                          ) : isMod ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22396F] text-slate-200">
                              MODERATELY ALIGNED
                            </span>
                          ) : isDiv ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/30">
                              HEADWIND
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#010736] text-slate-300 border border-[#22396F]">
                              NEUTRAL
                            </span>
                          )}
                          <h5 className="text-sm font-bold text-white">{f.title}</h5>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400 font-mono">
                            Confidence: <strong className="text-[#FCF1D0]">{Math.round(f.confidence * 100)}%</strong>
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 italic">
                        Expected Result: &ldquo;{f.original_hypothesis}&rdquo;
                      </p>

                      <div className="pt-2 border-t border-[#22396F] space-y-1">
                        <span className="text-[11px] text-slate-400 font-medium">Corroborating Evidence:</span>
                        <ul className="space-y-1">
                          {f.key_market_evidence.map((ev, evIdx) => (
                            <li key={evIdx} className="text-xs text-slate-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#FCF1D0]" />
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          SUB-TAB 3: DECISION AUDIT LOG & QUALITY ANALYTICS
      ═════════════════════════════════════════════════════════ */}
      {currentSubTab === "audit" && (
        <div className="space-y-6">
          {/* Analytics Header KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[#22396F] bg-[#0D1C42]">
              <span className="text-xs text-slate-400">Success Rate</span>
              <p className="mt-2 text-2xl font-bold text-[#FCF1D0]">
                {analytics?.validation_rate || 0}%
              </p>
              <span className="text-[11px] text-slate-500">Actions meeting goals</span>
            </div>

            <div className="p-4 rounded-xl border border-[#22396F] bg-[#0D1C42]">
              <span className="text-xs text-slate-400">Actions Completed</span>
              <p className="mt-2 text-2xl font-bold text-white">
                {analytics?.total_evaluated || 0}
              </p>
              <span className="text-[11px] text-slate-500">Tracked outcomes</span>
            </div>

            <div className="p-4 rounded-xl border border-[#22396F] bg-[#0D1C42]">
              <span className="text-xs text-slate-400">Average Impact Score</span>
              <p className="mt-2 text-2xl font-bold text-[#FCF1D0]">
                {(analytics?.average_impact_delta || 0) >= 0
                  ? `+${analytics?.average_impact_delta || 0}`
                  : analytics?.average_impact_delta}
              </p>
              <span className="text-[11px] text-slate-500">Actual vs estimated impact</span>
            </div>

            <div className="p-4 rounded-xl border border-[#22396F] bg-[#0D1C42]">
              <span className="text-xs text-slate-400">Results Breakdown</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{analytics?.validated_count || 0}</span>
                <span className="text-xs text-slate-400">met</span>
                <span className="text-slate-600">/</span>
                <span className="text-xl font-bold text-rose-400">{analytics?.invalidated_count || 0}</span>
                <span className="text-xs text-slate-400">missed</span>
              </div>
              <span className="text-[11px] text-slate-500">Historical performance ratio</span>
            </div>
          </div>

          {/* Top validated vs failing lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-3">
              <h4 className="text-xs font-bold text-[#FCF1D0] uppercase tracking-wider flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-[#FCF1D0]" />
                Validated Actions & Successes
              </h4>
              {(analytics?.top_validated_hypotheses.length || 0) === 0 ? (
                <p className="text-xs text-slate-500 italic">No validated actions recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {analytics?.top_validated_hypotheses.map((title, i) => (
                    <li key={i} className="text-xs text-slate-300 p-2 rounded-lg bg-[#010736] border border-[#22396F]">
                      ✓ {title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Actions Needing Adjustment
              </h4>
              {(analytics?.top_failing_hypotheses.length || 0) === 0 ? (
                <p className="text-xs text-slate-500 italic">No missed goals recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {analytics?.top_failing_hypotheses.map((title, i) => (
                    <li key={i} className="text-xs text-slate-300 p-2 rounded-lg bg-[#010736] border border-[#22396F]">
                      ✕ {title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Evidence Links Modal ─────────────────────── */}
      {selectedEvidenceRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010736]/80 backdrop-blur-sm animate-fade-in">
          <div className="max-w-lg w-full p-6 rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#22396F]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FCF1D0]" />
                <h3 className="text-sm font-semibold text-[#FCF1D0]">
                  Source Links
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvidenceRec(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Verified sources for:{" "}
              <strong className="text-white">{selectedEvidenceRec.title}</strong>
            </p>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {selectedEvidenceRec.evidence_ids.map((rawItem: unknown, idx: number) => {
                const item = rawItem as { url?: string; title?: string } | string | null;
                const url = typeof item === "string" ? item : item?.url || "#";
                const title = typeof item === "object" && item?.title ? item.title : url;
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-[#010736] hover:bg-[#142554] border border-[#22396F] text-xs text-[#FCF1D0] transition group"
                  >
                    <span className="truncate max-w-[360px] text-slate-200 group-hover:text-[#FCF1D0]">
                      {title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 group-hover:text-[#FCF1D0]" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Decision Evaluation / Audit Modal ─────── */}
      {evaluatingRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010736]/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-[#22396F] bg-[#0D1C42] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#22396F] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#FCF1D0]" />
                <h3 className="text-base font-bold text-[#FCF1D0]">Record Action Outcome</h3>
              </div>
              <button
                onClick={() => setEvaluatingRec(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#010736] border border-[#22396F] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Initiative</span>
              <p className="text-xs font-bold text-white">{evaluatingRec.title}</p>
              <p className="text-xs text-slate-300 italic">Target: &ldquo;{evaluatingRec.outcome_hypothesis}&rdquo;</p>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Observed Outcome Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["VALIDATED", "PARTIALLY_VALIDATED", "INVALIDATED", "IN_PROGRESS"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEvalOutcomeStatus(st)}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${
                        evalOutcomeStatus === st
                          ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                          : "bg-[#010736] border-[#22396F] text-slate-300 hover:text-white"
                      }`}
                    >
                      {st === "VALIDATED"
                        ? "Goal Met"
                        : st === "PARTIALLY_VALIDATED"
                        ? "Partially Met"
                        : st === "INVALIDATED"
                        ? "Missed"
                        : "In Progress"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Actual Result Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={evalActualOutcome}
                  onChange={(e) => setEvalActualOutcome(e.target.value)}
                  placeholder="e.g. Completed trial; achieved 25% cost reduction."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#010736] border border-[#22396F] text-white focus:outline-none focus:border-[#FCF1D0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Metric Result
                  </label>
                  <input
                    type="text"
                    value={evalActualMetric}
                    onChange={(e) => setEvalActualMetric(e.target.value)}
                    placeholder="e.g. +25% reduction"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#010736] border border-[#22396F] text-white focus:outline-none focus:border-[#FCF1D0]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Impact Delta
                    </label>
                    <span className="font-mono text-xs font-bold text-[#FCF1D0]">
                      {evalImpactDelta >= 0 ? `+${evalImpactDelta}` : evalImpactDelta}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-5.0"
                    max="5.0"
                    step="0.5"
                    value={evalImpactDelta}
                    onChange={(e) => setEvalImpactDelta(parseFloat(e.target.value))}
                    className="w-full accent-[#FCF1D0] cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Notes & Observations
                </label>
                <textarea
                  rows={2}
                  required
                  value={evalOutcomeNotes}
                  onChange={(e) => setEvalOutcomeNotes(e.target.value)}
                  placeholder="Internal review notes or key lessons learned."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#010736] border border-[#22396F] text-white focus:outline-none focus:border-[#FCF1D0]"
                />
              </div>

              <div className="pt-3 border-t border-[#22396F] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEvaluatingRec(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#010736] hover:bg-[#22396F] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEval}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-[#FCF1D0] hover:bg-[#fae8b4] text-[#010736] shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingEval && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#010736]" />}
                  {isSubmittingEval ? "Saving..." : "Save Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
