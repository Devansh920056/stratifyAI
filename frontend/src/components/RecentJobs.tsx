"use client";

import React, { useEffect, useState } from "react";
import { JobDetailResponse } from "@/types/api";
import { listRecentJobs } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Target,
  X,
} from "lucide-react";

interface RecentJobsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectJob: (job: JobDetailResponse) => void;
  currentJobId: string | null;
}

export function RecentJobs({
  isOpen,
  onClose,
  onSelectJob,
  currentJobId,
}: RecentJobsProps) {
  const [jobs, setJobs] = useState<JobDetailResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await listRecentJobs(20);
      setJobs(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load recent jobs";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadJobs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <div className="relative z-50 w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Recent Inquiries</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadJobs}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
              <p className="text-xs">Fetching research records...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-sm font-medium text-slate-400">No research jobs yet</p>
              <p className="text-xs text-slate-400">Submit your first inquiry to get started</p>
            </div>
          )}

          {jobs.map((job) => {
            const isSelected = job.id === currentJobId;

            return (
              <div
                key={job.id}
                onClick={() => {
                  onSelectJob(job);
                  onClose();
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/40"
                    : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-200 line-clamp-2 leading-snug">
                    {job.research_question}
                  </h3>

                  {/* Status pill */}
                  <span className="shrink-0">
                    {job.status === "COMPLETED" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                    {job.status === "PROCESSING" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Active
                      </span>
                    )}
                    {job.status === "PENDING" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Queued
                      </span>
                    )}
                    {job.status === "PARTIALLY_COMPLETED" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Partial
                      </span>
                    )}
                    {job.status === "FAILED" && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        Failed
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                  <div className="flex items-center gap-1 truncate max-w-[180px]">
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span className="truncate">{job.target_market}</span>
                  </div>

                  <span className="font-mono text-[10px]">
                    {new Date(job.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
