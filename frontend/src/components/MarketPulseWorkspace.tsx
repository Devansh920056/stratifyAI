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
  "Fintech & UPI",
  "Quick Commerce & Retail",
  "EV & Clean Mobility",
  "Renewables & Green Energy",
  "Indian IT & SaaS",
  "Pharma & Healthcare",
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load market updates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedSector, selectedType);
    const interval = setInterval(() => {
      loadData(selectedSector, selectedType);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedSector, selectedType]);

  const handleSync = async () => {
    const targetSector = selectedSector === "ALL" ? "Climate Tech" : selectedSector;
    setIsSyncing(true);
    setError(null);
    try {
      await syncMarketPulse(targetSector, 15);
      await loadData(selectedSector, selectedType);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getSignalBadge = (type: SignalCategoryType) => {
    switch (type) {
      case "COMPETITOR_MOVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
            <Zap className="w-3 h-3 text-[#FCF1D0]" />
            Competitor Move
          </span>
        );
      case "REGULATORY_UPDATE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#010736] border border-[#22396F] text-amber-300">
            <Scale className="w-3 h-3 text-amber-300" />
            Regulatory Update
          </span>
        );
      case "FUNDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
            <TrendingUp className="w-3 h-3 text-[#FCF1D0]" />
            Funding Event
          </span>
        );
      case "PARTNERSHIP":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#22396F] text-[#FCF1D0]">
            <Layers className="w-3 h-3 text-[#FCF1D0]" />
            Partnership
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#010736] border border-[#22396F] text-slate-200">
            <Radio className="w-3 h-3 text-[#FCF1D0]" />
            Market Shift
          </span>
        );
    }
  };

  const getSentimentBadge = (score: number) => {
    if (score > 0.15) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#FCF1D0] bg-[#22396F] px-2 py-0.5 rounded">
          <TrendingUp className="w-3 h-3 text-[#FCF1D0]" />
          +{score.toFixed(2)} Positive
        </span>
      );
    }
    if (score < -0.15) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
          <TrendingDown className="w-3 h-3 text-rose-400" />
          {score.toFixed(2)} Headwind
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-slate-300 bg-[#010736] px-2 py-0.5 rounded border border-[#22396F]">
        Neutral
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── Top Control Bar ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#22396F]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0] mb-2">
            <div className="w-2 h-2 rounded-full bg-[#FCF1D0] animate-pulse" />
            <span>Live Market Updates</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FCF1D0] tracking-tight">
            Market Trends & Verified News
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Real-time updates on competitors, industry sentiment, and official company filings.
          </p>
        </div>

        {/* Tab Switcher & CTA */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#010736] border border-[#22396F]">
            <button
              onClick={() => setActiveTab("stream")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "stream"
                  ? "bg-[#22396F] text-[#FCF1D0] shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-[#0D1C42]"
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-[#FCF1D0]" />
              <span>Live Updates</span>
            </button>

            <button
              onClick={() => setActiveTab("fusion")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "fusion"
                  ? "bg-[#22396F] text-[#FCF1D0] shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-[#0D1C42]"
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-[#FCF1D0]" />
              <span>Fact Check & Filings</span>
            </button>
          </div>

          {activeTab === "stream" && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#010736]" : "text-[#010736]"}`} />
              <span>{isSyncing ? "Updating..." : "Check for Updates"}</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === "fusion" ? (
        <EvidenceFusionPanel />
      ) : (
        <>
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ─── Stream Stats Bar ──────────────────────────────── */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#0D1C42] p-4 rounded-xl border border-[#22396F] space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Updates
                </span>
                <div className="text-2xl font-extrabold text-[#FCF1D0] font-mono">
                  {stats.total_signals}
                </div>
                <p className="text-[10px] text-slate-400">Live verified events</p>
              </div>

              <div className="bg-[#0D1C42] p-4 rounded-xl border border-[#22396F] space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FCF1D0]">
                  Positive News
                </span>
                <div className="text-2xl font-extrabold text-[#FCF1D0] font-mono">
                  {stats.positive_signals}
                </div>
                <p className="text-[10px] text-slate-400">Expansion & growth signals</p>
              </div>

              <div className="bg-[#0D1C42] p-4 rounded-xl border border-[#22396F] space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                  Risk Factors
                </span>
                <div className="text-2xl font-extrabold text-rose-300 font-mono">
                  {stats.negative_signals}
                </div>
                <p className="text-[10px] text-slate-400">Regulatory & market headwinds</p>
              </div>

              <div className="bg-[#0D1C42] p-4 rounded-xl border border-[#22396F] space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                  Market Sentiment
                </span>
                <div className="text-2xl font-extrabold text-[#FCF1D0] font-mono">
                  {stats.average_sentiment > 0 ? `+${stats.average_sentiment}` : stats.average_sentiment}
                </div>
                <p className="text-[10px] text-slate-400">Overall industry tone</p>
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    selectedSector === sec
                      ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                      : "bg-[#0D1C42] border-[#22396F] text-slate-300 hover:text-white"
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    selectedType === type.id
                      ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                      : "bg-[#0D1C42] border-[#22396F] text-slate-300 hover:text-white"
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
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Latest News & Events ({signals.length})
              </h3>
              <span className="text-xs text-slate-400">
                Auto-updates every 15s
              </span>
            </div>

            {isLoading && signals.length === 0 && (
              <div className="bg-[#0D1C42] p-12 rounded-2xl border border-[#22396F] flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-[#FCF1D0] animate-spin" />
                <p className="text-xs text-slate-300">Checking for latest news...</p>
              </div>
            )}

            {signals.length === 0 && !isLoading && (
              <div className="bg-[#0D1C42] p-12 rounded-2xl border border-[#22396F] text-center space-y-4">
                <Radio className="w-12 h-12 text-slate-500 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-slate-200">
                    No Updates Found for Selected Filter
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click &quot;Check for Updates&quot; to fetch the latest market news.
                  </p>
                </div>
                <button
                  onClick={handleSync}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#010736]" />
                  <span>Check for Updates Now</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] hover:border-[#FCF1D0]/40 transition space-y-3"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {getSignalBadge(sig.signal_type)}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-slate-300">
                        {sig.market_sector}
                      </span>
                      <span className="text-[10px] font-mono text-[#FCF1D0]">
                        {sig.source_domain}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {getSentimentBadge(sig.sentiment_score)}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
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
                      className="text-base font-bold text-white hover:text-[#FCF1D0] transition group flex items-start justify-between gap-3"
                    >
                      <span>{sig.headline}</span>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#FCF1D0] flex-shrink-0 mt-1 transition-colors" />
                    </a>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{sig.summary}</p>
                  </div>

                  {/* Clean Footer (No canonical URL metadata dump) */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#22396F] text-[11px] text-slate-400">
                    <span className="truncate max-w-sm">
                      Source: {sig.source_domain}
                    </span>
                    <span className="text-[#FCF1D0] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[#FCF1D0]" />
                      Verified Update
                    </span>
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
