"use client";

import React, { useState } from "react";
import { Header, NavigationTab } from "@/components/Header";
import { ResearchForm } from "@/components/ResearchForm";
import { JobStatusTracker } from "@/components/JobStatusTracker";
import { ReportViewer } from "@/components/ReportViewer";
import { RecentJobs } from "@/components/RecentJobs";
import { ActionIntelWorkspace } from "@/components/ActionIntelWorkspace";
import { DashboardWorkspace } from "@/components/DashboardWorkspace";
import { MarketPulseWorkspace } from "@/components/MarketPulseWorkspace";
import { WatchlistsWorkspace } from "@/components/WatchlistsWorkspace";
import { JobDetailResponse } from "@/types/api";
import { Sparkles } from "lucide-react";

// ─── View state machine ──────────────────────────────────────
type ViewMode = "form" | "tracker" | "report";

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
                <div className="text-center max-w-2xl mx-auto space-y-4 pt-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0]">
                    <Sparkles className="w-3.5 h-3.5 text-[#FCF1D0]" />
                    <span>India First · Strategic Market Intelligence</span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
                    Understand Indian Markets,{" "}
                    <span className="text-[#FCF1D0]">
                      Fast and Simple
                    </span>
                  </h1>

                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    Ask any question about Indian industries, competitors, RBI/SEBI regulations, or market trends. Get clear, verified insights and step-by-step action plans in seconds.
                  </p>
                </div>

                {/* Research Input Form */}
                <ResearchForm onJobCreated={handleJobCreated} />
              </div>
            )}

            {/* VIEW 1.2 — Sub-Task Execution Tracker */}
            {viewMode === "tracker" && activeJob && (
              <div className="space-y-6 animate-fade-in">
                <Breadcrumbs
                  items={[
                    { label: "New Research", onClick: handleNewInquiry },
                    { label: "Research in Progress", active: true },
                    ...(activeJob.has_report
                      ? [{ label: "Research Report", onClick: () => setViewMode("report") }]
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
                    { label: "New Research", onClick: handleNewInquiry },
                    { label: "Research in Progress", onClick: () => setViewMode("tracker") },
                    { label: "Research Report", active: true },
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
          <ActionIntelWorkspace
            activeJob={activeJob}
            onSelectJob={(job) => setActiveJob(job)}
            onNewInquiry={handleNewInquiry}
          />
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 3: MARKET INTELLIGENCE DASHBOARD (Stage 3)
        ════════════════════════════════════════════════════ */}
        {currentTab === "dashboard" && (
          <DashboardWorkspace
            activeJob={activeJob}
            onSelectJob={(job) => setActiveJob(job)}
            onNewInquiry={handleNewInquiry}
          />
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 4: MARKET PULSE STREAM (Stage 4)
        ════════════════════════════════════════════════════ */}
        {currentTab === "pulse" && (
          <MarketPulseWorkspace />
        )}

        {/* ════════════════════════════════════════════════════
            PILLAR 5: WATCHLISTS & ALERTS (Stage 5)
        ════════════════════════════════════════════════════ */}
        {currentTab === "watchlists" && (
          <WatchlistsWorkspace />
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
        className="mt-auto border-t px-6 py-6 text-xs text-slate-400"
        style={{ borderColor: "#22396F", background: "#010736" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#FCF1D0]">Stratify AI</span>
            <span className="text-slate-400">— Clear & Simple Market Intelligence</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FCF1D0]" />
              <span>Real-Time Market Data</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FCF1D0]" />
              <span>Verified Facts</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FCF1D0]" />
              <span>Actionable Strategy</span>
            </span>
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
    <nav className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
      {items.map((item, idx) => (
        <React.Fragment key={item.label}>
          {idx > 0 && <span className="text-slate-600">/</span>}
          {item.active ? (
            <span className="font-semibold text-[#FCF1D0]">
              {item.label}
            </span>
          ) : (
            <button
              onClick={item.onClick}
              className="hover:text-[#FCF1D0] transition-colors"
            >
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
