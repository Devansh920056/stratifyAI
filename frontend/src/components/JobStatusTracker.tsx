"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { JobDetailResponse, TaskSummaryResponse } from "@/types/api";
import { getJob } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

interface JobStatusTrackerProps {
  jobId: string;
  initialJob?: JobDetailResponse | null;
  onJobUpdate?: (job: JobDetailResponse) => void;
  onViewReport: () => void;
  onNewInquiry: () => void;
}

const VECTOR_CONFIG: Record<
  string,
  {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    borderColor: string;
    glowColor: string;
  }
> = {
  MARKET_OVERVIEW: {
    title: "Market Overview & Macro Sizing",
    subtitle: "TAM/SAM sizing, historical CAGRs, macroeconomic drivers",
    icon: TrendingUp,
    accentColor: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    glowColor: "rgba(6, 182, 212, 0.2)",
  },
  COMPETITOR_ANALYSIS: {
    title: "Competitive Landscape & Moats",
    subtitle: "Incumbents, challenger dynamics, pricing & defensibility",
    icon: Shield,
    accentColor: "text-violet-400",
    borderColor: "border-violet-500/30",
    glowColor: "rgba(139, 92, 246, 0.2)",
  },
  CUSTOMER_INSIGHTS: {
    title: "Customer Personas & Pain Points",
    subtitle: "Buyer personas, purchasing triggers, unmet demand & churn",
    icon: Users,
    accentColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    glowColor: "rgba(245, 158, 11, 0.2)",
  },
  REGULATORY_RISKS: {
    title: "Regulatory Headwinds & Risks",
    subtitle: "Policy compliance, certification timelines, supply disruption",
    icon: AlertTriangle,
    accentColor: "text-rose-400",
    borderColor: "border-rose-500/30",
    glowColor: "rgba(244, 63, 94, 0.2)",
  },
};

export function JobStatusTracker({
  jobId,
  initialJob,
  onJobUpdate,
  onViewReport,
  onNewInquiry,
}: JobStatusTrackerProps) {
  const [job, setJob] = useState<JobDetailResponse | null>(initialJob || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskSummaryResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchJob = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setIsRefreshing(true);
      try {
        const updated = await getJob(jobId);
        setJob(updated);
        setLastUpdated(new Date());
        setError(null);
        if (onJobUpdate) onJobUpdate(updated);

        // Keep selectedTask in sync if updated
        if (selectedTask && updated.tasks) {
          const matching = updated.tasks.find((t) => t.id === selectedTask.id);
          if (matching) setSelectedTask(matching);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load job status";
        setError(msg);
      } finally {
        if (showRefreshIndicator) setIsRefreshing(false);
      }
    },
    [jobId, onJobUpdate, selectedTask]
  );

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Polling effect while active
  useEffect(() => {
    if (!job) return;
    const isOngoing = job.status === "PENDING" || job.status === "PROCESSING";
    if (!isOngoing) return;

    const interval = setInterval(() => {
      fetchJob(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [job, fetchJob]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completedTasksCount = useMemo(() => {
    if (!job || !job.tasks) return 0;
    return job.tasks.filter((t) => t.status === "COMPLETED").length;
  }, [job]);

  const totalTasksCount = job?.tasks?.length || job?.tasks_count || 4;
  const progressPercent = Math.round((completedTasksCount / totalTasksCount) * 100);

  const isCompleted =
    job?.status === "COMPLETED" ||
    job?.status === "PARTIALLY_COMPLETED" ||
    job?.has_report === true;

  return (
    <div className="space-y-6">
      {/* ─── Top Control Card ────────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Inquiry Tracking Matrix
              </span>
              <span className="text-slate-600">•</span>
              <button
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition"
                title="Copy Job ID"
              >
                <span>ID: {jobId.slice(0, 8)}...</span>
                <Copy className="w-3 h-3" />
                {copied && <span className="text-emerald-400 font-sans">Copied!</span>}
              </button>
            </div>
            <h2 className="text-xl font-bold text-slate-100 leading-snug">
              {job?.research_question || "Processing Research Inquiry..."}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchJob(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
              <span>Refresh</span>
            </button>

            {isCompleted && (
              <button
                onClick={onViewReport}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition active:scale-95 cursor-pointer animate-pulse-slow"
              >
                <span>View Executive Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Status Meta */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Orchestration Progress:</span>
              <span className="font-semibold text-slate-200">
                {completedTasksCount} of {totalTasksCount} Vectors Complete ({progressPercent}%)
              </span>
            </div>
            <span className="text-slate-500 text-[11px]">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500 transition-all duration-500 rounded-full glow-cyan"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Metadata Badges */}
        {job && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-300 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-indigo-400" />
              <span>Market:</span>
              <span className="font-semibold text-white">{job.target_market}</span>
            </span>

            <span className="px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>Geo:</span>
              <span className="font-semibold text-white">{job.geography}</span>
            </span>

            {job.time_range && (
              <span className="px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Horizon:</span>
                <span className="font-semibold text-white">{job.time_range}</span>
              </span>
            )}

            <StatusBadge status={job.status} />
          </div>
        )}
      </div>

      {/* ─── Ready Announcement Banner ──────────────────────── */}
      {isCompleted && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/80 via-indigo-950/80 to-slate-900 border border-cyan-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Executive Market Intelligence Report Compiled
              </h3>
              <p className="text-xs text-slate-400">
                All 4 research vectors have converged with verified real web evidence & grounded citations.
              </p>
            </div>
          </div>

          <button
            onClick={onViewReport}
            className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Open Executive Report</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 4-Vector Execution Grid ─────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Orthogonal Research Vectors (4 Tasks)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            Click any vector card to inspect findings & search queries
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!job?.tasks || job.tasks.length === 0 ? (
            <div className="col-span-1 md:col-span-2 glass-panel p-12 rounded-2xl flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-xs text-slate-300 font-medium">
                Decomposing inquiry into 4 research vectors...
              </p>
            </div>
          ) : (
            job.tasks.map((task) => {
              const config = VECTOR_CONFIG[task.task_type] || {
                title: task.task_type,
                subtitle: "Specialized research vector",
                icon: Compass,
                accentColor: "text-slate-300",
                borderColor: "border-slate-800",
                glowColor: "transparent",
              };
              const Icon = config.icon;
              const hasResult = !!task.result;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`glass-panel p-5 rounded-xl border transition-all duration-200 cursor-pointer space-y-4 hover:border-slate-600 group relative ${
                  selectedTask?.id === task.id ? "ring-1 ring-cyan-500 border-cyan-500/50" : ""
                }`}
              >
                {/* Vector Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl bg-slate-900 border ${config.borderColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className={`w-4 h-4 ${config.accentColor}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {config.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {config.subtitle}
                      </p>
                    </div>
                  </div>

                  <TaskStatusBadge status={task.status} />
                </div>

                {/* Sub-Task Grounded Snippet preview if completed */}
                {hasResult && task.result?.grounded_summary && (
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>CONFIDENCE: {Math.round(task.result.confidence_score * 100)}%</span>
                      <span>{task.result.key_findings.length} CLAIMS</span>
                    </div>
                    <p className="line-clamp-2 text-slate-300 leading-relaxed">
                      {task.result.grounded_summary}
                    </p>
                  </div>
                )}

                {/* Search Queries Executed */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      Generated Web Queries ({task.search_queries.length})
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">
                      OCC v{task.version} • Attempt {task.attempt_count}/3
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.search_queries.slice(0, 2).map((q, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-slate-400 truncate max-w-[280px]"
                        title={q}
                      >
                        {q}
                      </span>
                    ))}
                    {task.search_queries.length > 2 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-500">
                        +{task.search_queries.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {task.completed_at
                      ? `Completed at ${new Date(task.completed_at).toLocaleTimeString()}`
                      : task.started_at
                      ? `Started at ${new Date(task.started_at).toLocaleTimeString()}`
                      : "Pending worker dispatch"}
                  </span>
                  <span className="text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 font-medium">
                    Inspect <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* ─── Task Deep Dive Modal / Drawer ───────────────────── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-Task Inspector Modal ────────────────────────────────
function TaskDetailModal({
  task,
  onClose,
}: {
  task: TaskSummaryResponse;
  onClose: () => void;
}) {
  const config = VECTOR_CONFIG[task.task_type] || {
    title: task.task_type,
    subtitle: "Research Vector",
    icon: Compass,
    accentColor: "text-slate-300",
    borderColor: "border-slate-800",
    glowColor: "transparent",
  };
  const Icon = config.icon;
  const result = task.result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
      />

      <div className="relative z-50 w-full max-w-2xl glass-panel bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl bg-slate-900 border ${config.borderColor} flex items-center justify-center`}
            >
              <Icon className={`w-4 h-4 ${config.accentColor}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{config.title}</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Task UUID: {task.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status & Timing Bar */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">OCC Version</span>
              <span className="font-mono font-bold text-cyan-300 block">v{task.version}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Attempts</span>
              <span className="font-mono font-bold text-slate-200 block">
                {task.attempt_count} / 3
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">Confidence</span>
              <span className="font-mono font-bold text-emerald-400 block">
                {result ? `${Math.round(result.confidence_score * 100)}%` : "N/A"}
              </span>
            </div>
          </div>

          {/* Grounded Summary if available */}
          {result?.grounded_summary ? (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Gemini Synthesized Vector Summary
              </span>
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                {result.grounded_summary}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Worker executing web search and AI reasoning...</span>
            </div>
          )}

          {/* Key Findings Claims */}
          {result?.key_findings && result.key_findings.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Factual Claims & Evidence Links ({result.key_findings.length})
              </span>
              <div className="space-y-2">
                {result.key_findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-1.5"
                  >
                    <p className="text-slate-200">{f.claim}</p>
                    {f.source_url && (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[360px]">{f.source_url}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Search Queries */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-400" />
              Live Web Search Queries
            </span>
            <div className="space-y-1.5">
              {task.search_queries.map((q, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2"
                >
                  <span className="text-slate-600 text-[10px]">#{idx + 1}</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Error Details if failed */}
          {task.error_details && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-4 h-4" />
                Execution Error Diagnostic
              </span>
              <p className="font-mono text-[11px] leading-relaxed">{task.error_details}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status Badges ───────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    case "PARTIALLY_COMPLETED":
      return (
        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Degraded (Partial)
        </span>
      );
    case "PROCESSING":
      return (
        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </span>
      );
    case "FAILED":
      return (
        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
  }
}

function TaskStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/90 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          DONE
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          RUNNING
        </span>
      );
    case "DISPATCHED":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/90 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
          <Zap className="w-2.5 h-2.5" />
          DISPATCHED
        </span>
      );
    case "FAILED":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/90 text-rose-400 border border-rose-500/30 flex items-center gap-1">
          <AlertCircle className="w-2.5 h-2.5" />
          FAILED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800/80 text-slate-400 border border-slate-700 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          QUEUED
        </span>
      );
  }
}
