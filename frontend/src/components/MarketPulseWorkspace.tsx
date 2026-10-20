"use client";

import React, { useEffect, useState } from "react";
import {
  fetchMarketPulse,
  fetchMarketPulseStats,
  syncMarketPulse,
} from "@/lib/api";
import {
  MarketPulseStatsResponse,
  MarketSignalItem,
  SignalCategoryType,
} from "@/types/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { EvidenceFusionPanel } from "./EvidenceFusionPanel";

const SECTORS = [
  "ALL",
  "Climate Tech",
  "Developer Productivity",
  "Cybersecurity",
  "Autonomous Mobility",
];

const SIGNAL_TYPES: { id: string; label: string }[] = [
  { id: "ALL", label: "All Categories" },
  { id: "COMPETITOR_MOVE", label: "Competitor Move" },
  { id: "REGULATORY_UPDATE", label: "Regulatory Update" },
  { id: "MARKET_SHIFT", label: "Market Shift" },
  { id: "PARTNERSHIP", label: "Partnership" },
  { id: "FUNDING", label: "Funding Event" },
];

export function MarketPulseWorkspace() {
  const [activeTab, setActiveTab] = useState<"stream" | "fusion">("stream");
  const [signals, setSignals] = useState<MarketSignalItem[]>([]);
  const [stats, setStats] = useState<MarketPulseStatsResponse | null>(null);
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (sector = selectedSector, type = selectedType) => {
    setIsLoading(true);
    setError(null);
    try {
      const [res, statsRes] = await Promise.all([
        fetchMarketPulse(sector, type),
        fetchMarketPulseStats(),
      ]);
      setSignals(res.signals);
      setStats(statsRes);
    } catch (err: any) {
      setError(err?.message || "Failed to load market signals.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedSector, selectedType);
    const interval = setInterval(() => {
      loadData(selectedSector, selectedType);
    }, 15000); // 15-second heartbeat poll
    return () => clearInterval(interval);
  }, [selectedSector, selectedType]);

  const handleSync = async () => {
    const targetSector = selectedSector === "ALL" ? "Climate Tech" : selectedSector;
    setIsSyncing(true);
    setError(null);
    try {
      await syncMarketPulse(targetSector, 15);
      await loadData(selectedSector, selectedType);
    } catch (err: any) {
      setError(err?.message || "Live sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getSignalBadge = (type: SignalCategoryType) => {
    switch (type) {
      case "COMPETITOR_MOVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
            <Zap className="w-3 h-3 text-indigo-400" />
            Competitor Move
          </span>
        );
      case "REGULATORY_UPDATE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/80 border border-red-500/40 text-red-300">
            <Scale className="w-3 h-3 text-red-400" />
            Regulatory Update
          </span>
        );
      case "FUNDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            Funding Event
          </span>
        );
      case "PARTNERSHIP":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
            <Layers className="w-3 h-3 text-cyan-400" />
            Partnership
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-950/80 border border-violet-500/40 text-violet-300">
            <Radio className="w-3 h-3 text-violet-400" />
            Market Shift
          </span>
        );
    }
  };

  const getSentimentBadge = (score: number) => {
    if (score > 0.15) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          +{score.toFixed(2)} Bullish
        </span>
      );
    }
    if (score < -0.15) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
          <TrendingDown className="w-3 h-3 text-red-400" />
          {score.toFixed(2)} Headwind
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
        Neutral
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── Top Control Bar ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GDELT 2.0 & SEC EDGAR Ingestion Pipeline Online</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Market Pulse & Evidence Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Continuous intelligence feed detecting competitor announcements, cross-verifying commercial news against statutory SEC Form 10-K/10-Q disclosures and academic research.
          </p>
        </div>

        {/* Tab Switcher & CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab("stream")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "stream"
                  ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Live News Signals</span>
            </button>

            <button
              onClick={() => setActiveTab("fusion")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "fusion"
                  ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
              <span>SEC Evidence Fusion</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                Stage 9
              </span>
            </button>
          </div>

          {activeTab === "stream" && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Ingesting Feeds..." : "Sync Latest Signals"}</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === "fusion" ? (
        <EvidenceFusionPanel />
      ) : (
        <>
          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

      {/* ─── Stream Stats Bar ──────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total Ingested Signals
            </span>
            <div className="text-2xl font-extrabold text-slate-100 font-mono">
              {stats.total_signals}
            </div>
            <p className="text-[10px] text-slate-500">Deduplicated by canonical URL</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Bullish Signals
            </span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono">
              {stats.positive_signals}
            </div>
            <p className="text-[10px] text-slate-500">Expansion & capital velocity</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
              Headwind / Risk Signals
            </span>
            <div className="text-2xl font-extrabold text-red-400 font-mono">
              {stats.negative_signals}
            </div>
            <p className="text-[10px] text-slate-500">Regulatory friction & scrutiny</p>
          </div>

          <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
              Average Tone Index
            </span>
            <div className="text-2xl font-extrabold text-cyan-300 font-mono">
              {stats.average_sentiment > 0 ? `+${stats.average_sentiment}` : stats.average_sentiment}
            </div>
            <p className="text-[10px] text-slate-500">Calibrated tone scale (-1.0 to +1.0)</p>
          </div>
        </div>
      )}

      {/* ─── Filter Pills Bar ──────────────────────────────── */}
      <div className="space-y-3">
        {/* Sector Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Sector:</span>
          {SECTORS.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedSector === sec
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {sec === "ALL" ? "All Sectors" : sec}
            </button>
          ))}
        </div>

        {/* Signal Type Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Category:</span>
          {SIGNAL_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedType === type.id
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Signals Feed Cards ────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Live Stream Feed ({signals.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Auto-polling every 15s
          </span>
        </div>

        {isLoading && signals.length === 0 && (
          <div className="glass-panel p-12 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs text-slate-400">Streaming market signals...</p>
          </div>
        )}

        {signals.length === 0 && !isLoading && (
          <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
            <Radio className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-200">
                No Signals Ingested for Selected Filter
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Click &quot;Sync Latest Signals&quot; to fetch breaking market events from GDELT 2.0.
              </p>
            </div>
            <button
              onClick={handleSync}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ingest Signals Now</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {signals.map((sig) => (
            <div
              key={sig.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-3"
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  {getSignalBadge(sig.signal_type)}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {sig.market_sector}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {sig.source_domain}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {getSentimentBadge(sig.sentiment_score)}
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {new Date(sig.published_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Headline with Link */}
              <div>
                <a
                  href={sig.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-bold text-slate-100 hover:text-cyan-300 transition group flex items-start justify-between gap-3"
                >
                  <span>{sig.headline}</span>
                  <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 flex-shrink-0 mt-1 transition-colors" />
                </a>
                <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{sig.summary}</p>
              </div>

              {/* Provenance Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[11px] text-slate-500">
                <span className="font-mono truncate max-w-sm">
                  Canonical: {sig.canonical_url}
                </span>
                <span className="text-emerald-400 font-medium">Verified Signal</span>
              </div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
