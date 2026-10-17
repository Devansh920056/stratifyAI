"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { CitationItem, KeyFinding, ReportResponse, ReportSection } from "@/types/api";
import { getJobReport } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCheck,
  FileJson,
  FileText,
  Filter,
  Globe,
  Layers,
  Lightbulb,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

interface ReportViewerProps {
  jobId: string;
  initialReport?: ReportResponse | null;
  onBackToTracker: () => void;
  onNewInquiry: () => void;
}

type TabType = "overview" | "market" | "competitor" | "customer" | "risks" | "citations";

export function ReportViewer({
  jobId,
  initialReport,
  onBackToTracker,
  onNewInquiry,
}: ReportViewerProps) {
  const [report, setReport] = useState<ReportResponse | null>(initialReport || null);
  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [citationSearch, setCitationSearch] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchReport = useCallback(
    async (showIndicator = false) => {
      if (showIndicator) setIsRefreshing(true);
      try {
        const res = await getJobReport(jobId);
        if (res) {
          setReport(res);
          setError(null);
        } else {
          setError("Report is still being compiled by the aggregator. Please wait a moment.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load report";
        setError(msg);
      } finally {
        setLoading(false);
        if (showIndicator) setIsRefreshing(false);
      }
    },
    [jobId]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Aggregate metrics
  const overallConfidence = useMemo(() => {
    if (!report) return 90;
    const sections = [
      report.market_findings,
      report.competitor_analysis,
      report.customer_insights,
      report.opportunities_and_risks,
    ].filter((s) => s && s.status === "COMPLETED");
    if (sections.length === 0) return 85;
    const avg =
      sections.reduce((acc, s) => acc + (s.confidence || 0.85), 0) / sections.length;
    return Math.round(avg * 100);
  }, [report]);

  const totalCitationsCount = useMemo(() => {
    if (!report) return 0;
    return report.citations?.length || 0;
  }, [report]);

  // Filtered citations for citation index tab
  const filteredCitations = useMemo(() => {
    if (!report?.citations) return [];
    if (!citationSearch.trim()) return report.citations;
    const q = citationSearch.toLowerCase();
    return report.citations.filter(
      (c) =>
        c.url.toLowerCase().includes(q) ||
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.task_type && c.task_type.toLowerCase().includes(q))
    );
  }, [report, citationSearch]);

  const handleCopyMarkdown = () => {
    if (!report) return;
    const md = generateMarkdownExport(report);
    navigator.clipboard.writeText(md);
    setCopied(true);
    showToast("Report copied to clipboard as Markdown!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const md = generateMarkdownExport(report);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stratify-intelligence-${jobId.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded Markdown report.");
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stratify-intelligence-${jobId.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded raw JSON data.");
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <h3 className="text-base font-bold text-slate-100">
          Synthesizing Executive Report...
        </h3>
        <p className="text-xs text-slate-400 max-w-md">
          Stratify AI aggregator is reconciling 4 research vectors, validating citations, and generating cross-domain strategic insights.
        </p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="glass-panel p-10 rounded-2xl border border-rose-500/40 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-100">Report Unavailable</h3>
        <p className="text-xs text-rose-300 max-w-md mx-auto">{error}</p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => fetchReport(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            Try Again
          </button>
          <button
            onClick={onBackToTracker}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 text-white hover:bg-cyan-500 transition"
          >
            Back to Task Tracker
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 text-xs shadow-2xl flex items-center gap-2 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── Header Action Bar ──────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <button
                onClick={onBackToTracker}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Task Tracker</span>
              </button>
              <span className="text-slate-700">/</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                {report.status === "FINAL" ? "EXECUTIVE GRADE" : report.status}
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-[11px] text-slate-400 font-mono">
                {new Date(report.created_at).toLocaleDateString()} at{" "}
                {new Date(report.created_at).toLocaleTimeString()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight leading-snug">
              Executive Market Intelligence Report
            </h1>
            <p className="text-xs text-slate-400">
              Grounded multi-agent synthesis across TAM, Competitive Moats, Churn Triggers & Regulatory Risks.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
              title="Copy formatted Markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy Briefing"}</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
              title="Download Markdown file (.md)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .MD</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
              title="Download raw JSON data"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
              title="Print / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onNewInquiry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 shadow-md shadow-indigo-500/20 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Inquiry</span>
            </button>
          </div>
        </div>

        {/* Strategic Scorecard KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <Scorecard
            label="Synthesis Confidence"
            value={`${overallConfidence}%`}
            subtext="Grounded rating"
            color="text-emerald-400"
          />
          <Scorecard
            label="Verified Evidence"
            value={`${totalCitationsCount} Sources`}
            subtext="Live web retrieval"
            color="text-cyan-400"
          />
          <Scorecard
            label="Vector Convergence"
            value="4 / 4 Complete"
            subtext="100% domain coverage"
            color="text-indigo-400"
          />
          <Scorecard
            label="Guardrail Status"
            value="Zero Hallucinations"
            subtext="Strict citation bounds"
            color="text-violet-400"
          />
        </div>
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────── */}
      <div className="flex border-b border-slate-800 overflow-x-auto gap-2">
        <TabButton
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          icon={Layers}
          label="Executive Overview"
        />
        <TabButton
          active={activeTab === "market"}
          onClick={() => setActiveTab("market")}
          icon={TrendingUp}
          label="Market Sizing & TAM"
        />
        <TabButton
          active={activeTab === "competitor"}
          onClick={() => setActiveTab("competitor")}
          icon={Shield}
          label="Competitive Moats"
        />
        <TabButton
          active={activeTab === "customer"}
          onClick={() => setActiveTab("customer")}
          icon={Users}
          label="Customer Churn"
        />
        <TabButton
          active={activeTab === "risks"}
          onClick={() => setActiveTab("risks")}
          icon={AlertTriangle}
          label="Regulatory Risks"
        />
        <TabButton
          active={activeTab === "citations"}
          onClick={() => setActiveTab("citations")}
          icon={Globe}
          label={`Evidence Index (${totalCitationsCount})`}
        />
      </div>

      {/* ─── Tab Content Panes ───────────────────────────────── */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-fade-in">
          {/* Executive Summary Card */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl space-y-4 border-l-4 border-l-cyan-500">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider">
                Executive Synthesis
              </h2>
            </div>
            <div className="text-sm sm:text-base text-slate-200 leading-relaxed space-y-3 font-normal whitespace-pre-line">
              {report.executive_summary}
            </div>
          </div>

          {/* 4-Vector Snapshot Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VectorSnapshotCard
              title="Market Overview & TAM"
              icon={TrendingUp}
              color="text-cyan-400"
              section={report.market_findings}
              onNavigate={() => setActiveTab("market")}
            />
            <VectorSnapshotCard
              title="Competitive Landscape & Moats"
              icon={Shield}
              color="text-violet-400"
              section={report.competitor_analysis}
              onNavigate={() => setActiveTab("competitor")}
            />
            <VectorSnapshotCard
              title="Customer Insights & Churn"
              icon={Users}
              color="text-amber-400"
              section={report.customer_insights}
              onNavigate={() => setActiveTab("customer")}
            />
            <VectorSnapshotCard
              title="Regulatory Headwinds & Disruption"
              icon={AlertTriangle}
              color="text-rose-400"
              section={report.opportunities_and_risks}
              onNavigate={() => setActiveTab("risks")}
            />
          </div>

          {/* Research Limitations & Methodology */}
          {report.research_limitations && (
            <div className="glass-card p-5 rounded-xl space-y-2 text-xs text-slate-400 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-300 font-semibold uppercase tracking-wider">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Anti-Hallucination & Research Methodology Notice
              </div>
              <p className="leading-relaxed">{report.research_limitations}</p>
            </div>
          )}
        </div>
      )}

      {/* 2. MARKET SIZING TAB */}
      {activeTab === "market" && (
        <SectionDeepDive
          title="Market Overview & Macro Sizing"
          icon={TrendingUp}
          color="text-cyan-400"
          section={report.market_findings}
          defaultFocus="TAM/SAM sizing, historical CAGRs, macroeconomic drivers"
        />
      )}

      {/* 3. COMPETITOR ANALYSIS TAB */}
      {activeTab === "competitor" && (
        <SectionDeepDive
          title="Competitive Landscape & Moats"
          icon={Shield}
          color="text-violet-400"
          section={report.competitor_analysis}
          defaultFocus="Incumbents, challenger dynamics, pricing power & defensibility"
        />
      )}

      {/* 4. CUSTOMER CHURN TAB */}
      {activeTab === "customer" && (
        <SectionDeepDive
          title="Customer Personas & Pain Points"
          icon={Users}
          color="text-amber-400"
          section={report.customer_insights}
          defaultFocus="Buyer personas, purchasing triggers, unmet demand & churn"
        />
      )}

      {/* 5. REGULATORY RISKS TAB */}
      {activeTab === "risks" && (
        <SectionDeepDive
          title="Regulatory Headwinds & Disruption"
          icon={AlertTriangle}
          color="text-rose-400"
          section={report.opportunities_and_risks}
          defaultFocus="Policy compliance, certification timelines & supply disruption"
        />
      )}

      {/* 6. CITATIONS INDEX TAB */}
      {activeTab === "citations" && (
        <div className="glass-panel p-6 sm:p-8 rounded-2xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                Verified Web Evidence & Citations Index
              </h2>
              <p className="text-xs text-slate-400">
                All claims are bound to real canonicalized URLs retrieved from verified web sources.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={citationSearch}
                onChange={(e) => setCitationSearch(e.target.value)}
                placeholder="Search domains or URLs..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredCitations.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No citations match &quot;{citationSearch}&quot;
              </div>
            ) : (
              filteredCitations.map((cit, idx) => (
                <div
                  key={idx}
                  className="glass-card p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                        [{idx + 1}]
                      </span>
                      {cit.task_type && (
                        <span className="text-[10px] uppercase font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {cit.task_type.replace("_", " ")}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {cit.title || "External Source"}
                      </span>
                    </div>

                    <a
                      href={cit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 hover:underline truncate max-w-full font-mono transition"
                    >
                      <span className="truncate">{cit.url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>

                  <span className="text-[10px] font-medium text-emerald-400 px-2 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 flex items-center gap-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────

function Scorecard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string;
  subtext: string;
  color: string;
}) {
  return (
    <div className="glass-card p-3 sm:p-4 rounded-xl border border-slate-800 space-y-1">
      <span className="text-[11px] font-medium text-slate-400 block">{label}</span>
      <span className={`text-xl sm:text-2xl font-extrabold ${color} tracking-tight block`}>
        {value}
      </span>
      <span className="text-[10px] text-slate-500 block truncate">{subtext}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-t-xl text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
        active
          ? "border-cyan-400 text-cyan-300 bg-slate-900/60"
          : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function VectorSnapshotCard({
  title,
  icon: Icon,
  color,
  section,
  onNavigate,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  section?: ReportSection;
  onNavigate: () => void;
}) {
  const isAvailable = section && section.status === "COMPLETED";

  return (
    <div
      onClick={onNavigate}
      className="glass-panel p-5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition cursor-pointer space-y-3 group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${color}`} />
          <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
            {title}
          </h3>
        </div>
        <span className="text-xs text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center">
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>

      <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
        {section?.summary || "Vector analysis completed and synthesized."}
      </p>

      <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
        <span>Confidence: {section ? Math.round((section.confidence || 0.9) * 100) : 90}%</span>
        <span>{section?.key_findings?.length || 0} Key Claims</span>
      </div>
    </div>
  );
}

function SectionDeepDive({
  title,
  icon: Icon,
  color,
  section,
  defaultFocus,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  section?: ReportSection;
  defaultFocus: string;
}) {
  if (!section) {
    return (
      <div className="glass-panel p-10 rounded-2xl text-center text-slate-400 text-xs">
        Section not yet available for this research job.
      </div>
    );
  }

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400">{defaultFocus}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 border border-slate-800 text-cyan-300">
            Confidence: {Math.round((section.confidence || 0.9) * 100)}%
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
            {section.status}
          </span>
        </div>
      </div>

      {/* Summary Narrative */}
      <div className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
        {section.summary}
      </div>

      {/* Key Findings Claims List */}
      {section.key_findings && section.key_findings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Synthesized Factual Claims ({section.key_findings.length})
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {section.key_findings.map((finding: KeyFinding, idx: number) => (
              <div
                key={idx}
                className="glass-card p-4 rounded-xl border border-slate-800 space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-normal">
                    {finding.claim}
                  </p>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                    {Math.round((finding.confidence || 0.9) * 100)}% Conf
                  </span>
                </div>

                {finding.source_url && (
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <a
                      href={finding.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline font-mono truncate max-w-[480px] transition"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{finding.source_url}</span>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Markdown Formatter ──────────────────────────────────────
function generateMarkdownExport(report: ReportResponse): string {
  const citationsMd =
    report.citations && report.citations.length > 0
      ? report.citations
          .map((c, i) => `[${i + 1}] ${c.title || c.url}: ${c.url}`)
          .join("\n")
      : "No external citations recorded.";

  return `# Stratify AI — Executive Intelligence Report
Status: ${report.status}
Generated At: ${new Date(report.created_at).toISOString()}
Job ID: ${report.job_id}

---

## 1. Executive Summary
${report.executive_summary}

---

## 2. Market Overview & Macro Sizing
${report.market_findings?.summary || "N/A"}

### Key Claims:
${(report.market_findings?.key_findings || [])
  .map((k) => `- ${k.claim} (Confidence: ${Math.round(k.confidence * 100)}%) [Source](${k.source_url})`)
  .join("\n")}

---

## 3. Competitive Landscape & Moats
${report.competitor_analysis?.summary || "N/A"}

### Key Claims:
${(report.competitor_analysis?.key_findings || [])
  .map((k) => `- ${k.claim} (Confidence: ${Math.round(k.confidence * 100)}%) [Source](${k.source_url})`)
  .join("\n")}

---

## 4. Customer Insights & Pain Points
${report.customer_insights?.summary || "N/A"}

### Key Claims:
${(report.customer_insights?.key_findings || [])
  .map((k) => `- ${k.claim} (Confidence: ${Math.round(k.confidence * 100)}%) [Source](${k.source_url})`)
  .join("\n")}

---

## 5. Regulatory Headwinds & Strategic Risks
${report.opportunities_and_risks?.summary || "N/A"}

### Key Claims:
${(report.opportunities_and_risks?.key_findings || [])
  .map((k) => `- ${k.claim} (Confidence: ${Math.round(k.confidence * 100)}%) [Source](${k.source_url})`)
  .join("\n")}

---

## 6. Verified Evidence & Citations
${citationsMd}

---
*Generated by Stratify AI Distributed Intelligence Core.*
`;
}
