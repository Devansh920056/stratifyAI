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

  // Stage 6 Decision Evaluation state
  const [evaluatingRec, setEvaluatingRec] = useState<RecommendationItem | null>(null);
  const [evalOutcomeStatus, setEvalOutcomeStatus] = useState<DecisionOutcomeStatusType>("VALIDATED");
  const [evalOutcomeNotes, setEvalOutcomeNotes] = useState("");
  const [evalActualOutcome, setEvalActualOutcome] = useState("");
  const [evalActualMetric, setEvalActualMetric] = useState("");
  const [evalImpactDelta, setEvalImpactDelta] = useState<number>(1.0);
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Stage 6 Analytics & Backtesting state
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
      const generated = await generateRecommendations(activeJob.id);
      setRecommendations(generated.items || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate recommendations."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Status Lifecycle Transition
  const handleStatusChange = async (
    recommendationId: string,
    nextStatus: RecommendationStatusType
  ) => {
    try {
      const updated = await updateRecommendationStatus(recommendationId, nextStatus);
      setRecommendations((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update recommendation status."
      );
    }
  };

  // Stage 6: Record Decision Evaluation
  const handleOpenEvaluationModal = (rec: RecommendationItem) => {
    setEvaluatingRec(rec);
    setEvalOutcomeStatus("VALIDATED");
    setEvalActualOutcome(`Achieved target objectives for ${rec.title}.`);
    setEvalActualMetric(rec.target_metric_value || "Target met");
    setEvalOutcomeNotes("Post-implementation review validated hypothesis against live operational metrics.");
    setEvalImpactDelta(1.0);
  };

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

      // Optimistically update recommendation status
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

  // Stage 6: Run Historical Backtest
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <Check className="w-3 h-3" /> Approved
          </span>
        );
      case "IMPLEMENTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
            <CheckCircle2 className="w-3 h-3" /> Implemented
          </span>
        );
      case "REVIEWED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-950/80 border border-violet-500/40 text-violet-300">
            <Award className="w-3 h-3" /> Outcome Audited
          </span>
        );
      case "DISMISSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-500">
            <XCircle className="w-3 h-3" /> Dismissed
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-500/40 text-amber-300">
            <Clock className="w-3 h-3" /> Draft Action
          </span>
        );
    }
  };

  const getHorizonBadge = (horizon: string) => {
    switch (horizon) {
      case "IMMEDIATE":
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/30 text-rose-300">
            Immediate (0-30d)
          </span>
        );
      case "NEAR_TERM":
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300">
            Near-Term (1-3m)
          </span>
        );
      case "MEDIUM_TERM":
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
            Medium-Term (3-6m)
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            Long-Term (6m+)
          </span>
        );
    }
  };

  // Quadrants breakdown for 2x2 Prioritization Matrix
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 mb-2">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span>Action Intelligence & Decision Evaluation</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Strategic Recommendations & Decision Auditing
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Prioritize initiatives with quantitative hypotheses, calibrate impact vs effort,
            and backtest historical decisions against live market movements.
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
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-md shadow-indigo-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Actions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Recommendations</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─── Stage 6 Sub-Pillars Navigation Switcher ───────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setCurrentSubTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            currentSubTab === "matrix"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>2x2 Prioritization Matrix ({recommendations.length})</span>
        </button>

        <button
          onClick={() => setCurrentSubTab("debate")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            currentSubTab === "debate"
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Swords className="w-3.5 h-3.5 text-pink-400" />
          <span>Dialectic Debate Arena</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-500/30">
            Stage 10
          </span>
        </button>

        <button
          onClick={() => {
            setCurrentSubTab("backtest");
            if (!backtestResult) handleRunBacktest();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            currentSubTab === "backtest"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span>Historical Market Backtest</span>
        </button>

        <button
          onClick={() => setCurrentSubTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            currentSubTab === "audit"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <span>Decision Quality & Outcome Analytics</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Stage 10: Dialectic Debate Arena ─────────────────── */}
      {currentSubTab === "debate" && <DialecticDebateWorkspace />}

      {/* ─── State: No active job selected ───────────────────── */}
      {!activeJob && currentSubTab !== "debate" && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition cursor-pointer"
          >
            <span>Launch Research Inquiry</span>
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
            <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center space-y-4">
              <Target className="w-12 h-12 text-indigo-400 mx-auto animate-pulse" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-200">
                  Ready to Synthesize Action Intelligence
                </h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Grounded findings for <strong className="text-slate-200">{activeJob.target_market}</strong> are ready.
                  Click below to generate prioritized initiatives, hypotheses, and effort/impact scoring.
                </p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Strategic Actions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Recommendations Matrix</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Recommendations Loaded */}
          {recommendations.length > 0 && (
            <div className="space-y-8">
              {/* 2x2 Prioritization Matrix */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-slate-200">
                      Prioritization Matrix (Impact vs. Effort)
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Formula: Priority = (Impact × 0.7) - (Effort × 0.3)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Quick Wins */}
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        ⚡ Quick Wins (High Impact, Low Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400">
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
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-200 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold">
                              {r.priority_score}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Major Strategic Bets */}
                  <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        🚀 Major Strategic Bets (High Impact, High Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400">
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
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-200 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-indigo-400 font-bold">
                              {r.priority_score}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Operational Optimization */}
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        🔧 Incremental / Low Overhead (Low Impact, Low Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
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
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-300 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-slate-400">{r.priority_score}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Reconsider */}
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        ⚠️ High Friction / Caution (Low Impact, High Effort)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400">
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
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-400 font-medium truncate">{r.title}</span>
                            <span className="text-[10px] font-mono text-amber-400">{r.priority_score}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation Detailed Cards */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Active Strategic Recommendations ({recommendations.length})
                </h3>

                <div className="grid grid-cols-1 gap-5">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 hover:border-slate-700 transition"
                    >
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {getStatusBadge(rec.status)}
                          {getHorizonBadge(rec.time_horizon)}
                          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                            Priority: {rec.priority_score}
                          </span>
                        </div>

                        {/* Action Controls & Audit Trigger */}
                        <div className="flex items-center gap-2">
                          {rec.status === "DRAFT" && (
                            <>
                              <button
                                onClick={() => handleStatusChange(rec.id, "APPROVED")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleStatusChange(rec.id, "DISMISSED")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-500/30 transition cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Dismiss</span>
                              </button>
                            </>
                          )}

                          {rec.status === "APPROVED" && (
                            <button
                              onClick={() => handleStatusChange(rec.id, "IMPLEMENTED")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mark Implemented</span>
                            </button>
                          )}

                          {/* Stage 6: Audit / Evaluate Outcome CTA */}
                          <button
                            onClick={() => handleOpenEvaluationModal(rec)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Audit Outcome</span>
                          </button>

                          {(rec.status === "DISMISSED" || rec.status === "REVIEWED") && (
                            <button
                              onClick={() => handleStatusChange(rec.id, "DRAFT")}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
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

                      {/* Hypothesis & Strategic Rationale */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-850">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                            Empirical Hypothesis & Metric
                          </span>
                          <p className="text-xs text-slate-300 leading-snug">
                            {rec.outcome_hypothesis}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-slate-400">
                            <span>KPI: <strong className="text-slate-200">{rec.success_metric}</strong></span>
                            {rec.target_metric_value && (
                              <span>Target: <strong className="text-emerald-400">{rec.target_metric_value}</strong></span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                            Strategic Rationale
                          </span>
                          <p className="text-xs text-slate-400 leading-snug">
                            {rec.rationale}
                          </p>
                        </div>
                      </div>

                      {/* Calibrated Impact vs Effort */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Impact:</span>
                            <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full"
                                style={{ width: `${rec.estimated_impact * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {rec.estimated_impact}/10
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Effort:</span>
                            <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-indigo-400 rounded-full"
                                style={{ width: `${rec.estimated_effort * 10}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-200">
                              {rec.estimated_effort}/10
                            </span>
                          </div>
                        </div>

                        {rec.evidence_ids && rec.evidence_ids.length > 0 && (
                          <button
                            onClick={() => setSelectedEvidenceRec(rec)}
                            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Inspect Evidence ({rec.evidence_ids.length})</span>
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
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-cyan-400" />
                  Historical Market Signal Backtest
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tests recommendations formulated for {activeJob?.target_market || "this sector"} against subsequent news signals to quantify market alignment.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Lookback:</span>
                  <select
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs"
                  >
                    <option value={30}>30 Days</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                </div>

                <button
                  onClick={handleRunBacktest}
                  disabled={isBacktesting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBacktesting ? "animate-spin" : ""}`} />
                  {isBacktesting ? "Evaluating..." : "Run Backtest"}
                </button>
              </div>
            </div>

            {/* Backtest KPI Summary */}
            {backtestResult && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-xs text-slate-400">Overall Alignment</span>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">
                    {backtestResult.alignment_score}%
                  </p>
                  <span className="text-[11px] text-slate-500">Market-aligned initiatives</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-xs text-slate-400">Aligned Recommendations</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {backtestResult.aligned_recommendations}
                  </p>
                  <span className="text-[11px] text-slate-500">Subsequent signals reinforced</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-xs text-slate-400">Divergent Signals</span>
                  <p className="text-2xl font-bold text-rose-400 mt-1">
                    {backtestResult.divergent_recommendations}
                  </p>
                  <span className="text-[11px] text-slate-500">Market headwind contradiction</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-xs text-slate-400">Total Initiatives Tested</span>
                  <p className="text-2xl font-bold text-white mt-1">
                    {backtestResult.total_recommendations}
                  </p>
                  <span className="text-[11px] text-slate-500">Across active research job</span>
                </div>
              </div>
            )}
          </div>

          {/* Backtest Findings List */}
          {backtestResult && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Initiative Backtest Validation Log ({backtestResult.findings.length})
              </h4>
              <div className="space-y-3">
                {backtestResult.findings.map((f, idx) => {
                  const isStrong = f.backtest_verdict === "STRONGLY_ALIGNED";
                  const isMod = f.backtest_verdict === "MODERATELY_ALIGNED";
                  const isDiv = f.backtest_verdict === "DIVERGENT";

                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isStrong ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              STRONGLY ALIGNED
                            </span>
                          ) : isMod ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              MODERATELY ALIGNED
                            </span>
                          ) : isDiv ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              DIVERGENT SHOCK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              NEUTRAL
                            </span>
                          )}
                          <h5 className="text-sm font-bold text-white">{f.title}</h5>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400 font-mono">
                            Sentiment:{" "}
                            <strong className={f.market_sentiment_trend >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {f.market_sentiment_trend >= 0 ? `+${f.market_sentiment_trend}` : f.market_sentiment_trend}
                            </strong>
                          </span>
                          <span className="text-slate-400 font-mono">
                            Confidence: <strong>{Math.round(f.confidence * 100)}%</strong>
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 italic">
                        Original Hypothesis: &ldquo;{f.original_hypothesis}&rdquo;
                      </p>

                      {/* Evidence citations */}
                      <div className="pt-2 border-t border-slate-800/60 space-y-1">
                        <span className="text-[11px] text-slate-500 font-medium">Corroborating Real-World Signals:</span>
                        <ul className="space-y-1">
                          {f.key_market_evidence.map((ev, evIdx) => (
                            <li key={evIdx} className="text-xs text-slate-300 flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-cyan-400" />
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
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Validation Rate</span>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {analytics?.validation_rate || 0}%
              </p>
              <span className="text-[11px] text-slate-500">Hypotheses empirically proven</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Decisions Evaluated</span>
              <p className="mt-2 text-2xl font-bold text-white">
                {analytics?.total_evaluated || 0}
              </p>
              <span className="text-[11px] text-slate-500">Audited post-implementation</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Mean Impact Delta</span>
              <p className="mt-2 text-2xl font-bold text-cyan-400">
                {(analytics?.average_impact_delta || 0) >= 0
                  ? `+${analytics?.average_impact_delta || 0}`
                  : analytics?.average_impact_delta}
              </p>
              <span className="text-[11px] text-slate-500">Actual vs estimated impact</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
              <span className="text-xs text-slate-400">Outcome Distribution</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{analytics?.validated_count || 0}</span>
                <span className="text-xs text-slate-400">valid</span>
                <span className="text-slate-600">/</span>
                <span className="text-xl font-bold text-rose-400">{analytics?.invalidated_count || 0}</span>
                <span className="text-xs text-slate-400">invalid</span>
              </div>
              <span className="text-[11px] text-slate-500">Historical calibration ratio</span>
            </div>
          </div>

          {/* Top validated vs failing lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <CheckCheck className="w-4 h-4" />
                Validated Strategic Hypotheses
              </h4>
              {(analytics?.top_validated_hypotheses.length || 0) === 0 ? (
                <p className="text-xs text-slate-500 italic">No validated hypotheses recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {analytics?.top_validated_hypotheses.map((title, i) => (
                    <li key={i} className="text-xs text-slate-300 p-2 rounded-lg bg-slate-950 border border-slate-850">
                      ✓ {title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Divergent / Invalidate Post-Mortems
              </h4>
              {(analytics?.top_failing_hypotheses.length || 0) === 0 ? (
                <p className="text-xs text-slate-500 italic">No failed hypotheses recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {analytics?.top_failing_hypotheses.map((title, i) => (
                    <li key={i} className="text-xs text-slate-300 p-2 rounded-lg bg-slate-950 border border-slate-850">
                      ✕ {title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Evidence Provenance Modal ─────────────────────── */}
      {selectedEvidenceRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Evidence Provenance Links
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvidenceRec(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Verifiable citations grounding initiative:{" "}
              <strong className="text-slate-200">{selectedEvidenceRec.title}</strong>
            </p>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {selectedEvidenceRec.evidence_ids.map((item: any, idx: number) => {
                const url = typeof item === "string" ? item : item.url;
                const title = typeof item === "object" ? item.title || url : url;
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-cyan-400 transition group"
                  >
                    <span className="truncate max-w-[360px] text-slate-200 group-hover:text-cyan-300">
                      {title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 group-hover:text-cyan-400" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stage 6: Decision Evaluation / Audit Modal ─────── */}
      {evaluatingRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Record Outcome Audit</h3>
              </div>
              <button
                onClick={() => setEvaluatingRec(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Initiative</span>
              <p className="text-xs font-bold text-white">{evaluatingRec.title}</p>
              <p className="text-xs text-slate-400 italic">Target: &ldquo;{evaluatingRec.outcome_hypothesis}&rdquo;</p>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Empirical Outcome Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["VALIDATED", "PARTIALLY_VALIDATED", "INVALIDATED", "IN_PROGRESS"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEvalOutcomeStatus(st)}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border transition ${
                        evalOutcomeStatus === st
                          ? st === "VALIDATED"
                            ? "bg-emerald-600 text-white border-emerald-500"
                            : st === "PARTIALLY_VALIDATED"
                            ? "bg-amber-600 text-white border-amber-500"
                            : st === "INVALIDATED"
                            ? "bg-rose-600 text-white border-rose-500"
                            : "bg-cyan-600 text-white border-cyan-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Actual Observed Result Narrative
                </label>
                <textarea
                  rows={2}
                  required
                  value={evalActualOutcome}
                  onChange={(e) => setEvalActualOutcome(e.target.value)}
                  placeholder="e.g. Deployed distributed micro-inverters; achieved 28% reduction in thermal downtime."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Measured Metric Value
                  </label>
                  <input
                    type="text"
                    value={evalActualMetric}
                    onChange={(e) => setEvalActualMetric(e.target.value)}
                    placeholder="e.g. +28% reduction"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Impact Delta
                    </label>
                    <span className="font-mono text-xs font-bold text-cyan-400">
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
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Evaluator Post-Mortem Notes
                </label>
                <textarea
                  rows={2}
                  required
                  value={evalOutcomeNotes}
                  onChange={(e) => setEvalOutcomeNotes(e.target.value)}
                  placeholder="Internal review notes on operational execution or unexpected market headwinds."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEvaluatingRec(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEval}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {isSubmittingEval && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmittingEval ? "Saving Audit..." : "Record Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
