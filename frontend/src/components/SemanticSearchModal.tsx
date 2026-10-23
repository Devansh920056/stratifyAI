"use client";

import React, { useEffect, useState } from "react";
import {
  fetchVectorStats,
  indexVectorMemory,
  searchSemanticMemory,
} from "@/lib/api";
import {
  SemanticMatchItem,
  SemanticSearchResponse,
  VectorMemoryStatsResponse,
} from "@/types/api";
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Filter,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";

interface SemanticSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_QUERIES = [
  "UPI credit line expansion and RBI digital lending compliance",
  "Quick commerce dark store density and delivery economics in Indian metros",
  "India EV 2-wheeler battery manufacturing and PLI subsidies",
  "India Semiconductor Mission fab construction milestones and OSAT",
];

export function SemanticSearchModal({ isOpen, onClose }: SemanticSearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [minSimilarity, setMinSimilarity] = useState<number>(0.20);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [searchResult, setSearchResult] = useState<SemanticSearchResponse | null>(null);
  const [stats, setStats] = useState<VectorMemoryStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  async function loadStats() {
    try {
      const s = await fetchVectorStats();
      setStats(s);
    } catch (e: unknown) {
      console.warn("Failed to load vector stats:", e);
    }
  }

  async function handleIndexMemory(reindexAll = false) {
    setIsIndexing(true);
    setError(null);
    try {
      await indexVectorMemory(reindexAll);
      await loadStats();
      if (query.trim()) {
        await executeSearch(query);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Vector indexing failed.");
    } finally {
      setIsIndexing(false);
    }
  }

  async function executeSearch(searchQuery = query) {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const entityTypes =
        selectedEntity === "ALL" ? undefined : [selectedEntity];
      const sector = selectedSector === "ALL" ? undefined : selectedSector;

      const res = await searchSemanticMemory({
        query: searchQuery.trim(),
        entity_types: entityTypes,
        sector,
        min_similarity: minSimilarity,
        limit: 12,
        synthesize_insight: true,
      });
      setSearchResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Semantic search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      executeSearch();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[#22396F] bg-[#0D1C42] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#22396F] bg-[#010736]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#010736] border border-[#22396F] flex items-center justify-center text-[#FCF1D0]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Search Market Knowledge
              </h3>
              <p className="text-xs text-slate-300">
                Search across all saved market signals, action items, and findings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleIndexMemory(false)}
              disabled={isIndexing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#010736] hover:bg-[#22396F] border border-[#22396F] transition cursor-pointer disabled:opacity-50"
              title="Sync market knowledge"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#FCF1D0] ${isIndexing ? "animate-spin" : ""}`} />
              <span>{isIndexing ? "Syncing..." : "Sync Knowledge"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#010736] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Controls */}
        <div className="p-5 border-b border-[#22396F] bg-[#0D1C42] space-y-3">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything or search by topic: e.g. 'Battery scaling challenges'..."
              className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-[#010736] border border-[#22396F] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#FCF1D0] transition shadow-inner"
              autoFocus
            />
            <button
              onClick={() => executeSearch()}
              disabled={isSearching || !query.trim()}
              className="absolute right-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#010736] bg-[#FCF1D0] hover:brightness-105 shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Query Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-400 font-medium">Try:</span>
            {PRESET_QUERIES.map((pq, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(pq);
                  executeSearch(pq);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#010736] hover:bg-[#22396F] border border-[#22396F] text-slate-300 hover:text-[#FCF1D0] text-[11px] transition cursor-pointer truncate max-w-[280px]"
              >
                {pq}
              </button>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-[#22396F]/50">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Type:
              </span>
              {[
                { id: "ALL", label: "All" },
                { id: "MARKET_SIGNAL", label: "Signals" },
                { id: "RECOMMENDATION", label: "Actions" },
                { id: "RESEARCH_REPORT", label: "Reports" },
              ].map((ent) => (
                <button
                  key={ent.id}
                  onClick={() => {
                    setSelectedEntity(ent.id);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    selectedEntity === ent.id
                      ? "bg-[#22396F] text-[#FCF1D0] border border-[#22396F]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {ent.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[11px]">Match Strictness: {Math.round(minSimilarity * 100)}%</span>
                <input
                  type="range"
                  min="0.10"
                  max="0.80"
                  step="0.05"
                  value={minSimilarity}
                  onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                  className="w-20 accent-[#FCF1D0] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* AI Grounded Insight Banner */}
          {searchResult?.ai_insight && (
            <div className="p-4 rounded-2xl border border-[#22396F] bg-[#010736] p-4 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#FCF1D0] text-xs font-semibold">
                  <Sparkles className="w-4 h-4 text-[#FCF1D0]" />
                  <span>Key Takeaway</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {searchResult.total_matches} matches found
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {searchResult.ai_insight}
              </p>
              {searchResult.key_drivers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Key Drivers:
                  </span>
                  {searchResult.key_drivers.map((drv, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0]"
                    >
                      {drv}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Matches List */}
          {searchResult && searchResult.matches.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
                <span>Market Results</span>
                <span>Sorted by Best Match</span>
              </div>

              {searchResult.matches.map((item, idx) => {
                const isSignal = item.entity_type === "MARKET_SIGNAL";
                const isRec = item.entity_type === "RECOMMENDATION";

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-[#22396F] bg-[#010736] hover:border-[#FCF1D0]/40 transition space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0D1C42] text-[10px] font-mono text-slate-300">
                          #{idx + 1}
                        </span>

                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0]">
                          {isSignal && <Radio className="w-3 h-3" />}
                          {isRec && <Target className="w-3 h-3" />}
                          {!isSignal && !isRec && <Layers className="w-3 h-3" />}
                          <span>{item.entity_type.replace("_", " ")}</span>
                        </span>

                        {item.sector && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-[#0D1C42] border border-[#22396F] text-slate-300">
                            {item.sector}
                          </span>
                        )}
                      </div>

                      {/* Relevance Score Badge */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#22396F] text-[#FCF1D0]">
                          <Zap className="w-3 h-3" />
                          <span>{item.match_percentage}% match</span>
                        </div>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-white group-hover:text-[#FCF1D0] transition">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {item.content_text}
                    </p>

                    {/* Timestamp */}
                    <div className="flex items-center justify-end pt-2 text-[11px] text-slate-400 font-mono border-t border-[#22396F]/40">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchResult && !isSearching ? (
            <div className="py-12 text-center space-y-3">
              <Database className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-300">
                No results matched &quot;{query}&quot; with match &ge; {Math.round(minSimilarity * 100)}%.
              </p>
              <button
                onClick={() => setMinSimilarity(0.10)}
                className="text-xs text-[#FCF1D0] hover:underline cursor-pointer"
              >
                Lower match strictness to 10%
              </button>
            </div>
          ) : !searchResult && !isSearching ? (
            <div className="py-12 text-center space-y-4 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-[#010736] border border-[#22396F] flex items-center justify-center mx-auto text-[#FCF1D0]">
                <Brain className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Market Knowledge Search
                </h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Type any market concept, competitor name, or question above to search across all verified findings and recommendations.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
