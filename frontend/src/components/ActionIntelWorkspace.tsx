"use client";

import React, { useEffect, useState } from "react";
import {
  fetchRecommendations,
  generateRecommendations,
  listRecentJobs,
  updateRecommendationStatus,
} from "@/lib/api";
import {
  JobDetailResponse,
  RecommendationItem,
  RecommendationStatusType,
} from "@/types/api";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";

interface ActionIntelWorkspaceProps {
  activeJob: JobDetailResponse | null;
  onSelectJob: (job: JobDetailResponse) => void;
  onNewInquiry: () => void;
}

export function ActionIntelWorkspace({
  activeJob,
  onSelectJob,
  onNewInquiry,
}: ActionIntelWorkspaceProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobDetailResponse[]>([]);
  const [selectedEvidenceRec, setSelectedEvidenceRec] = useState<RecommendationItem | null>(null);

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
        const res = await fetchRecommendations(activeJob.id);
        if (mounted) {
          setRecommendations(res.items);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Failed to load recommendations.");
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

  const handleGenerate = async () => {
    if (!activeJob) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateRecommendations(activeJob.id);
      setRecommendations(res.items);
    } catch (err: any) {
      setError(err?.message || "Failed to generate recommendations.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStatusChange = async (
    recId: string,
    newStatus: RecommendationStatusType
  ) => {
    // Optimistic UI update
    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
    );
    try {
      const updated = await updateRecommendationStatus(recId, newStatus);
      setRecommendations((prev) =>
        prev.map((r) => (r.id === recId ? updated : r))
      );
    } catch (err: any) {
      setError(err?.message || "Failed to update recommendation status.");
      // Rollback
      if (activeJob) {
        const res = await fetchRecommendations(activeJob.id);
        setRecommendations(res.items);
      }
    }
  };

  const getStatusBadge = (status: RecommendationStatusType) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <Check className="w-3 h-3 text-emerald-400" />
            Approved
          </span>
        );
      case "IMPLEMENTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            Implemented
          </span>
        );
      case "REVIEWED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-950/80 border border-violet-500/40 text-violet-300">
            <Layers className="w-3 h-3 text-violet-400" />
            Reviewed
          </span>
        );
      case "DISMISSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 border border-slate-700 text-slate-400">
            <XCircle className="w-3 h-3 text-slate-500" />
            Dismissed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
            <Clock className="w-3 h-3 text-indigo-400" />
            Draft
          </span>
        );
    }
  };

  const getHorizonBadge = (horizon: string) => {
    switch (horizon) {
      case "IMMEDIATE":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/60 border border-amber-500/30 text-amber-300">
            0–30 Days
          </span>
        );
      case "NEAR_TERM":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
            1–3 Months
          </span>
        );
      case "MEDIUM_TERM":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/60 border border-indigo-500/30 text-indigo-300">
            3–6 Months
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300">
            6+ Months
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
            <span>Action Intelligence & Decision Matrix</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Strategic Recommendations Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Prioritized strategic initiatives with quantitative outcome hypotheses,
            calibrated effort vs. impact scores, and verifiable evidence provenance.
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

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── State: No active job selected ───────────────────── */}
      {!activeJob && (
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

      {/* ─── State: Active Job without Recommendations ───────── */}
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

      {/* ─── State: Recommendations Loaded ───────────────────── */}
      {recommendations.length > 0 && (
        <div className="space-y-8">
          {/* ══════════════════════════════════════════════════
              2x2 Prioritization Matrix (Visual Quadrants)
          ══════════════════════════════════════════════════ */}
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
              {/* Quadrant 1: Quick Wins */}
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Quick Wins (High Impact, Low Effort)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
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
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-slate-200 font-medium truncate">{r.title}</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400">
                          +{r.priority_score}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quadrant 2: Major Strategic Bets */}
              <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    Major Strategic Bets (High Impact, High Effort)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-500/40">
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
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-slate-200 font-medium truncate">{r.title}</span>
                        <span className="text-[10px] font-mono font-bold text-indigo-400">
                          +{r.priority_score}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quadrant 3: Operational Fill-ins */}
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Operational Fill-ins (Low Impact, Low Effort)
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

              {/* Quadrant 4: Reconsider / Discard */}
              <div className="p-4 rounded-xl bg-amber-950/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">
                    High Friction / Discard (Low Impact, High Effort)
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

          {/* ══════════════════════════════════════════════════
              Recommendation Detailed Cards
          ══════════════════════════════════════════════════ */}
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
                    <div className="flex items-center gap-3">
                      {getStatusBadge(rec.status)}
                      {getHorizonBadge(rec.time_horizon)}
                      <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        Priority: {rec.priority_score}
                      </span>
                    </div>

                    {/* Action Controls */}
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

                      {rec.status === "IMPLEMENTED" && (
                        <button
                          onClick={() => handleStatusChange(rec.id, "REVIEWED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Complete Review</span>
                        </button>
                      )}

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

                  {/* Title & Description */}
                  <div className="space-y-2">
                    <h4 className="text-lg font-bold text-slate-100">{rec.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>
                    <p className="text-xs text-slate-400 italic">
                      <strong className="text-slate-300 not-italic">Strategic Rationale: </strong>
                      {rec.rationale}
                    </p>
                  </div>

                  {/* Metrics & Hypothesis Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Outcome Hypothesis
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed font-mono">
                        {rec.outcome_hypothesis}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        Target Success Metric
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-200 font-medium">
                          {rec.success_metric}:
                        </span>
                        {rec.target_metric_value && (
                          <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                            {rec.target_metric_value}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Impact & Effort Progress Bars + Provenance Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-850">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Impact:</span>
                        <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
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
    </div>
  );
}
