"use client";

import React, { useEffect, useMemo, useState } from "react";
import { JobDetailResponse } from "@/types/api";
import { listRecentJobs } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";

interface RecentJobsProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectJob: (job: JobDetailResponse) => void;
  currentJobId: string | null;
}

type FilterStatus = "ALL" | "COMPLETED" | "PROCESSING" | "FAILED";

export function RecentJobs({
  isOpen,
  onClose,
  onSelectJob,
  currentJobId,
}: RecentJobsProps) {
  const [jobs, setJobs] = useState<JobDetailResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await listRecentJobs(50);
      setJobs(data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load recent research";
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter === "COMPLETED") {
        if (job.status !== "COMPLETED" && job.status !== "PARTIALLY_COMPLETED") return false;
      } else if (statusFilter === "PROCESSING") {
        if (job.status !== "PENDING" && job.status !== "PROCESSING") return false;
      } else if (statusFilter === "FAILED") {
        if (job.status !== "FAILED") return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        job.research_question.toLowerCase().includes(q) ||
        job.target_market.toLowerCase().includes(q) ||
        job.geography.toLowerCase().includes(q)
      );
    });
  }, [jobs, searchQuery, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#010736]/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <div className="relative z-50 w-full max-w-md h-full bg-[#0D1C42] border-l border-[#22396F] shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#22396F] flex items-center justify-between bg-[#010736]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#22396F] flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#FCF1D0]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FCF1D0]">Research History</h2>
              <p className="text-[11px] text-slate-300">
                {jobs.length} past reports saved
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={loadJobs}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#22396F] transition cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#FCF1D0]" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#22396F] transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[#22396F] space-y-3 bg-[#010736]/30">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past research..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#010736] border border-[#22396F] text-xs text-white placeholder-slate-400 focus:border-[#FCF1D0] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Chips */}
          <div className="flex gap-1.5">
            {(["ALL", "COMPLETED", "PROCESSING", "FAILED"] as FilterStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                    : "bg-[#010736] border-[#22396F] text-slate-300 hover:text-white"
                }`}
              >
                {st === "ALL"
                  ? "All"
                  : st === "COMPLETED"
                  ? "Completed"
                  : st === "PROCESSING"
                  ? "In Progress"
                  : "Failed"}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Loader2 className="w-7 h-7 animate-spin text-[#FCF1D0] mb-2" />
              <p className="text-xs">Loading past research...</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && filteredJobs.length === 0 && (
            <div className="text-center py-20 space-y-3 text-slate-400 text-xs">
              <Compass className="w-8 h-8 mx-auto text-slate-500" />
              <p>No research matches your filter.</p>
            </div>
          )}

          {filteredJobs.map((job) => {
            const isCurrent = currentJobId === job.id;
            return (
              <div
                key={job.id}
                onClick={() => {
                  onSelectJob(job);
                  onClose();
                }}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2 group ${
                  isCurrent
                    ? "bg-[#22396F] border-[#FCF1D0] shadow-md"
                    : "bg-[#010736] border-[#22396F] hover:border-[#FCF1D0]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-100 line-clamp-2 group-hover:text-[#FCF1D0] transition-colors leading-relaxed">
                    {job.research_question}
                  </h4>
                  <StatusMiniBadge status={job.status} />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#22396F]/60">
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <Target className="w-3 h-3 text-[#FCF1D0] flex-shrink-0" />
                    <span className="truncate">{job.target_market}</span>
                  </div>

                  <span className="font-mono text-[10px] text-slate-400 flex-shrink-0">
                    {formatRelativeTime(job.created_at)}
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

function StatusMiniBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#22396F] text-[#FCF1D0] flex-shrink-0">
          REPORT READY
        </span>
      );
    case "PARTIALLY_COMPLETED":
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#22396F] text-[#FCF1D0] flex-shrink-0">
          PARTIAL
        </span>
      );
    case "PROCESSING":
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#22396F] text-[#FCF1D0] flex-shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FCF1D0] animate-ping" />
          ACTIVE
        </span>
      );
    case "FAILED":
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-500/30 flex-shrink-0">
          FAILED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#010736] text-slate-400 border border-[#22396F] flex-shrink-0">
          QUEUED
        </span>
      );
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}
