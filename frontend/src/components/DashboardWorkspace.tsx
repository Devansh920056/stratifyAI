"use client";

import React, { useEffect, useState } from "react";
import { getJobDashboard, listRecentJobs } from "@/lib/api";
import {
  ClaimClassification,
  JobDashboardResponse,
  JobDetailResponse,
  MoatCompetitorPoint,
  VectorScoreItem,
} from "@/types/api";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  Cpu,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  Layers,
  Loader2,
  PieChart,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

interface DashboardWorkspaceProps {
  activeJob: JobDetailResponse | null;
  onSelectJob: (job: JobDetailResponse) => void;
  onNewInquiry: () => void;
}

export function DashboardWorkspace({
  activeJob,
  onSelectJob,
  onNewInquiry,
}: DashboardWorkspaceProps) {
  const [dashboard, setDashboard] = useState<JobDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobDetailResponse[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<MoatCompetitorPoint | null>(null);
  const [claimFilter, setClaimFilter] = useState<"ALL" | "EMPIRICAL" | "INFERRED">("ALL");

  // Load recent inquiries if none active
  useEffect(() => {
    let mounted = true;
    const loadPast = async () => {
      try {
        const jobs = await listRecentJobs(10);
        if (mounted) {
          setRecentJobs(jobs);
          if (!activeJob && jobs.length > 0) {
            onSelectJob(jobs[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load recent jobs", e);
      }
    };
    loadPast();
    return () => {
      mounted = false;
    };
  }, [activeJob, onSelectJob]);

  // Load dashboard data for active job
  useEffect(() => {
    if (!activeJob) return;
    let mounted = true;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getJobDashboard(activeJob.id);
        if (mounted) {
          setDashboard(data);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, [activeJob]);

  const filteredClaims = dashboard?.claims_breakdown.filter((c) => {
    if (claimFilter === "EMPIRICAL") return c.is_empirical;
    if (claimFilter === "INFERRED") return !c.is_empirical;
    return true;
  }) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── Top Control Bar ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#22396F]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Market Insights & Overview
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Clear visual charts and competitor comparisons based on real verified source data.
          </p>
        </div>

        {/* Inquiry Switcher */}
        {recentJobs.length > 0 && (
          <div className="flex items-center gap-3">
            <select
              value={activeJob?.id || ""}
              onChange={(e) => {
                const found = recentJobs.find((j) => j.id === e.target.value);
                if (found) onSelectJob(found);
              }}
              className="bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0] text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#FCF1D0] cursor-pointer"
            >
              {recentJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.target_market} — {j.research_question.slice(0, 35)}...
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="bg-[#0D1C42] p-12 rounded-2xl border border-[#22396F] flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#FCF1D0] animate-spin" />
          <p className="text-xs text-slate-300">Loading market charts and metrics...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!activeJob && !isLoading && (
        <div className="bg-[#0D1C42] p-12 rounded-2xl border border-[#22396F] text-center space-y-4">
          <Compass className="w-12 h-12 text-[#FCF1D0]/60 mx-auto" />
          <h3 className="text-base font-semibold text-white">No Research Selected</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            Start a new research question to view market charts and competitor insights.
          </p>
          <button
            onClick={onNewInquiry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#010736] bg-[#FCF1D0] hover:brightness-105 transition cursor-pointer"
          >
            <span>Start Research</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {dashboard && !isLoading && (
        <div className="space-y-8">
          {/* ══════════════════════════════════════════════════
              KPI SUMMARY METRICS
          ══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Confidence Score
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#FCF1D0]">
                  {Math.round(dashboard.overall_confidence * 100)}%
                </span>
                <span className="text-xs text-emerald-400 font-medium">Verified</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Overall confidence across all research topics
              </p>
            </div>

            <div className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Verified Facts
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">
                  {dashboard.empirical_facts_count}
                </span>
                <span className="text-xs text-slate-400">Linked</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Backed by real external sources
              </p>
            </div>

            <div className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Trends & Forecasts
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#FCF1D0]">
                  {dashboard.inferred_projections_count}
                </span>
                <span className="text-xs text-slate-400">Analyzed</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Strategic projections and forward outlook
              </p>
            </div>

            <div className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Sources Analyzed
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#FCF1D0]">
                  {dashboard.source_domains.length}
                </span>
                <span className="text-xs text-slate-400">Web Domains</span>
              </div>
              <p className="text-[11px] text-slate-400">
                {dashboard.total_citations} individual citations referenced
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              ROW 1: MOAT MATRIX & 4-VECTOR RADAR
          ══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual 1: Competitive Moat Matrix */}
            <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#FCF1D0]" />
                  <h3 className="text-sm font-semibold text-white">
                    Competitor Market Map
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
                  Competitor Matrix
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Compares key companies on <strong>Product Strength (X)</strong> against{" "}
                <strong>Pricing Power (Y)</strong>. Hover over any company to see details.
              </p>

              {/* Responsive SVG Scatter Plot */}
              <div className="relative w-full h-80 rounded-xl bg-[#010736] border border-[#22396F] p-4 overflow-hidden">
                <svg viewBox="0 0 400 300" className="w-full h-full">
                  {/* Grid Lines */}
                  <line x1="200" y1="20" x2="200" y2="280" stroke="#22396F" strokeDasharray="4 4" />
                  <line x1="20" y1="150" x2="380" y2="150" stroke="#22396F" strokeDasharray="4 4" />

                  {/* Quadrant Labels */}
                  <text x="35" y="45" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">
                    Price Leaders
                  </text>
                  <text x="260" y="45" fill="#FCF1D0" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    Market Dominators
                  </text>
                  <text x="35" y="270" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                    Challengers
                  </text>
                  <text x="260" y="270" fill="#FCF1D0" opacity="0.8" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    Specialized Leaders
                  </text>

                  {/* Axis Labels */}
                  <text x="200" y="295" textAnchor="middle" fill="#94a3b8" fontSize="10">
                    Product Strength →
                  </text>
                  <text x="12" y="150" textAnchor="middle" transform="rotate(-90 12 150)" fill="#94a3b8" fontSize="10">
                    Pricing Power →
                  </text>

                  {/* Plotted Points */}
                  {dashboard.moat_matrix.map((pt, idx) => {
                    // Coordinate transform (0-100 to svg 30-370 X, 270-30 Y)
                    const cx = 30 + (pt.technological_moat / 100) * 340;
                    const cy = 270 - (pt.pricing_power / 100) * 240;
                    const isHovered = hoveredPoint?.name === pt.name;

                    return (
                      <g
                        key={idx}
                        className="cursor-pointer transition-all duration-300"
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {/* Glow ring */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 16 : 10}
                          fill={idx === 0 ? "rgba(252, 241, 208, 0.25)" : "rgba(34, 57, 111, 0.4)"}
                          className="animate-pulse"
                        />
                        {/* Core circle */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 8 : 6}
                          fill={idx === 0 ? "#FCF1D0" : idx === 1 ? "#cbd5e1" : "#94a3b8"}
                          stroke="#010736"
                          strokeWidth="2"
                        />
                        {/* Entity label */}
                        <text
                          x={cx + 10}
                          y={cy + 4}
                          fill={isHovered ? "#FCF1D0" : "#cbd5e1"}
                          fontSize="9"
                          fontWeight={isHovered ? "bold" : "normal"}
                        >
                          {pt.name.split(" ")[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip Overlay */}
                {hoveredPoint && (
                  <div className="absolute bottom-3 left-3 right-3 p-3 rounded-lg bg-[#0D1C42] border border-[#22396F] shadow-xl backdrop-blur-md animate-fade-in text-xs flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-white">{hoveredPoint.name}</strong>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#010736] text-[#FCF1D0] border border-[#22396F]">
                          {hoveredPoint.quadrant}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">{hoveredPoint.summary}</p>
                    </div>
                    <div className="text-right flex-shrink-0 font-mono text-[11px] text-slate-400">
                      <div>Product: <span className="text-[#FCF1D0] font-bold">{hoveredPoint.technological_moat}%</span></div>
                      <div>Pricing: <span className="text-slate-200 font-bold">{hoveredPoint.pricing_power}%</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visual 2: Key Market Drivers */}
            <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#FCF1D0]" />
                  <h3 className="text-sm font-semibold text-white">
                    Key Market Drivers
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
                  Summary
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Risk and confidence assessment across market size, competitors, customer demand, and regulations.
              </p>

              {/* Vector Cards List */}
              <div className="space-y-3 pt-1">
                {dashboard.vector_scores.map((vs) => (
                  <div
                    key={vs.vector_key}
                    className="p-3.5 rounded-xl bg-[#010736] border border-[#22396F] space-y-2 hover:border-[#FCF1D0]/40 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{vs.label}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                            vs.risk_level === "HIGH"
                              ? "bg-red-950/80 text-red-400 border border-red-500/30"
                              : vs.risk_level === "MEDIUM"
                              ? "bg-amber-950/80 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {vs.risk_level} RISK
                        </span>
                        <span className="text-xs font-mono font-bold text-[#FCF1D0]">
                          {Math.round(vs.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Confidence Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#0D1C42] overflow-hidden border border-[#22396F]/50">
                      <div
                        className="h-full rounded-full bg-[#FCF1D0]"
                        style={{ width: `${vs.confidence * 100}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed truncate">
                      {vs.summary_snippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              ROW 2: EMPIRICAL VS INFERRED CLAIMS INSPECTOR
          ══════════════════════════════════════════════════ */}
          <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Facts & Key Findings
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  Every finding is checked against real sources so you know what is verified.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-[#010736] p-1 rounded-xl border border-[#22396F]">
                <button
                  onClick={() => setClaimFilter("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    claimFilter === "ALL"
                      ? "bg-[#22396F] text-[#FCF1D0]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  All ({dashboard.claims_breakdown.length})
                </button>
                <button
                  onClick={() => setClaimFilter("EMPIRICAL")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    claimFilter === "EMPIRICAL"
                      ? "bg-[#22396F] text-emerald-300"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Verified Facts ({dashboard.empirical_facts_count})
                </button>
                <button
                  onClick={() => setClaimFilter("INFERRED")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    claimFilter === "INFERRED"
                      ? "bg-[#22396F] text-[#FCF1D0]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Forecasts ({dashboard.inferred_projections_count})
                </button>
              </div>
            </div>

            {/* Claims Table / Cards */}
            <div className="space-y-2.5 pt-2">
              {filteredClaims.map((claim, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#010736] border border-[#22396F] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#FCF1D0]/30 transition"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {claim.is_empirical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Verified Fact
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0]">
                          <Cpu className="w-3 h-3 text-[#FCF1D0]" />
                          Forecast
                        </span>
                      )}
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        {claim.vector_type.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{claim.claim}</p>
                  </div>

                  {claim.source_url && (
                    <a
                      href={claim.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#FCF1D0] hover:underline flex-shrink-0"
                    >
                      <span>View Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              ROW 3: SOURCE DOMAIN DISTRIBUTION
          ══════════════════════════════════════════════════ */}
          <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FCF1D0]" />
                <h3 className="text-sm font-semibold text-white">
                  Sources & Citations
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total Sources: {dashboard.total_citations}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {dashboard.source_domains.map((sd, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-[#010736] border border-[#22396F] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 truncate">{sd.domain}</span>
                    <span className="font-mono text-[#FCF1D0] font-bold">{sd.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#0D1C42] overflow-hidden border border-[#22396F]/50">
                    <div
                      className="h-full rounded-full bg-[#FCF1D0]"
                      style={{ width: `${sd.percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {sd.count} verified citation{sd.count > 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
