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
  "Solid-state battery cathode breakthrough and energy density",
  "Post-quantum cryptography cybersecurity risk",
  "Autonomous vehicle regulatory safety standards",
  "AI developer productivity tooling and code generation",
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-cyan-950/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Brain className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Semantic Intelligence & Vector Memory
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  {stats ? `${stats.dimensions}-DIM PGVECTOR` : "128-DIM"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grounded vector search across real market signals, strategic recommendations, and findings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleIndexMemory(false)}
              disabled={isIndexing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Sync Vector Memory from PostgreSQL tables"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isIndexing ? "animate-spin" : ""}`} />
              <span>{isIndexing ? "Syncing..." : "Sync Memory"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Controls */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-900/60 space-y-3">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything or search by concept: e.g. 'Solid-state battery scaling bottlenecks'..."
              className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition shadow-inner"
              autoFocus
            />
            <button
              onClick={() => executeSearch()}
              disabled={isSearching || !query.trim()}
              className="absolute right-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
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
            <span className="text-[11px] text-slate-500 font-medium">Try:</span>
            {PRESET_QUERIES.map((pq, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(pq);
                  executeSearch(pq);
                }}
                className="px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-cyan-300 text-[11px] transition cursor-pointer truncate max-w-[280px]"
              >
                {pq}
              </button>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-slate-800/60">
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
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    selectedEntity === ent.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {ent.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[11px]">Min Similarity: {Math.round(minSimilarity * 100)}%</span>
                <input
                  type="range"
                  min="0.10"
                  max="0.80"
                  step="0.05"
                  value={minSimilarity}
                  onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                  className="w-20 accent-cyan-500 cursor-pointer"
                />
              </div>

              {stats && (
                <span className="text-[11px] font-mono text-slate-500">
                  {stats.total_embeddings} vectors indexed
                </span>
              )}
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
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900 p-4 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Synthesized AI Intelligence Takeaway</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {searchResult.latency_ms}ms · {searchResult.total_matches} vectors matched
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
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-950/80 border border-cyan-500/30 text-cyan-300"
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
                <span>Ranked Semantic Vector Matches</span>
                <span>Sorted by Cosine Similarity</span>
              </div>

              {searchResult.matches.map((item, idx) => {
                const isHighMatch = item.similarity_score >= 0.65;
                const isSignal = item.entity_type === "MARKET_SIGNAL";
                const isRec = item.entity_type === "RECOMMENDATION";

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-950/90 hover:border-slate-700 transition space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300">
                          #{idx + 1}
                        </span>

                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isSignal
                              ? "bg-amber-950/60 border border-amber-500/30 text-amber-400"
                              : isRec
                              ? "bg-violet-950/60 border border-violet-500/30 text-violet-400"
                              : "bg-cyan-950/60 border border-cyan-500/30 text-cyan-400"
                          }`}
                        >
                          {isSignal && <Radio className="w-3 h-3" />}
                          {isRec && <Target className="w-3 h-3" />}
                          {!isSignal && !isRec && <Layers className="w-3 h-3" />}
                          <span>{item.entity_type.replace("_", " ")}</span>
                        </span>

                        {item.sector && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800/80 border border-slate-700 text-slate-300">
                            {item.sector}
                          </span>
                        )}
                      </div>

                      {/* Relevance Score Badge */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            isHighMatch
                              ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-400"
                              : "bg-cyan-950/80 border border-cyan-500/30 text-cyan-400"
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>{item.match_percentage}% match</span>
                        </div>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">
                      {item.title}
                    </h4>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {item.content_text}
                    </p>

                    {/* Metadata Footer */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/60">
                      {item.metadata.source_domain && (
                        <span className="flex items-center gap-1">
                          <Compass className="w-3 h-3 text-slate-500" />
                          <span>{item.metadata.source_domain}</span>
                        </span>
                      )}
                      {item.metadata.priority_score !== undefined && (
                        <span className="flex items-center gap-1 text-cyan-400">
                          <Target className="w-3 h-3" />
                          <span>Priority: {item.metadata.priority_score}</span>
                        </span>
                      )}
                      {item.metadata.sentiment_score !== undefined && (
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-slate-500" />
                          <span>Sentiment: {item.metadata.sentiment_score > 0 ? `+${item.metadata.sentiment_score}` : item.metadata.sentiment_score}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto text-slate-500 font-mono text-[10px]">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : searchResult && !isSearching ? (
            <div className="py-12 text-center space-y-3">
              <Database className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">
                No vector embeddings matched &quot;{query}&quot; with similarity &ge; {Math.round(minSimilarity * 100)}%.
              </p>
              <button
                onClick={() => setMinSimilarity(0.10)}
                className="text-xs text-cyan-400 hover:underline cursor-pointer"
              >
                Lower similarity threshold to 10%
              </button>
            </div>
          ) : !searchResult && !isSearching ? (
            <div className="py-12 text-center space-y-4 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                <Brain className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">
                  Semantic Cross-Inquiry Knowledge Base
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Type a concept or research question above. The vector engine searches across all market signals, strategic recommendations, and findings using dense vector embeddings.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
