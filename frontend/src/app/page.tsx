"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { ResearchForm } from "@/components/ResearchForm";
import { JobStatusTracker } from "@/components/JobStatusTracker";
import { ReportViewer } from "@/components/ReportViewer";
import { RecentJobs } from "@/components/RecentJobs";
import { JobDetailResponse } from "@/types/api";
import {
  CheckCircle2,
  Cpu,
  Database,
  FileCheck,
  Network,
  Sparkles,
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
  const [activeJob, setActiveJob] = useState<JobDetailResponse | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("form");
  const [isRecentJobsOpen, setIsRecentJobsOpen] = useState(false);

  const handleJobCreated = (job: JobDetailResponse) => {
    setActiveJob(job);
    setViewMode("tracker");
  };

  const handleSelectRecentJob = (job: JobDetailResponse) => {
    setActiveJob(job);
    setViewMode(job.has_report ? "report" : "tracker");
  };

  const handleNewInquiry = () => {
    setActiveJob(null);
    setViewMode("form");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Sticky Header */}
      <Header
        onNewInquiryClick={handleNewInquiry}
        onRecentClick={() => setIsRecentJobsOpen(true)}
        activeJobId={activeJob?.id || null}
      />

      {/* ─── Main Content ──────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ════════════════════════════════════════════════════
            VIEW 1 — Inquiry Form & Platform Hero
        ════════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════════
            VIEW 2 — Sub-Task Execution Tracker
        ════════════════════════════════════════════════════ */}
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

        {/* ════════════════════════════════════════════════════
            VIEW 3 — Executive Intelligence Report
        ════════════════════════════════════════════════════ */}
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
            <span className="font-semibold text-slate-300">Stratify AI Intelligence Core</span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
              style={{
                background: "rgba(6,182,212,0.1)",
                border: "1px solid rgba(6,182,212,0.3)",
                color: "#22d3ee",
              }}
            >
              v1.0.0
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
