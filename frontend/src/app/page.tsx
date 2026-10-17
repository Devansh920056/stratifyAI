"use client";

import React, { useState } from "react";
import { Header } from "@/components/Header";
import { ResearchForm } from "@/components/ResearchForm";
import { JobStatusTracker } from "@/components/JobStatusTracker";
import { ReportViewer } from "@/components/ReportViewer";
import { RecentJobs } from "@/components/RecentJobs";
import { JobDetailResponse } from "@/types/api";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileCheck,
  Globe,
  Layers,
  Network,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

export default function Home() {
  const [activeJob, setActiveJob] = useState<JobDetailResponse | null>(null);
  const [viewMode, setViewMode] = useState<"form" | "tracker" | "report">("form");
  const [isRecentJobsOpen, setIsRecentJobsOpen] = useState(false);

  const handleJobCreated = (job: JobDetailResponse) => {
    setActiveJob(job);
    setViewMode("tracker");
  };

  const handleSelectRecentJob = (job: JobDetailResponse) => {
    setActiveJob(job);
    if (job.has_report) {
      setViewMode("report");
    } else {
      setViewMode("tracker");
    }
  };

  const handleNewInquiry = () => {
    setActiveJob(null);
    setViewMode("form");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16]">
      {/* Sticky Header */}
      <Header
        onNewInquiryClick={handleNewInquiry}
        onRecentClick={() => setIsRecentJobsOpen(true)}
        activeJobId={activeJob?.id || null}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIEW 1: Form & Platform Introduction */}
        {viewMode === "form" && (
          <div className="space-y-12">
            {/* Hero Heading */}
            <div className="text-center max-w-3xl mx-auto space-y-4 pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Autonomous Market Intelligence Matrix</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100 leading-tight">
                Deep Strategic Intelligence,{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  Grounded in Evidence
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
                Stratify AI decomposes high-stakes market questions into 4 concurrent research
                vectors—analyzing macro sizing, competitive moats, customer churn, and regulatory
                headwinds backed by real web sources.
              </p>
            </div>

            {/* Research Input Form */}
            <ResearchForm onJobCreated={handleJobCreated} />

            {/* Platform Invariants & Architecture Showcase */}
            <div className="pt-6">
              <div className="text-center mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Distributed Systems Guarantees
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Network className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">RabbitMQ Broker</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Publisher confirms, persistent delivery mode, prefetch QoS, and DLQ routing with
                    3x bounded retries.
                  </p>
                </div>

                <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">Atomic Outbox & OCC</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    PostgreSQL 16 with optimistic concurrency control, transaction isolation, and
                    idempotent unique constraints.
                  </p>
                </div>

                <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">Gemini LLM Reasoning</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Structured JSON synthesis, confidence scores, and strict post-generation
                    anti-hallucination citation checks.
                  </p>
                </div>

                <div className="glass-panel p-5 rounded-xl border-slate-800 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100">Tavily Web Evidence</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Real web retrieval with UTM stripping, URL canonicalization, and deduplication
                    for zero phantom citations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Sub-Task Execution Tracker */}
        {viewMode === "tracker" && activeJob && (
          <div className="space-y-6">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                onClick={handleNewInquiry}
                className="hover:text-slate-200 transition underline underline-offset-4"
              >
                Inquiry Form
              </button>
              <span>/</span>
              <span className="text-cyan-400 font-medium">Sub-Task Execution Matrix</span>
              {activeJob.has_report && (
                <>
                  <span>/</span>
                  <button
                    onClick={() => setViewMode("report")}
                    className="hover:text-slate-200 transition underline underline-offset-4"
                  >
                    Executive Intelligence Report
                  </button>
                </>
              )}
            </div>

            <JobStatusTracker
              jobId={activeJob.id}
              initialJob={activeJob}
              onJobUpdate={(updated) => setActiveJob(updated)}
              onViewReport={() => setViewMode("report")}
              onNewInquiry={handleNewInquiry}
            />
          </div>
        )}

        {/* VIEW 3: Executive Intelligence Report */}
        {viewMode === "report" && activeJob && (
          <div className="space-y-6">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                onClick={handleNewInquiry}
                className="hover:text-slate-200 transition underline underline-offset-4"
              >
                Inquiry Form
              </button>
              <span>/</span>
              <button
                onClick={() => setViewMode("tracker")}
                className="hover:text-slate-200 transition underline underline-offset-4"
              >
                Sub-Task Execution Matrix
              </button>
              <span>/</span>
              <span className="text-cyan-400 font-medium">Executive Intelligence Report</span>
            </div>

            <ReportViewer
              jobId={activeJob.id}
              onBackToTracker={() => setViewMode("tracker")}
              onNewInquiry={handleNewInquiry}
            />
          </div>
        )}
      </main>

      {/* Slide-over Recent Jobs Drawer */}
      <RecentJobs
        isOpen={isRecentJobsOpen}
        onClose={() => setIsRecentJobsOpen(false)}
        onSelectJob={handleSelectRecentJob}
        currentJobId={activeJob?.id || null}
      />

      {/* Modern Platform Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 px-6 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Stratify AI Intelligence Core</span>
            <span className="text-slate-400">•</span>
            <span className="font-mono text-cyan-400">v1.0.0-rc1</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              PostgreSQL 16 (Port 5434)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              RabbitMQ 3.13 (AMQP 5672)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              Google Gemini LLM
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
