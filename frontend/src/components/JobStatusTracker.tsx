"use client";

import React, { useEffect, useState, useCallback } from "react";
import { JobDetailResponse, TaskSummaryResponse } from "@/types/api";
import { getJob } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Tag,
  Target,
  TrendingUp,
  Users,
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
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setIsRefreshing(true);
      try {
        const updated = await getJob(jobId);
        setJob(updated);
        setError(null);
        if (onJobUpdate) onJobUpdate(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load job status";
        setError(msg);
      } finally {
        if (showRefreshIndicator) setIsRefreshing(false);
      }
    },
    [jobId, onJobUpdate]
  );

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Polling effect while active
  useEffect(() => {
    if (!job) return;
    const isOngoing = job.status === "PENDING" || job.status === "PROCESSING";
    if (!isOngoing) return;

    const timer = setInterval(() => {
      fetchJob(false);
    }, 2000);

    return () => clearInterval(timer);
  }, [job, fetchJob]);

  const copyJobId = () => {
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!job && loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-panel rounded-2xl">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Connecting to job telemetry pipeline...</p>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="p-8 glass-panel rounded-2xl border-rose-500/30 text-center">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-100 mb-2">Job Telemetry Unavailable</h3>
        <p className="text-sm text-slate-400 mb-6">{error}</p>
        <button
          onClick={() => fetchJob(true)}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!job) return null;

  const totalTasks = job.tasks.length || 4;
  const completedTasks = job.tasks.filter((t) => t.status === "COMPLETED").length;
  const failedTasks = job.tasks.filter((t) => t.status === "FAILED").length;
  const inProgressTasks = job.tasks.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "DISPATCHED"
  ).length;
  const progressPercent = Math.round(
    ((completedTasks + (failedTasks > 0 ? failedTasks * 0.5 : 0)) / totalTasks) * 100
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Metadata */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300">
                Job ID: {job.id.slice(0, 8)}...
              </span>
              <button
                onClick={copyJobId}
                className="text-slate-400 hover:text-slate-200 transition p-1 rounded"
                title="Copy full UUID"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {copied && <span className="text-xs text-cyan-400 font-medium">Copied!</span>}

              {/* Status Pill */}
              <div className="ml-auto lg:ml-2">
                {job.status === "PENDING" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5 animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> Pending Queue
                  </span>
                )}
                {job.status === "PROCESSING" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing Vectors
                  </span>
                )}
                {job.status === "COMPLETED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                )}
                {job.status === "PARTIALLY_COMPLETED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Partially Completed
                  </span>
                )}
                {job.status === "FAILED" && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Job Failed
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
              {job.research_question}
            </h1>

            {/* Scope Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                {job.target_market}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                {job.geography}
              </span>
              {job.time_range && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  {job.time_range}
                </span>
              )}
              {job.focus_areas && job.focus_areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.focus_areas.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/50 text-slate-400 text-[11px]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 border-t sm:border-t-0 border-slate-800 pt-4 sm:pt-0">
            <button
              onClick={() => fetchJob(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/70 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
              title="Refresh job status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
              Refresh
            </button>
            <button
              onClick={onNewInquiry}
              className="text-xs text-slate-400 hover:text-cyan-400 transition"
            >
              + New Inquiry
            </button>
          </div>
        </div>

        {/* Distributed Progress Bar */}
        <div className="space-y-2 pt-2 border-t border-slate-800/60">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Sub-Task Execution Matrix ({completedTasks}/{totalTasks} Completed)
            </span>
            <span className="text-cyan-400 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4-Vector Sub-Task Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {job.tasks.map((task: TaskSummaryResponse) => {
          const config = VECTOR_CONFIG[task.task_type] || {
            title: task.task_type,
            subtitle: "Autonomous research vector",
            icon: BarChart3,
            accentColor: "text-slate-300",
            borderColor: "border-slate-800",
            glowColor: "rgba(100, 116, 139, 0.2)",
          };
          const Icon = config.icon;

          return (
            <div
              key={task.id}
              className={`glass-panel p-5 rounded-xl border transition-all duration-300 ${
                task.status === "IN_PROGRESS"
                  ? `${config.borderColor} shadow-lg`
                  : "border-slate-800/80 hover:border-slate-700"
              }`}
              style={{
                boxShadow:
                  task.status === "IN_PROGRESS" ? `0 0 20px -5px ${config.glowColor}` : undefined,
              }}
            >
              {/* Task Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg bg-slate-900 border border-slate-800 ${config.accentColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{config.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-1">{config.subtitle}</p>
                  </div>
                </div>

                {/* Sub-Task Status Badge */}
                <div>
                  {task.status === "PENDING" && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      QUEUED
                    </span>
                  )}
                  {task.status === "DISPATCHED" && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      DISPATCHED
                    </span>
                  )}
                  {task.status === "IN_PROGRESS" && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
                    </span>
                  )}
                  {task.status === "COMPLETED" && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> DONE
                    </span>
                  )}
                  {task.status === "FAILED" && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> FAILED
                    </span>
                  )}
                </div>
              </div>

              {/* Search Queries List */}
              <div className="space-y-1.5 my-3 bg-slate-950/60 p-3 rounded-lg border border-slate-900">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Search className="w-3 h-3 text-cyan-400" />
                  Targeted Tavily Search Queries ({task.search_queries.length})
                </span>
                <div className="space-y-1">
                  {task.search_queries.map((q, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-300 font-mono bg-slate-900/80 px-2 py-1 rounded border border-slate-800/60 truncate"
                      title={q}
                    >
                      • {q}
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Footer Meta */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/40">
                <span className="flex items-center gap-1">
                  <Flame
                    className={`w-3.5 h-3.5 ${
                      task.attempt_count > 1 ? "text-amber-400" : "text-slate-400"
                    }`}
                  />
                  Attempt: {task.attempt_count}/3
                </span>
                {task.completed_at ? (
                  <span className="text-emerald-400">
                    Finished in{" "}
                    {task.started_at
                      ? `${Math.max(
                          1,
                          Math.round(
                            (new Date(task.completed_at).getTime() -
                              new Date(task.started_at).getTime()) /
                              1000
                          )
                        )}s`
                      : "completed"}
                  </span>
                ) : task.started_at ? (
                  <span className="text-cyan-400">Executing LLM & web search...</span>
                ) : (
                  <span>Awaiting worker capacity</span>
                )}
              </div>

              {/* Error Callout if Failed */}
              {task.error_details && (
                <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                  <p className="font-semibold text-rose-200">Execution Error:</p>
                  <p className="text-[11px] text-rose-300/90 font-mono mt-0.5 line-clamp-2">
                    {task.error_details}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Report Available CTA Banner */}
      {(job.has_report || job.status === "COMPLETED" || job.status === "PARTIALLY_COMPLETED") && (
        <div className="glass-panel p-6 rounded-2xl border-cyan-500/40 bg-gradient-to-r from-slate-950 via-cyan-950/30 to-slate-950 relative overflow-hidden shadow-xl shadow-cyan-500/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Executive Intelligence Report Ready
                </h3>
                <p className="text-xs text-slate-300">
                  Cross-task findings synthesized, verified against web citations, and ready for review.
                </p>
              </div>
            </div>

            <button
              onClick={onViewReport}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
            >
              <span>View Executive Intelligence Report</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
