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
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Failed to load dashboard data.");
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Stage 3 · Real-Data Visualizations & Competitive Moats</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Market Intelligence Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Grounded visual intelligence. Strictly separating empirical citations from inferred model projections
            with zero fabricated charts.
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
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
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
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs text-slate-400">Synthesizing visual intelligence metrics...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!activeJob && !isLoading && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
          <Compass className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No Active Inquiry Selected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select or launch a market research inquiry to populate the visual intelligence dashboard.
          </p>
          <button
            onClick={onNewInquiry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition cursor-pointer"
          >
            <span>Launch Research Inquiry</span>
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
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Grounded Confidence
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-cyan-300">
                  {Math.round(dashboard.overall_confidence * 100)}%
                </span>
                <span className="text-xs text-emerald-400 font-medium">Multi-Vector Verified</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Calibrated across 4 independent research dimensions
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Empirical Facts
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-400">
                  {dashboard.empirical_facts_count}
                </span>
                <span className="text-xs text-slate-400">Citations Linked</span>
              </div>
              <p className="text-[11px] text-slate-500">
                100% verified against external web citations
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Model Projections
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-indigo-400">
                  {dashboard.inferred_projections_count}
                </span>
                <span className="text-xs text-slate-400">Synthesized</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clearly isolated from empirical raw data
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Source Diversity
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-violet-400">
                  {dashboard.source_domains.length}
                </span>
                <span className="text-xs text-slate-400">Unique Domains</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {dashboard.total_citations} external citations deduplicated
              </p>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              ROW 1: MOAT MATRIX & 4-VECTOR RADAR
          ══════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual 1: Competitive Moat Matrix */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    Competitive Moat Matrix (2D Positioning)
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                  VECTOR 2 GROUNDED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scatter analysis of key entities plotting <strong>Technological Moat (X)</strong> against{" "}
                <strong>Pricing Power (Y)</strong>. Hover over nodes to inspect details.
              </p>

              {/* Responsive SVG Scatter Plot */}
              <div className="relative w-full h-80 rounded-xl bg-slate-900/90 border border-slate-800/80 p-4 overflow-hidden">
                <svg viewBox="0 0 400 300" className="w-full h-full">
                  {/* Grid Lines */}
                  <line x1="200" y1="20" x2="200" y2="280" stroke="rgba(51, 65, 85, 0.4)" strokeDasharray="4 4" />
                  <line x1="20" y1="150" x2="380" y2="150" stroke="rgba(51, 65, 85, 0.4)" strokeDasharray="4 4" />

                  {/* Quadrant Labels */}
                  <text x="35" y="45" fill="rgba(148, 163, 184, 0.5)" fontSize="10" fontFamily="sans-serif">
                    Price Leaders
                  </text>
                  <text x="260" y="45" fill="rgba(34, 211, 238, 0.7)" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    Market Dominators
                  </text>
                  <text x="35" y="270" fill="rgba(148, 163, 184, 0.4)" fontSize="10" fontFamily="sans-serif">
                    Challengers
                  </text>
                  <text x="260" y="270" fill="rgba(167, 139, 250, 0.7)" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                    Niche Innovators
                  </text>

                  {/* Axis Labels */}
                  <text x="200" y="295" textAnchor="middle" fill="rgba(148, 163, 184, 0.7)" fontSize="10">
                    Technological Moat →
                  </text>
                  <text x="12" y="150" textAnchor="middle" transform="rotate(-90 12 150)" fill="rgba(148, 163, 184, 0.7)" fontSize="10">
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
                          fill={idx === 0 ? "rgba(34, 211, 238, 0.2)" : "rgba(129, 140, 248, 0.2)"}
                          className="animate-pulse"
                        />
                        {/* Core circle */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 8 : 6}
                          fill={idx === 0 ? "#22d3ee" : idx === 1 ? "#a78bfa" : idx === 2 ? "#fbbf24" : "#94a3b8"}
                          stroke="#0f172a"
                          strokeWidth="2"
                        />
                        {/* Entity label */}
                        <text
                          x={cx + 10}
                          y={cy + 4}
                          fill={isHovered ? "#f8fafc" : "#cbd5e1"}
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
                  <div className="absolute bottom-3 left-3 right-3 p-3 rounded-lg bg-slate-950/95 border border-cyan-500/40 shadow-xl backdrop-blur-md animate-fade-in text-xs flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-100">{hoveredPoint.name}</strong>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                          {hoveredPoint.quadrant}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">{hoveredPoint.summary}</p>
                    </div>
                    <div className="text-right flex-shrink-0 font-mono text-[11px] text-slate-400">
                      <div>Tech Moat: <span className="text-cyan-400 font-bold">{hoveredPoint.technological_moat}%</span></div>
                      <div>Pricing: <span className="text-indigo-400 font-bold">{hoveredPoint.pricing_power}%</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Visual 2: 4-Vector Risk & Confidence Radar */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    4-Vector Risk & Confidence Matrix
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/80 border border-violet-500/30 text-violet-400">
                  MULTI-DIMENSION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Evaluation across Macro Headwinds, Competitive Durability, Customer Pricing, and Regulatory Friction.
              </p>

              {/* Vector Cards List */}
              <div className="space-y-3 pt-1">
                {dashboard.vector_scores.map((vs) => (
                  <div
                    key={vs.vector_key}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">{vs.label}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                            vs.risk_level === "HIGH"
                              ? "bg-red-950/80 text-red-400 border border-red-500/30"
                              : vs.risk_level === "MEDIUM"
                              ? "bg-amber-950/80 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {vs.risk_level} RISK
                        </span>
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          {Math.round(vs.confidence * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Confidence Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                        style={{ width: `${vs.confidence * 100}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed truncate">
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
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    Grounded Findings Classification (Empirical vs. Inferred)
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Anti-hallucination guardrail: Every finding is labeled as an <strong>Empirical Verified Fact</strong> (backed by citation) or an <strong>Inferred Model Projection</strong>.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setClaimFilter("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    claimFilter === "ALL"
                      ? "bg-slate-800 text-slate-100 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({dashboard.claims_breakdown.length})
                </button>
                <button
                  onClick={() => setClaimFilter("EMPIRICAL")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    claimFilter === "EMPIRICAL"
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Verified Facts ({dashboard.empirical_facts_count})
                </button>
                <button
                  onClick={() => setClaimFilter("INFERRED")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                    claimFilter === "INFERRED"
                      ? "bg-indigo-950/80 text-indigo-300 border border-indigo-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Model Projections ({dashboard.inferred_projections_count})
                </button>
              </div>
            </div>

            {/* Claims Table / Cards */}
            <div className="space-y-2.5 pt-2">
              {filteredClaims.map((claim, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {claim.is_empirical ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Verified Fact
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
                          <Cpu className="w-3 h-3 text-indigo-400" />
                          Model Projection
                        </span>
                      )}
                      <span className="text-[10px] font-mono uppercase text-slate-500">
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
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex-shrink-0"
                    >
                      <span>View Citation</span>
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
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  External Evidence & Source Provenance Distribution
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total Citations: {dashboard.total_citations}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {dashboard.source_domains.map((sd, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200 truncate">{sd.domain}</span>
                    <span className="font-mono text-cyan-400 font-bold">{sd.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${sd.percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
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
