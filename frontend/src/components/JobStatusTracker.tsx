"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { JobDetailResponse, TaskSummaryResponse } from "@/types/api";
import { getJob } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
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
    title: "Market Overview",
    subtitle: "Market size, growth rates, and key drivers",
    icon: TrendingUp,
    accentColor: "text-[#FCF1D0]",
    borderColor: "border-[#22396F]",
    glowColor: "rgba(252, 241, 208, 0.15)",
  },
  COMPETITOR_ANALYSIS: {
    title: "Competitors & Moats",
    subtitle: "Key competitors, market share, and advantages",
    icon: Shield,
    accentColor: "text-slate-200",
    borderColor: "border-[#22396F]",
    glowColor: "rgba(34, 57, 111, 0.2)",
  },
  CUSTOMER_INSIGHTS: {
    title: "Customer Insights",
    subtitle: "Customer needs, buying habits, and demand",
    icon: Users,
    accentColor: "text-[#FCF1D0]",
    borderColor: "border-[#22396F]",
    glowColor: "rgba(252, 241, 208, 0.15)",
  },
  REGULATORY_RISKS: {
    title: "Risks & Regulations",
    subtitle: "Industry policies, legal factors, and risks",
    icon: AlertTriangle,
    accentColor: "text-amber-300",
    borderColor: "border-[#22396F]",
    glowColor: "rgba(245, 158, 11, 0.15)",
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
      <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#22396F] pb-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#FCF1D0]">
              Active Research Question
            </span>
            <h2 className="text-xl font-bold text-white leading-snug">
              {job?.research_question || "Processing Research Question..."}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchJob(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#010736] hover:bg-[#22396F] text-xs text-slate-300 hover:text-white border border-[#22396F] transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#FCF1D0]" : ""}`} />
              <span>Refresh</span>
            </button>

            {isCompleted && (
              <button
                onClick={onViewReport}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#FCF1D0] hover:brightness-105 text-xs font-semibold text-[#010736] shadow transition cursor-pointer"
              >
                <span>View Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Research Progress:</span>
              <span className="font-semibold text-white">
                {completedTasksCount} of {totalTasksCount} Topics Complete ({progressPercent}%)
              </span>
            </div>
            <span className="text-slate-400 text-[11px]">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div className="w-full h-2 bg-[#010736] rounded-full overflow-hidden border border-[#22396F]">
            <div
              className="h-full bg-[#FCF1D0] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Overview Tags */}
        {job && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-lg bg-[#010736] border border-[#22396F] text-slate-300 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-[#FCF1D0]" />
              <span>Market:</span>
              <span className="font-semibold text-white">{job.target_market}</span>
            </span>

            <span className="px-2.5 py-1 rounded-lg bg-[#010736] border border-[#22396F] text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-[#FCF1D0]" />
              <span>Region:</span>
              <span className="font-semibold text-white">{job.geography}</span>
            </span>

            {job.time_range && (
              <span className="px-2.5 py-1 rounded-lg bg-[#010736] border border-[#22396F] text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#FCF1D0]" />
                <span>Timeframe:</span>
                <span className="font-semibold text-white">{job.time_range}</span>
              </span>
            )}

            <StatusBadge status={job.status} />
          </div>
        )}
      </div>

      {/* ─── Ready Announcement Banner ──────────────────────── */}
      {isCompleted && (
        <div className="p-5 rounded-2xl bg-[#0D1C42] border border-[#22396F] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#010736] border border-[#22396F] flex items-center justify-center text-[#FCF1D0] flex-shrink-0">
              <Sparkles className="w-5 h-5 text-[#FCF1D0]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Your Research Report is Ready
              </h3>
              <p className="text-xs text-slate-300">
                All 4 research topics have been analyzed with verified sources.
              </p>
            </div>
          </div>

          <button
            onClick={onViewReport}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-[#010736] bg-[#FCF1D0] hover:brightness-105 shadow transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View Report</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 4-Topic Execution Grid ─────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#FCF1D0]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Research Topics (4 Areas)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Click any card to inspect findings and sources
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!job?.tasks || job.tasks.length === 0 ? (
            <div className="col-span-1 md:col-span-2 bg-[#0D1C42] p-12 rounded-2xl border border-[#22396F] flex flex-col items-center justify-center space-y-3 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#FCF1D0]" />
              <p className="text-xs text-slate-300 font-medium">
                Setting up research across 4 key areas...
              </p>
            </div>
          ) : (
            job.tasks.map((task) => {
              const config = VECTOR_CONFIG[task.task_type] || {
                title: task.task_type,
                subtitle: "Specialized research topic",
                icon: Compass,
                accentColor: "text-slate-200",
                borderColor: "border-[#22396F]",
                glowColor: "transparent",
              };
              const Icon = config.icon;
              const hasResult = !!task.result;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] transition-all duration-200 cursor-pointer space-y-4 hover:border-[#FCF1D0]/40 group relative ${
                  selectedTask?.id === task.id ? "ring-1 ring-[#FCF1D0] border-[#FCF1D0]" : ""
                }`}
              >
                {/* Topic Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-xl bg-[#010736] border border-[#22396F] flex items-center justify-center flex-shrink-0"
                    >
                      <Icon className={`w-4 h-4 ${config.accentColor}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-[#FCF1D0] transition-colors">
                        {config.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {config.subtitle}
                      </p>
                    </div>
                  </div>

                  <TaskStatusBadge status={task.status} />
                </div>

                {/* Sub-Task Grounded Snippet preview if completed */}
                {hasResult && task.result?.grounded_summary && (
                  <div className="p-3 rounded-xl bg-[#010736] border border-[#22396F] text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>CONFIDENCE: {Math.round(task.result.confidence_score * 100)}%</span>
                      <span>{task.result.key_findings.length} FINDINGS</span>
                    </div>
                    <p className="line-clamp-2 text-slate-200 leading-relaxed">
                      {task.result.grounded_summary}
                    </p>
                  </div>
                )}

                {/* Search Queries Executed */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Search className="w-3 h-3 text-[#FCF1D0]" />
                      Web Search Queries ({task.search_queries.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {task.search_queries.slice(0, 2).map((q, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-[#010736] border border-[#22396F] text-slate-300 truncate max-w-[280px]"
                        title={q}
                      >
                        {q}
                      </span>
                    ))}
                    {task.search_queries.length > 2 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-[#010736] text-slate-400 border border-[#22396F]">
                        +{task.search_queries.length - 2} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-2 border-t border-[#22396F]/50 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {task.completed_at
                      ? `Completed at ${new Date(task.completed_at).toLocaleTimeString()}`
                      : task.started_at
                      ? `Started at ${new Date(task.started_at).toLocaleTimeString()}`
                      : "Queued for research"}
                  </span>
                  <span className="text-[#FCF1D0] group-hover:translate-x-1 transition-transform flex items-center gap-0.5 font-medium">
                    View Details <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* ─── Task Deep Dive Modal ─────────────────────────────── */}
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
    subtitle: "Research Topic",
    icon: Compass,
    accentColor: "text-slate-200",
    borderColor: "border-[#22396F]",
    glowColor: "transparent",
  };
  const Icon = config.icon;
  const result = task.result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
      />

      <div className="relative z-50 w-full max-w-2xl bg-[#0D1C42] border border-[#22396F] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#22396F] flex items-center justify-between bg-[#010736]/60">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl bg-[#010736] border border-[#22396F] flex items-center justify-center text-[#FCF1D0]"
            >
              <Icon className="w-4 h-4 text-[#FCF1D0]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{config.title}</h3>
              <p className="text-[11px] text-slate-300">
                {config.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#010736] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#010736]/40">
          {/* Status Bar */}
          <div className="grid grid-cols-2 gap-3 text-center text-xs">
            <div className="p-3 rounded-xl bg-[#010736] border border-[#22396F] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Status</span>
              <span className="font-semibold text-white block">{task.status}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#010736] border border-[#22396F] space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Confidence</span>
              <span className="font-mono font-bold text-[#FCF1D0] block">
                {result ? `${Math.round(result.confidence_score * 100)}%` : "N/A"}
              </span>
            </div>
          </div>

          {/* Grounded Summary if available */}
          {result?.grounded_summary ? (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FCF1D0]" />
                Summary of Findings
              </span>
              <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] text-xs text-slate-200 leading-relaxed">
                {result.grounded_summary}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] text-xs text-slate-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#FCF1D0]" />
              <span>Analyzing live web sources...</span>
            </div>
          )}

          {/* Key Findings Claims */}
          {result?.key_findings && result.key_findings.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Verified Findings ({result.key_findings.length})
              </span>
              <div className="space-y-2">
                {result.key_findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#010736] border border-[#22396F] text-xs space-y-1.5"
                  >
                    <p className="text-slate-200">{f.claim}</p>
                    {f.source_url && (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#FCF1D0] hover:underline transition"
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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#FCF1D0]" />
              Web Search Queries
            </span>
            <div className="space-y-1.5">
              {task.search_queries.map((q, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-lg bg-[#010736] border border-[#22396F] text-xs font-mono text-slate-300 flex items-center gap-2"
                >
                  <span className="text-slate-500 text-[10px]">#{idx + 1}</span>
                  <span>{q}</span>
                </div>
              ))}
            </div>
          </div>
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
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    case "PARTIALLY_COMPLETED":
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/30 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Partial
        </span>
      );
    case "PROCESSING":
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#22396F] text-[#FCF1D0] border border-[#22396F] flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          In Progress
        </span>
      );
    case "FAILED":
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#010736] text-slate-400 border border-[#22396F] flex items-center gap-1">
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
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22396F] text-[#FCF1D0] border border-[#FCF1D0]/40 flex items-center gap-1">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          RUNNING
        </span>
      );
    case "DISPATCHED":
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#010736] text-slate-300 border border-[#22396F] flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 text-[#FCF1D0]" />
          QUEUED
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
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#010736] text-slate-400 border border-[#22396F] flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          PENDING
        </span>
      );
  }
}
