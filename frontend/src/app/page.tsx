"use client";

import React, { useState } from "react";
import { Header, NavigationTab } from "@/components/Header";
import { ResearchForm } from "@/components/ResearchForm";
import { JobStatusTracker } from "@/components/JobStatusTracker";
import { ReportViewer } from "@/components/ReportViewer";
import { RecentJobs } from "@/components/RecentJobs";
import { JobDetailResponse } from "@/types/api";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  FileCheck,
  FileText,
  Network,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

// ─── View state machine ──────────────────────────────────────
type ViewMode = "form" | "tracker" | "report";

// ─── Platform invariant cards ────────────────────────────────
const INVARIANTS = [
  {
    icon: Network,
    title: "RabbitMQ Broker",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    description:
      "Publisher confirms, durable delivery (mode=2), QoS prefetch, Dead Letter Queue routing with 3× bounded retries.",
  },
  {
    icon: Database,
    title: "Atomic Outbox & OCC",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    description:
      "PostgreSQL 16 with Optimistic Concurrency Control, ACID transaction isolation, and idempotent UNIQUE constraints.",
  },
  {
    icon: Cpu,
    title: "AI Intelligence Synthesis",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    description:
      "Grounded factual extraction with structured JSON synthesis, confidence scoring, and strict anti-hallucination citation guardrails — zero API cost.",
  },
  {
    icon: FileCheck,
    title: "Live Web Evidence",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    description:
      "Real-time web search with UTM stripping, URL canonicalization, and score-based deduplication for zero phantom citations.",
  },
];

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>("research");
  const [activeJob, setActiveJob] = useState<JobDetailResponse | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("form");
  const [isRecentJobsOpen, setIsRecentJobsOpen] = useState(false);

  const handleJobCreated = (job: JobDetailResponse) => {
    setActiveJob(job);
    setCurrentTab("research");
    setViewMode("tracker");
  };

  const handleSelectRecentJob = (job: JobDetailResponse) => {
    setActiveJob(job);
    setCurrentTab("research");
    setViewMode(job.has_report ? "report" : "tracker");
  };

  const handleNewInquiry = () => {
    setActiveJob(null);
    setCurrentTab("research");
    setViewMode("form");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Sticky Header with Navigation Switcher */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onNewInquiryClick={handleNewInquiry}
        onRecentClick={() => setIsRecentJobsOpen(true)}
        activeJobId={activeJob?.id || null}
      />

      {/* ─── Main Content ──────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ════════════════════════════════════════════════════
            PILLAR 1: RESEARCH CORE (Existing Production Flow)
        ════════════════════════════════════════════════════ */}
        {currentTab === "research" && (
          <>
            {/* VIEW 1.1 — Inquiry Form & Platform Hero */}
            {viewMode === "form" && (
              <div className="space-y-14 animate-fade-in">
                {/* Hero */}
                <div className="text-center max-w-3xl mx-auto space-y-5 pt-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Autonomous Market Intelligence Matrix — 4-Vector Research</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-slate-100">
                    Deep Strategic Intelligence,{" "}
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #22d3ee, #818cf8, #a78bfa)",
                      }}
                    >
                      Grounded in Evidence
                    </span>
                  </h1>

                  <p className="text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
                    Stratify AI decomposes high-stakes market questions into 4 concurrent research
                    vectors — macro sizing, competitive moats, customer churn, and regulatory
                    headwinds — backed by verifiable real web sources.
                  </p>

                  {/* Quick stats bar */}
                  <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      69 automated tests passing
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Live real-time web search
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Anti-hallucination guardrails
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Markdown report export
                    </span>
                  </div>
                </div>

                {/* Research Input Form */}
                <ResearchForm onJobCreated={handleJobCreated} />

                {/* Platform Architecture Invariants */}
                <div className="pt-4 border-t border-slate-900">
                  <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500 mb-8">
                    Distributed Systems Guarantees
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {INVARIANTS.map(({ icon: Icon, title, color, bg, description }) => (
                      <div
                        key={title}
                        className="glass-panel p-5 rounded-xl space-y-3 hover:border-slate-700 transition-all duration-200 group"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg ${bg} border flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}
                        >
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 1.2 — Sub-Task Execution Tracker */}
            {viewMode === "tracker" && activeJob && (
              <div className="space-y-6 animate-fade-in">
                <Breadcrumbs
                  items={[
                    { label: "Inquiry", onClick: handleNewInquiry },
                    { label: "Sub-Task Execution", active: true },
                    ...(activeJob.has_report
                      ? [{ label: "Executive Report", onClick: () => setViewMode("report") }]
                      : []),
                  ]}
                />
                <JobStatusTracker
                  jobId={activeJob.id}
                  initialJob={activeJob}
                  onJobUpdate={(updated) => setActiveJob(updated)}
                  onViewReport={() => setViewMode("report")}
                  onNewInquiry={handleNewInquiry}
                />
              </div>
            )}

            {/* VIEW 1.3 — Executive Intelligence Report */}
            {viewMode === "report" && activeJob && (
              <div className="space-y-6 animate-fade-in">
                <Breadcrumbs
                  items={[
                    { label: "Inquiry", onClick: handleNewInquiry },
                    { label: "Sub-Task Execution", onClick: () => setViewMode("tracker") },
                    { label: "Executive Report", active: true },
                  ]}
                />
                <ReportViewer
                  jobId={activeJob.id}
                  onBackToTracker={() => setViewMode("tracker")}
                  onNewInquiry={handleNewInquiry}
                />
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 2: ACTION INTELLIGENCE WORKSPACE (Stage 2)
        ════════════════════════════════════════════════════ */}
        {currentTab === "actions" && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 mb-3">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Stage 2 Blueprint · Action Intelligence & Decision Matrix</span>
                </div>
                <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                  Executive Recommendations Engine
                </h1>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                  Transform raw research reports into prioritized strategic initiatives with explicit
                  effort vs. impact matrices, measurable hypotheses, and strict provenance evidence linking.
                </p>
              </div>

              {activeJob && (
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <div className="text-xs">
                    <p className="text-slate-400 font-medium">Active Report Focus</p>
                    <p className="text-slate-200 font-mono font-semibold truncate max-w-[200px]">
                      {activeJob.target_market}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Architecture Architecture Specifications Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">
                  Prioritized Action Items
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Synthesizes structured strategic initiatives scored by <strong>Impact (1–10)</strong>, 
                  <strong>Effort (1–10)</strong>, and <strong>Time Horizon</strong> (Immediate, Near-term, Long-term).
                </p>
                <div className="pt-2 text-xs font-mono text-indigo-400/90 bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-500/20">
                  Priority = (Impact × 0.7) - (Effort × 0.3)
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">
                  Outcome Hypotheses
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every recommendation defines a testable outcome metric (e.g., &quot;Enterprise churn reduction of 15% within 2 quarters&quot;) to evaluate decision efficacy over time.
                </p>
                <div className="pt-2 text-xs font-mono text-violet-400/90 bg-violet-950/30 p-2.5 rounded-lg border border-violet-500/20">
                  Lifecycle: Draft → Approved → Implemented → Reviewed
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">
                  Direct Evidence Provenance
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No floating recommendations. Each action item maps directly to underlying
                  verified web sources via foreign keys into the research findings table.
                </p>
                <div className="pt-2 text-xs font-mono text-emerald-400/90 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20">
                  FK: recommendations.evidence_ids → findings.id
                </div>
              </div>
            </div>

            {/* Stage 2 Schema Readiness Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-200">
                  Ready to deploy Stage 2: Action Engine & Recommendations Schema
                </h4>
                <p className="text-xs text-slate-400">
                  Stage 1 foundation established. Stage 2 will introduce the database migration,
                  the AI recommendation generator endpoint, and the interactive Prioritization Matrix UI.
                </p>
              </div>
              <button
                onClick={() => {
                  if (activeJob?.has_report) {
                    setViewMode("report");
                    setCurrentTab("research");
                  } else {
                    handleNewInquiry();
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30 whitespace-nowrap cursor-pointer"
              >
                <span>{activeJob ? "Inspect Active Report" : "Launch Baseline Inquiry"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 3: MARKET INTELLIGENCE DASHBOARD (Stage 3)
        ════════════════════════════════════════════════════ */}
        {currentTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            <div className="pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Stage 3 Blueprint · Grounded Visualizations & Competitive Moats</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                Market Intelligence Dashboard
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Real-data visualization modules. Strictly separating verified data from inferred estimates,
                with zero hallucinated metrics or fabricated pie charts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    Competitive Moat Matrix
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                    STAGE 3
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  2D positioning matrix mapping competitors by <strong>Pricing Power</strong> vs.{" "}
                  <strong>Technological Moat</strong>, backed directly by findings in Vector 2 (Competitive Analysis).
                </p>
                <div className="h-44 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col items-center justify-center text-center p-4">
                  <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Interactive Scatter Plot</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Plots verified entities extracted from synthesis findings
                  </p>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-400" />
                    4-Vector Sentiment & Risk Distribution
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/80 border border-violet-500/30 text-violet-400">
                    STAGE 3
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Radar analysis of market risk posture across Macro Headwinds, Regulatory Friction,
                  Customer Churn pressure, and Moat Durability.
                </p>
                <div className="h-44 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col items-center justify-center text-center p-4">
                  <Compass className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Radar Risk Map</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Calibrated from confidence scores of each research vector
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 4: MARKET PULSE STREAM (Stage 4)
        ════════════════════════════════════════════════════ */}
        {currentTab === "pulse" && (
          <div className="space-y-8 animate-fade-in">
            <div className="pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 mb-3">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Stage 4 Blueprint · Continuous Market Pulse Ingestion</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                Live Market Pulse & Signal Detection
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Continuous ingestion pipeline utilizing GDELT 2.0 DOC API and financial RSS streams,
                clustering real-time market shifts before they appear in quarterly reports.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    Continuous News Stream Architecture
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Poll Interval: 300s</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                Stratify AI 2.0 transforms static inquiries into dynamic continuous monitoring. 
                Workers query GDELT API with normalized entity tokens, deduplicate articles by canonical URL hash,
                and extract tone & article volume spikes to flag emergent market risks.
              </p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 5: WATCHLISTS & ALERTS (Stage 6 & 7)
        ════════════════════════════════════════════════════ */}
        {currentTab === "watchlists" && (
          <div className="space-y-8 animate-fade-in">
            <div className="pb-6 border-b border-slate-800">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/60 border border-amber-500/30 text-amber-300 mb-3">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Stage 6 & 7 Blueprint · Proactive Alerts & Decision Evaluation</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
                Competitor Watchlists & Alerting
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Define target companies, products, or regulatory frameworks to monitor.
                Receive proactive alert dispatches when significant strategic shifts or competitor milestones occur.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Competitor Watch Targets</h3>
                <p className="text-xs text-slate-400">
                  Track specific market leaders and high-growth disruptors across pricing changes,
                  executive moves, and patent filings.
                </p>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Alert Rule Engine</h3>
                <p className="text-xs text-slate-400">
                  Configure sensitivity thresholds for sentiment shifts, negative news spikes,
                  and regulatory compliance updates.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ─── Recent Jobs Slide-Over Drawer ─────────────────── */}
      <RecentJobs
        isOpen={isRecentJobsOpen}
        onClose={() => setIsRecentJobsOpen(false)}
        onSelectJob={handleSelectRecentJob}
        currentJobId={activeJob?.id || null}
      />

      {/* ─── Footer ────────────────────────────────────────── */}
      <footer
        className="mt-auto border-t px-6 py-5 text-xs text-slate-500"
        style={{ borderColor: "rgba(30,41,59,0.6)", background: "rgba(8,12,20,0.85)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-300">Stratify AI 2.0 Market Intelligence Core</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
              style={{
                background: "rgba(6,182,212,0.1)",
                border: "1px solid rgba(6,182,212,0.3)",
                color: "#22d3ee",
              }}
            >
              v2.0.0-alpha
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <Dot color="#34d399" label="PostgreSQL 16 · Port 5434" />
            <Dot color="#22d3ee" label="RabbitMQ 3.13 · AMQP 5672" />
            <Dot color="#a78bfa" label="Gemini / Smart Extractor" />
            <Dot color="#f59e0b" label="DuckDuckGo Live Search" />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
      {items.map((item, idx) => (
        <React.Fragment key={item.label}>
          {idx > 0 && <span className="text-slate-700">/</span>}
          {item.active ? (
            <span className="font-medium" style={{ color: "#22d3ee" }}>
              {item.label}
            </span>
          ) : (
            <button
              onClick={item.onClick}
              className="hover:text-slate-200 transition-colors underline underline-offset-4 decoration-slate-700 hover:decoration-slate-500"
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}
