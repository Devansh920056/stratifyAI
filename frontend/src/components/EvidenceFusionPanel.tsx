"use client";

import React, { useEffect, useState } from "react";
import {
  fetchFusedEvidence,
  queryAndFuseEvidence,
} from "@/lib/api";
import {
  EvidenceReconciliationSummary,
  FusedEvidenceItem,
  FusedEvidenceListResponse,
} from "@/types/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

const SUGGESTED_TARGETS = [
  { name: "Tata Motors", ticker: "TATAMOTORS.NS", sector: "EV & Commercial Vehicles" },
  { name: "Reliance Industries", ticker: "RELIANCE.NS", sector: "Retail & Green Energy" },
  { name: "Infosys", ticker: "INFY.NS", sector: "Enterprise IT & AI Services" },
  { name: "HDFC Bank", ticker: "HDFCBANK.NS", sector: "Banking & Financial Services" },
  { name: "Zomato / Blinkit", ticker: "ZOMATO.NS", sector: "Quick Commerce & Delivery" },
  { name: "Larsen & Toubro", ticker: "LT.NS", sector: "Infrastructure & Defense" },
];

export function EvidenceFusionPanel() {
  const [targetEntity, setTargetEntity] = useState("Tata Motors");
  const [topicFocus, setTopicFocus] = useState("");
  const [selectedSourceType, setSelectedSourceType] = useState("ALL");
  const [selectedDivergence, setSelectedDivergence] = useState("ALL");
  const [fusedItems, setFusedItems] = useState<FusedEvidenceItem[]>([]);
  const [summary, setSummary] = useState<EvidenceReconciliationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFusing, setIsFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleQueryAndFuse("Tata Motors");
  }, []);

  async function handleQueryAndFuse(entity = targetEntity, topic = topicFocus) {
    if (!entity.trim()) return;
    setIsFusing(true);
    setError(null);
    try {
      const res = await queryAndFuseEvidence({
        entity_name: entity.trim(),
        topic: topic.trim() || undefined,
        include_sec: true,
        include_arxiv: true,
        reconcile: true,
      });
      setFusedItems(res.items);
      setSummary(res.summary || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Evidence check failed.");
    } finally {
      setIsFusing(false);
    }
  }

  const filteredItems = fusedItems.filter((item) => {
    if (selectedSourceType !== "ALL" && item.source_type !== selectedSourceType) {
      return false;
    }
    if (selectedDivergence !== "ALL" && item.divergence_status !== selectedDivergence) {
      return false;
    }
    return true;
  });

  const contradictionCount = fusedItems.filter(
    (i) => i.divergence_status === "CONTRADICTORY"
  ).length;
  const divergenceCount = fusedItems.filter(
    (i) => i.divergence_status === "DIVERGENT"
  ).length;
  const alignedCount = fusedItems.filter(
    (i) => i.divergence_status === "ALIGNED"
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#010736] border border-[#22396F] flex items-center justify-center">
            <Scale className="w-5 h-5 text-[#FCF1D0]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#FCF1D0] tracking-tight">
                Source Verification & Fact Check
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Cross-references claims with official regulatory filings and research papers.
            </p>
          </div>
        </div>

        {/* Search & Trigger Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              value={targetEntity}
              onChange={(e) => setTargetEntity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQueryAndFuse(targetEntity)}
              placeholder="Company or topic..."
              className="w-48 sm:w-60 px-3.5 py-2 rounded-xl text-xs bg-[#010736] border border-[#22396F] text-white placeholder-slate-400 focus:outline-none focus:border-[#FCF1D0] transition"
            />
          </div>

          <button
            onClick={() => handleQueryAndFuse(targetEntity)}
            disabled={isFusing || !targetEntity.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-sm disabled:opacity-50 transition cursor-pointer"
          >
            {isFusing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#010736]" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#010736]" />
                <span>Verify Sources</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggested Targets */}
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
        <span className="text-[11px] font-medium text-slate-400">Examples:</span>
        {SUGGESTED_TARGETS.map((t) => (
          <button
            key={t.ticker}
            onClick={() => {
              setTargetEntity(t.name);
              handleQueryAndFuse(t.name);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
              targetEntity.toLowerCase() === t.name.toLowerCase()
                ? "bg-[#22396F] text-[#FCF1D0] border-[#FCF1D0]"
                : "bg-[#0D1C42] text-slate-300 border-[#22396F] hover:text-white"
            }`}
          >
            <span>{t.name}</span>
            <span className="px-1 py-0.2 rounded text-[10px] font-mono text-slate-400 bg-[#010736]">
              {t.ticker}
            </span>
          </button>
        ))}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Summary Card */}
      {summary && (
        <div className="p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#22396F] pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl border ${
                  contradictionCount > 0
                    ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                    : divergenceCount > 0
                    ? "bg-amber-950/60 border-amber-500/40 text-amber-300"
                    : "bg-[#010736] border-[#22396F] text-[#FCF1D0]"
                }`}
              >
                {contradictionCount > 0 ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#FCF1D0]" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Fact Check Summary: {summary.entity_name}
                </h3>
                <p className="text-xs text-slate-300">
                  Reliability Score:{" "}
                  <span className="font-mono font-bold text-[#FCF1D0]">
                    {Math.round(summary.evidence_reliability_index * 100)}% Verified
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#010736] text-[#FCF1D0] border border-[#22396F]">
                {summary.total_fused_sources} Sources Verified
              </span>
            </div>
          </div>

          {/* Metric Counter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-[#22396F] bg-[#010736] text-center">
              <p className="text-[11px] text-slate-400 font-medium">Official Filings</p>
              <p className="text-lg font-bold font-mono text-[#FCF1D0] mt-0.5">
                {summary.sec_filings_count}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#22396F] bg-[#010736] text-center">
              <p className="text-[11px] text-slate-400 font-medium">Research Papers</p>
              <p className="text-lg font-bold font-mono text-[#FCF1D0] mt-0.5">
                {summary.arxiv_preprints_count}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#22396F] bg-[#010736] text-center">
              <p className="text-[11px] text-slate-400 font-medium">Differing Claims</p>
              <p className="text-lg font-bold font-mono text-amber-300 mt-0.5">
                {summary.divergent_claims_count}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#22396F] bg-[#010736] text-center">
              <p className="text-[11px] text-slate-400 font-medium">Contradictions</p>
              <p
                className={`text-lg font-bold font-mono mt-0.5 ${
                  summary.contradictory_claims_count > 0 ? "text-rose-400" : "text-[#FCF1D0]"
                }`}
              >
                {summary.contradictory_claims_count}
              </p>
            </div>
          </div>

          {/* Takeaway Callout */}
          <div className="p-3.5 rounded-xl border border-[#22396F] bg-[#010736] text-xs leading-relaxed text-slate-200">
            <p className="font-semibold mb-1 flex items-center gap-1.5 text-[#FCF1D0]">
              <Sparkles className="w-3.5 h-3.5 text-[#FCF1D0]" />
              Key Finding:
            </p>
            <p>{summary.reconciliation_takeaway}</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl border border-[#22396F] bg-[#0D1C42] text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Source:
          </span>
          {[
            { id: "ALL", label: "All Sources" },
            { id: "SEC_EDGAR", label: "Company Filings" },
            { id: "ARXIV_PREPRINT", label: "Research Papers" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedSourceType(st.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
                selectedSourceType === st.id
                  ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                  : "bg-[#010736] border-[#22396F] text-slate-300 hover:text-white"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Status:</span>
          {[
            { id: "ALL", label: "All" },
            { id: "CONTRADICTORY", label: "Contradictory" },
            { id: "DIVERGENT", label: "Differing" },
            { id: "ALIGNED", label: "Verified" },
          ].map((div) => (
            <button
              key={div.id}
              onClick={() => setSelectedDivergence(div.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer border ${
                selectedDivergence === div.id
                  ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                  : "bg-[#010736] border-[#22396F] text-slate-300 hover:text-white"
              }`}
            >
              {div.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fused Evidence Items Cards */}
      {filteredItems.length > 0 ? (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isSEC = item.source_type === "SEC_EDGAR";
            const isContradictory = item.divergence_status === "CONTRADICTORY";
            const isDivergent = item.divergence_status === "DIVERGENT";

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] hover:border-[#FCF1D0]/40 transition space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
                      {isSEC ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <GraduationCap className="w-3.5 h-3.5" />
                      )}
                      <span>{isSEC ? "Official Filing" : "Research Paper"}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#010736] text-slate-300 border border-[#22396F]">
                      {item.filing_type}
                    </span>

                    {item.fiscal_period && (
                      <span className="px-2 py-0.5 rounded text-xs text-slate-400 bg-[#010736] border border-[#22396F]">
                        {item.fiscal_period}
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                        isContradictory
                          ? "bg-rose-950/80 border border-rose-500/40 text-rose-300"
                          : isDivergent
                          ? "bg-amber-950/80 border border-amber-500/40 text-amber-300"
                          : "bg-[#22396F] text-[#FCF1D0]"
                      }`}
                    >
                      {item.divergence_status === "ALIGNED"
                        ? "VERIFIED"
                        : item.divergence_status === "DIVERGENT"
                        ? "DIFFERING"
                        : "CONTRADICTION"}
                    </span>

                    <span className="px-2 py-0.5 rounded text-xs font-mono text-[#FCF1D0] bg-[#010736] border border-[#22396F]">
                      {Math.round(item.reliability_score * 100)}% Verified
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-base font-semibold text-white leading-snug">
                  {item.title}
                </h4>

                {/* Excerpt Box */}
                <div className="p-3.5 rounded-xl border border-[#22396F] bg-[#010736] text-xs text-slate-300 leading-relaxed font-sans">
                  {item.content_excerpt}
                </div>

                {/* Discrepancy Note */}
                {item.reconciliation_notes && (isContradictory || isDivergent) && (
                  <div
                    className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      isContradictory
                        ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                        : "bg-amber-950/30 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">
                        Discrepancy Note:
                      </span>
                      <span>{item.reconciliation_notes}</span>
                    </div>
                  </div>
                )}

                {/* Source Link */}
                <div className="flex items-center justify-end pt-2 text-xs border-t border-[#22396F]">
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FCF1D0] hover:underline transition"
                  >
                    <span>View Source Document</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-3">
          <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-400">
            No evidence items match the selected filter criteria.
          </p>
          <button
            onClick={() => {
              setSelectedSourceType("ALL");
              setSelectedDivergence("ALL");
            }}
            className="text-xs text-[#FCF1D0] hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
