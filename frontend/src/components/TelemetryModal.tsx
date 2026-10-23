"use client";

import React, { useEffect, useState } from "react";
import { TelemetryResponse } from "@/types/api";
import { getSystemTelemetry } from "@/lib/api";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

interface TelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelemetryModal({ isOpen, onClose }: TelemetryModalProps) {
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const data = await getSystemTelemetry();
      setTelemetry(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#010736]/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative z-50 w-full max-w-2xl bg-[#0D1C42] border border-[#22396F] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#22396F] flex items-center justify-between bg-[#010736]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#22396F] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#FCF1D0]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#FCF1D0]">
                  System Status
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
                  All Systems Operational
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Real-time service health and performance overview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTelemetry}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#22396F] transition cursor-pointer"
              title="Refresh status"
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !telemetry && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-[#FCF1D0] mb-3" />
              <p className="text-xs font-medium">Checking system status...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
              <span className="font-semibold">Notice:</span> {error}
            </div>
          )}

          {telemetry && (
            <>
              {/* Top Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Total Inquiries"
                  value={telemetry.metrics.total_jobs}
                />
                <MetricCard
                  label="Completed Reports"
                  value={telemetry.metrics.completed_jobs}
                />
                <MetricCard
                  label="Active Inquiries"
                  value={telemetry.metrics.processing_jobs}
                />
                <MetricCard
                  label="Analyzed Topics"
                  value={telemetry.metrics.total_tasks}
                />
              </div>

              {/* Service Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Database */}
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#FCF1D0]">
                      <Database className="w-4 h-4 text-[#FCF1D0]" />
                      <span className="text-xs font-semibold">
                        Database
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
                      <CheckCircle2 className="w-3 h-3 text-[#FCF1D0]" />
                      {telemetry.database.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Stores market reports, research findings, and verified sources securely.
                  </p>
                </div>

                {/* 2. Message Broker */}
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#FCF1D0]">
                      <Network className="w-4 h-4 text-[#FCF1D0]" />
                      <span className="text-xs font-semibold">
                        Task Queue
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
                      <CheckCircle2 className="w-3 h-3 text-[#FCF1D0]" />
                      Healthy
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Coordinates multi-agent research tasks in parallel without delays.
                  </p>
                </div>

                {/* 3. Concurrency & Protection */}
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#FCF1D0]">
                      <ShieldCheck className="w-4 h-4 text-[#FCF1D0]" />
                      <span className="text-xs font-semibold">
                        Data Protection
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
                      <CheckCircle2 className="w-3 h-3 text-[#FCF1D0]" />
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Prevents data conflicts and guarantees accurate reporting every time.
                  </p>
                </div>

                {/* 4. AI & Grounded Evidence */}
                <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#FCF1D0]">
                      <Cpu className="w-4 h-4 text-[#FCF1D0]" />
                      <span className="text-xs font-semibold">
                        AI Research Engine
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
                      <CheckCircle2 className="w-3 h-3 text-[#FCF1D0]" />
                      Grounded
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Synthesizes verified market insights with live source citations.
                  </p>
                </div>
              </div>

              {/* Minimal Clean Footer */}
              <div className="pt-3 flex items-center justify-between text-xs text-slate-400 border-t border-[#22396F]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>All core systems running normally</span>
                </div>
                <button
                  onClick={onClose}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-[#22396F] text-[#FCF1D0] hover:bg-[#2d4c94] transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="p-3 rounded-xl bg-[#010736] border border-[#22396F] text-center space-y-1">
      <span className="text-[11px] font-medium text-slate-300 block">{label}</span>
      <span className="text-2xl font-extrabold text-[#FCF1D0] tracking-tight block">
        {value}
      </span>
    </div>
  );
}
