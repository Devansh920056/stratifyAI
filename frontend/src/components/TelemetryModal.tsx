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
      setError(err instanceof Error ? err.message : "Failed to load system telemetry");
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
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative z-50 w-full max-w-3xl glass-panel bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Stratify AI System Telemetry & Architecture
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live distributed systems invariants, container health & pipeline telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTelemetry}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !telemetry && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
              <p className="text-xs font-medium">Querying infrastructure nodes...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
              <span className="font-semibold">Telemetry Query Warning:</span> {error}
            </div>
          )}

          {telemetry && (
            <>
              {/* Top Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Total Inquiries"
                  value={telemetry.metrics.total_jobs}
                  color="text-cyan-400"
                />
                <MetricCard
                  label="Completed Jobs"
                  value={telemetry.metrics.completed_jobs}
                  color="text-emerald-400"
                />
                <MetricCard
                  label="In-Flight Jobs"
                  value={telemetry.metrics.processing_jobs}
                  color="text-amber-400"
                />
                <MetricCard
                  label="Decomposed Tasks"
                  value={telemetry.metrics.total_tasks}
                  color="text-violet-400"
                />
              </div>

              {/* Infrastructure Invariants Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. PostgreSQL */}
                <div className="glass-card p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Database className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Storage Layer
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      {telemetry.database.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Engine:</span>
                      <span className="font-mono">{telemetry.database.engine}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Host Port:</span>
                      <span className="font-mono text-cyan-300">
                        127.0.0.1:{telemetry.database.host_port}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Isolation:</span>
                      <span>{telemetry.database.isolation}</span>
                    </div>
                  </div>
                </div>

                {/* 2. RabbitMQ */}
                <div className="glass-card p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Network className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Message Broker
                      </span>
                    </div>
                    <a
                      href="http://localhost:15672"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold transition"
                    >
                      Admin UI
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Exchange:</span>
                      <span className="font-mono">{telemetry.broker.exchange}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Primary Queue:</span>
                      <span className="font-mono text-cyan-300">{telemetry.broker.queue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dead Letter Queue:</span>
                      <span className="font-mono text-rose-300">{telemetry.broker.dlq}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Concurrency & Outbox */}
                <div className="glass-card p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-violet-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Reliability & OCC
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-violet-300">QoS Prefetch: 2</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Outbox Pattern:</span>
                      <span className="text-[11px] text-slate-300">
                        {telemetry.orchestrator.outbox_pattern}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Concurrency Control:</span>
                      <span className="text-[11px] text-slate-300">
                        {telemetry.orchestrator.concurrency_control}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. AI & Anti-Hallucination */}
                <div className="glass-card p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Cpu className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        AI Reasoning & Search
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-400">Grounded</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">LLM Synthesis:</span>
                      <span className="font-medium text-emerald-300">
                        {telemetry.ai_providers.llm}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Web Evidence:</span>
                      <span>{telemetry.ai_providers.search}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Citation Guardrail:</span>
                      <span className="text-[11px] text-slate-300">
                        {telemetry.ai_providers.anti_hallucination}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer Links Bar */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800">
                <span className="text-slate-500">Developer Shortcuts:</span>
                <div className="flex items-center gap-4">
                  <a
                    href="http://localhost:8000/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition"
                  >
                    <span>FastAPI OpenAPI Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="http://localhost:15672"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <span>RabbitMQ Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="http://localhost:8000/api/v1/health/telemetry"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-slate-300 hover:text-white transition"
                  >
                    <span>Raw JSON Telemetry</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
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
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card p-3 rounded-xl border border-slate-800 text-center space-y-1">
      <span className="text-[11px] font-medium text-slate-400 block">{label}</span>
      <span className={`text-2xl font-extrabold ${color} tracking-tight`}>{value}</span>
    </div>
  );
}
