"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CitationItem, KeyFinding, ReportResponse, ReportSection } from "@/types/api";
import { getJobReport } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Layers,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

interface ReportViewerProps {
  jobId: string;
  initialReport?: ReportResponse | null;
  onBackToTracker: () => void;
  onNewInquiry: () => void;
}

type TabType = "market" | "competitor" | "customer" | "risks" | "citations";

export function ReportViewer({
  jobId,
  initialReport,
  onBackToTracker,
  onNewInquiry,
}: ReportViewerProps) {
  const [report, setReport] = useState<ReportResponse | null>(initialReport || null);
  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("market");
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleCopySummary = () => {
    if (!report) return;
    const text = `STRATIFY AI — EXECUTIVE INTELLIGENCE REPORT
Status: ${report.status}
Generated: ${new Date(report.created_at).toLocaleString()}

EXECUTIVE SUMMARY:
${report.executive_summary}

MARKET FINDINGS:
${report.market_findings?.summary || "N/A"}

COMPETITOR ANALYSIS:
${report.competitor_analysis?.summary || "N/A"}

CUSTOMER INSIGHTS:
${report.customer_insights?.summary || "N/A"}

OPPORTUNITIES & RISKS:
${report.opportunities_and_risks?.summary || "N/A"}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const md = `# Stratify AI Intelligence Synthesis
**Report ID:** \`${report.id}\`  
**Job ID:** \`${report.job_id}\`  
**Status:** \`${report.status}\`  
**Compiled At:** ${new Date(report.created_at).toISOString()}  

---

## Executive Summary
${report.executive_summary}

---

## 1. Market Overview & Sizing
**Status:** ${report.market_findings?.status} | **Confidence:** ${(report.market_findings?.confidence * 100).toFixed(0)}%  
${report.market_findings?.summary}

### Key Findings:
${(report.market_findings?.key_findings || [])
  .map(
    (f) =>
      `- **${f.claim}** (Confidence: ${(f.confidence * 100).toFixed(0)}%)\n  Source: [${f.source_url}](${f.source_url})`
  )
  .join("\n")}

---

## 2. Competitive Landscape & Defensibility
**Status:** ${report.competitor_analysis?.status} | **Confidence:** ${(report.competitor_analysis?.confidence * 100).toFixed(0)}%  
${report.competitor_analysis?.summary}

### Key Findings:
${(report.competitor_analysis?.key_findings || [])
  .map(
    (f) =>
      `- **${f.claim}** (Confidence: ${(f.confidence * 100).toFixed(0)}%)\n  Source: [${f.source_url}](${f.source_url})`
  )
  .join("\n")}

---

## 3. Customer Insights & Unmet Demand
**Status:** ${report.customer_insights?.status} | **Confidence:** ${(report.customer_insights?.confidence * 100).toFixed(0)}%  
${report.customer_insights?.summary}

### Key Findings:
${(report.customer_insights?.key_findings || [])
  .map(
    (f) =>
      `- **${f.claim}** (Confidence: ${(f.confidence * 100).toFixed(0)}%)\n  Source: [${f.source_url}](${f.source_url})`
  )
  .join("\n")}

---

## 4. Opportunities & Downside Risks
**Status:** ${report.opportunities_and_risks?.status} | **Confidence:** ${(report.opportunities_and_risks?.confidence * 100).toFixed(0)}%  
${report.opportunities_and_risks?.summary}

### Key Findings:
${(report.opportunities_and_risks?.key_findings || [])
  .map(
    (f) =>
      `- **${f.claim}** (Confidence: ${(f.confidence * 100).toFixed(0)}%)\n  Source: [${f.source_url}](${f.source_url})`
  )
  .join("\n")}

---

## Master Citations List (${report.citations?.length || 0} Sources)
${(report.citations || []).map((c, i) => `${i + 1}. [${c.title || c.url}](${c.url})`).join("\n")}

${
  report.research_limitations
    ? `\n---\n\n## Research Limitations & Caveats\n${report.research_limitations}`
    : ""
}
`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stratify-report-${jobId.slice(0, 8)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 glass-panel rounded-2xl">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
        <h3 className="text-base font-semibold text-slate-100">
          Synthesizing Cross-Vector Intelligence
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Aggregating sub-task outputs, deduplicating citations, and validating factual anchors...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="glass-panel p-8 rounded-2xl border-amber-500/30 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-100">Report Pending Synthesis</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">{error}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => fetchReport(true)}
            disabled={isRefreshing}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Check Again
          </button>
          <button
            onClick={onBackToTracker}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
          >
            View Sub-Task Progress
          </button>
        </div>
      </div>
    );
  }

  const renderSection = (title: string, section?: ReportSection) => {
    if (!section || section.status === "UNAVAILABLE") {
      return (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800/80">
          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-400">
            {title} data is unavailable for this research run.
          </p>
        </div>
      );
    }

    if (section.status === "FAILED") {
      return (
        <div className="p-6 bg-rose-950/30 rounded-xl border border-rose-500/30">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>Vector Execution Failed</span>
          </div>
          <p className="text-xs text-rose-300">{section.error || "Upstream provider error"}</p>
        </div>
      );
    }

    const confidencePct = Math.round((section.confidence || 0) * 100);

    return (
      <div className="space-y-6">
        {/* Metric Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Confidence Rating</div>
              <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{confidencePct}%</span>
                <span className="text-[11px] font-normal text-slate-400">
                  ({confidencePct >= 80 ? "High Rigor" : confidencePct >= 60 ? "Moderate" : "Low Rigor"})
                </span>
              </div>
            </div>
          </div>

          {section.model && (
            <div className="text-xs text-slate-400">
              <span className="text-slate-400">Synthesis Engine: </span>
              <span className="font-mono text-cyan-300 font-medium">{section.model}</span>
            </div>
          )}
        </div>

        {/* Narrative Summary */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            Analytical Assessment
          </h4>
          <div className="text-sm text-slate-200 leading-relaxed space-y-3 whitespace-pre-line bg-slate-900/30 p-5 rounded-xl border border-slate-800/80">
            {section.summary}
          </div>
        </div>

        {/* Key Structured Findings with Direct Source Links */}
        {section.key_findings && section.key_findings.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Verified Key Findings ({section.key_findings.length})
            </h4>

            <div className="space-y-2.5">
              {section.key_findings.map((kf: KeyFinding, idx: number) => {
                const kfConfidence = Math.round((kf.confidence || 0) * 100);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-100 font-medium leading-snug">
                        {kf.claim}
                      </p>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950 border border-cyan-800 text-cyan-300 shrink-0">
                        {kfConfidence}% conf
                      </span>
                    </div>

                    {kf.source_url && (
                      <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                        <span className="text-slate-400">Anchor:</span>
                        <a
                          href={kf.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-mono truncate max-w-md"
                        >
                          <span className="truncate">{kf.source_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={onBackToTracker}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-400 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sub-Task Execution Matrix</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copied ? "Copied!" : "Copy Report"}</span>
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Markdown</span>
          </button>
          <button
            onClick={onNewInquiry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow transition"
          >
            <span>+ New Inquiry</span>
          </button>
        </div>
      </div>

      {/* Partial Degradation Callout if status === PARTIAL */}
      {report.status === "PARTIAL" && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Partial Report Notice
            </h4>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              One or more sub-task research workers encountered an upstream timeout or failed to
              complete. The intelligence sections below represent all successfully executed,
              verified vectors.
            </p>
          </div>
        </div>
      )}

      {/* Executive Intelligence Summary Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-cyan-500/30 relative overflow-hidden shadow-2xl shadow-cyan-950/30">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Executive Intelligence Synthesis
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                report.status === "FINAL"
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
              }`}
            >
              {report.status}
            </span>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(report.created_at).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="text-sm sm:text-base text-slate-100 leading-relaxed font-sans space-y-3 whitespace-pre-line">
          {report.executive_summary}
        </div>
      </div>

      {/* Dimensional Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("market")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "market"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          <span>Market Sizing</span>
        </button>

        <button
          onClick={() => setActiveTab("competitor")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "competitor"
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-violet-400" />
          <span>Competitors & Moats</span>
        </button>

        <button
          onClick={() => setActiveTab("customer")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "customer"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>Customer Insights</span>
        </button>

        <button
          onClick={() => setActiveTab("risks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            activeTab === "risks"
              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>Opportunities & Risks</span>
        </button>

        <button
          onClick={() => setActiveTab("citations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ml-auto cursor-pointer ${
            activeTab === "citations"
              ? "bg-slate-800 text-slate-100 border border-slate-700 shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>Citations ({report.citations?.length || 0})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-slate-800 min-h-[300px]">
        {activeTab === "market" && renderSection("Market Sizing & Macro Trends", report.market_findings)}
        {activeTab === "competitor" &&
          renderSection("Competitive Moats & Positioning", report.competitor_analysis)}
        {activeTab === "customer" &&
          renderSection("Customer Demand & Personas", report.customer_insights)}
        {activeTab === "risks" &&
          renderSection("Macro Opportunities & Downside Risks", report.opportunities_and_risks)}

        {/* Master Citations Tab */}
        {activeTab === "citations" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Verified External Citations ({report.citations?.length || 0})
              </h3>
              <span className="text-xs text-slate-400">
                All claims fact-anchored to genuine web evidence
              </span>
            </div>

            {(!report.citations || report.citations.length === 0) ? (
              <p className="text-xs text-slate-400 py-8 text-center">No citations recorded for this run.</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {report.citations.map((c: CitationItem, idx: number) => {
                  let hostname = "";
                  try {
                    hostname = new URL(c.url).hostname.replace("www.", "");
                  } catch {
                    hostname = "source";
                  }

                  return (
                    <div
                      key={idx}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/30 px-3 rounded-lg transition"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="w-5 text-right font-mono text-xs text-slate-400">
                          {idx + 1}.
                        </span>
                        <div className="overflow-hidden">
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-medium text-slate-200 hover:text-cyan-400 transition flex items-center gap-1.5 truncate"
                          >
                            <span className="truncate">{c.title || c.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          <span className="text-[11px] font-mono text-slate-400">{c.url}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 sm:self-center self-start pl-8 sm:pl-0">
                        {c.task_type && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400">
                            {c.task_type}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
                          {hostname}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Research Limitations Callout if present */}
      {report.research_limitations && (
        <div className="glass-panel p-5 rounded-xl border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-2 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Research Limitations & Methodology Notes</span>
          </div>
          <p className="leading-relaxed pl-5">{report.research_limitations}</p>
        </div>
      )}
    </div>
  );
}
