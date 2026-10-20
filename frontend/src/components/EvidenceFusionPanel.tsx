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
  { name: "Tesla", ticker: "TSLA", sector: "Climate Tech" },
  { name: "CrowdStrike", ticker: "CRWD", sector: "Cybersecurity" },
  { name: "Rivian", ticker: "RIVN", sector: "Autonomous Mobility" },
  { name: "QuantumScape", ticker: "QS", sector: "Battery Tech" },
  { name: "Microsoft", ticker: "MSFT", sector: "Developer Productivity" },
  { name: "NVIDIA", ticker: "NVDA", sector: "AI Hardware" },
];

export function EvidenceFusionPanel() {
  const [targetEntity, setTargetEntity] = useState("Tesla");
  const [topicFocus, setTopicFocus] = useState("");
  const [selectedSourceType, setSelectedSourceType] = useState("ALL");
  const [selectedDivergence, setSelectedDivergence] = useState("ALL");
  const [fusedItems, setFusedItems] = useState<FusedEvidenceItem[]>([]);
  const [summary, setSummary] = useState<EvidenceReconciliationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFusing, setIsFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleQueryAndFuse("Tesla");
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
      setError(err instanceof Error ? err.message : "Evidence fusion failed.");
    } finally {
      setIsFusing(false);
    }
  }

  // Filter items in-memory based on selected pills
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-500 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Scale className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Multi-Source Evidence Fusion & Claim Reconciliation
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                SEC EDGAR + arXiv
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cross-references commercial marketing statements with mandatory Form 10-K/10-Q risk factors to expose claim contradictions
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
              placeholder="Company or deep tech topic e.g. Tesla..."
              className="w-48 sm:w-60 px-3.5 py-2 rounded-xl text-xs bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <button
            onClick={() => handleQueryAndFuse(targetEntity)}
            disabled={isFusing || !targetEntity.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition cursor-pointer"
          >
            {isFusing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reconciling...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fuse Sources</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Suggested Enterprise Targets */}
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
        <span className="text-[11px] font-medium text-slate-500">Quick Targets:</span>
        {SUGGESTED_TARGETS.map((t) => (
          <button
            key={t.ticker}
            onClick={() => {
              setTargetEntity(t.name);
              handleQueryAndFuse(t.name);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
              targetEntity.toLowerCase() === t.name.toLowerCase()
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/10"
                : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
            }`}
          >
            <span>{t.name}</span>
            <span className="px-1 py-0.2 rounded text-[10px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800">
              {t.ticker}
            </span>
          </button>
        ))}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Executive Reconciliation Summary Card */}
      {summary && (
        <div className="p-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-950 to-indigo-950/20 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl border ${
                  contradictionCount > 0
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                    : divergenceCount > 0
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                    : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                }`}
              >
                {contradictionCount > 0 ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Evidence Reliability & Claim Reconciliation: {summary.entity_name}
                </h3>
                <p className="text-xs text-slate-400">
                  Evidence Reliability Index:{" "}
                  <span className="font-mono font-bold text-cyan-400">
                    {Math.round(summary.evidence_reliability_index * 100)}% ERI
                  </span>{" "}
                  · Statutory & Academic Rigor Weighting
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {summary.total_fused_sources} Sources Verified
              </span>
            </div>
          </div>

          {/* 4-Stat Metric Counter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <p className="text-[11px] text-slate-400 font-medium">SEC EDGAR Disclosures</p>
              <p className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                {summary.sec_filings_count}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <p className="text-[11px] text-slate-400 font-medium">arXiv Preprints</p>
              <p className="text-lg font-bold font-mono text-violet-400 mt-0.5">
                {summary.arxiv_preprints_count}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Divergent Statements</p>
              <p className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                {summary.divergent_claims_count}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Direct Contradictions</p>
              <p
                className={`text-lg font-bold font-mono mt-0.5 ${
                  summary.contradictory_claims_count > 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {summary.contradictory_claims_count}
              </p>
            </div>
          </div>

          {/* Analytical Takeaway Callout */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              contradictionCount > 0
                ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                : divergenceCount > 0
                ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                : "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
            }`}
          >
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Strategic Takeaway & Regulatory Reality Check:
            </p>
            <p>{summary.reconciliation_takeaway}</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Source Type:
          </span>
          {[
            { id: "ALL", label: "All Sources" },
            { id: "SEC_EDGAR", label: "SEC EDGAR (10-K/10-Q)" },
            { id: "ARXIV_PREPRINT", label: "arXiv Preprints" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedSourceType(st.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                selectedSourceType === st.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Reconciliation:</span>
          {[
            { id: "ALL", label: "All" },
            { id: "CONTRADICTORY", label: "Contradictory" },
            { id: "DIVERGENT", label: "Divergent" },
            { id: "ALIGNED", label: "Aligned" },
          ].map((div) => (
            <button
              key={div.id}
              onClick={() => setSelectedDivergence(div.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                selectedDivergence === div.id
                  ? "bg-slate-800 text-white border border-slate-600"
                  : "text-slate-400 hover:text-slate-300"
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
                className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 transition space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                        isSEC
                          ? "bg-emerald-950/70 border border-emerald-500/40 text-emerald-400"
                          : "bg-violet-950/70 border border-violet-500/40 text-violet-400"
                      }`}
                    >
                      {isSEC ? (
                        <Building2 className="w-3.5 h-3.5" />
                      ) : (
                        <GraduationCap className="w-3.5 h-3.5" />
                      )}
                      <span>{item.source_type.replace("_", " ")}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {item.filing_type}
                    </span>

                    {item.fiscal_period && (
                      <span className="px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-950 border border-slate-800">
                        {item.fiscal_period}
                      </span>
                    )}
                  </div>

                  {/* Status & ERI */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                        isContradictory
                          ? "bg-rose-950/80 border border-rose-500/40 text-rose-400"
                          : isDivergent
                          ? "bg-amber-950/80 border border-amber-500/40 text-amber-400"
                          : "bg-emerald-950/80 border border-emerald-500/40 text-emerald-400"
                      }`}
                    >
                      {item.divergence_status}
                    </span>

                    <span className="px-2 py-0.5 rounded text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30">
                      {Math.round(item.reliability_score * 100)}% ERI
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-base font-semibold text-white leading-snug">
                  {item.title}
                </h4>

                {/* Excerpt Box */}
                <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/80 text-xs text-slate-300 leading-relaxed font-sans">
                  {item.content_excerpt}
                </div>

                {/* Reconciliation Note Callout if divergent or contradictory */}
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
                        Claim Divergence Audit:
                      </span>
                      <span>{item.reconciliation_notes}</span>
                    </div>
                  </div>
                )}

                {/* Metadata & Direct URL */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 border-t border-slate-800/60">
                  <div className="flex items-center gap-3">
                    {item.metadata.accession_number && (
                      <span className="font-mono text-[11px]">
                        Accession: {item.metadata.accession_number}
                      </span>
                    )}
                    {item.metadata.authors && Array.isArray(item.metadata.authors) && (
                      <span className="text-[11px]">
                        Authors: {item.metadata.authors.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>

                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition"
                  >
                    <span>View Primary Source Filing</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/30 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">
            No secondary evidence items match the selected filter criteria.
          </p>
          <button
            onClick={() => {
              setSelectedSourceType("ALL");
              setSelectedDivergence("ALL");
            }}
            className="text-xs text-cyan-400 hover:underline cursor-pointer"
          >
            Reset filter view
          </button>
        </div>
      )}
    </div>
  );
}
