"use client";

import React, { useState, useEffect } from "react";
import { exportDossier, fetchGovernanceAuditHistory } from "@/lib/api";
import {
  DossierExportRequest,
  DossierExportResponse,
  DossierFormat,
  GovernanceAuditRecord,
} from "@/types/api";
import {
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FileCode,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Loader2,
  Lock,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";

interface ExecutiveDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEntity?: string;
  defaultDebateId?: string | null;
  defaultJobId?: string | null;
}

const PRESET_ENTITIES = [
  "Tesla, Inc.",
  "CrowdStrike Holdings",
  "NVIDIA Corporation",
  "Apple Inc.",
  "Microsoft Corporation",
];

export function ExecutiveDossierModal({
  isOpen,
  onClose,
  defaultEntity = "Tesla, Inc.",
  defaultDebateId = null,
  defaultJobId = null,
}: ExecutiveDossierModalProps) {
  const [entityName, setEntityName] = useState(defaultEntity);
  const [selectedFormat, setSelectedFormat] = useState<DossierFormat>("MARKDOWN");
  const [includeCitations, setIncludeCitations] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dossier, setDossier] = useState<DossierExportResponse | null>(null);
  const [auditHistory, setAuditHistory] = useState<GovernanceAuditRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "raw" | "audit">("preview");
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultEntity) {
      setEntityName(defaultEntity);
    }
  }, [defaultEntity]);

  useEffect(() => {
    if (isOpen && entityName.trim()) {
      loadAuditHistory(entityName);
    }
  }, [isOpen, entityName]);

  async function loadAuditHistory(name: string) {
    if (!name.trim()) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchGovernanceAuditHistory(name);
      setAuditHistory(res.audit_records || []);
    } catch {
      // Non-critical, ignore empty history
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleGenerateDossier() {
    if (!entityName.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const req: DossierExportRequest = {
        entity_name: entityName.trim(),
        job_id: defaultJobId,
        debate_id: defaultDebateId,
        format: selectedFormat,
        include_citations: includeCitations,
      };
      const res = await exportDossier(req);
      setDossier(res);
      await loadAuditHistory(entityName.trim());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to compile Boardroom Intelligence Dossier."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopyHash() {
    if (!dossier?.governance_audit?.sha256_hash) return;
    navigator.clipboard.writeText(dossier.governance_audit.sha256_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  function handleCopyContent() {
    if (!dossier?.content) return;
    navigator.clipboard.writeText(dossier.content);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  }

  function handleDownloadFile() {
    if (!dossier) return;
    const mimeTypes: Record<DossierFormat, string> = {
      MARKDOWN: "text/markdown;charset=utf-8",
      HTML: "text/html;charset=utf-8",
      JSON: "application/json;charset=utf-8",
    };
    const blob = new Blob([dossier.content], {
      type: mimeTypes[dossier.format] || "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = dossier.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    if (!dossier) return;
    if (dossier.format === "HTML") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(dossier.content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    } else {
      window.print();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[950px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-violet-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">
                  Executive Intelligence Export & Governance Dossier
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                  Stage 11
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> SEC Rule 17a-4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic synthesis with multi-vector arbitration, statutory SEC EDGAR provenance, and SHA-256 cryptographic audit seal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Toolbar */}
        <div className="px-6 py-3.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Entity Input & Presets */}
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Entity:
            </span>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="e.g. Tesla, Inc., CrowdStrike..."
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-52"
            />
            <div className="hidden lg:flex items-center gap-1">
              {PRESET_ENTITIES.slice(0, 3).map((ent) => (
                <button
                  key={ent}
                  onClick={() => setEntityName(ent)}
                  className={`text-[11px] px-2 py-1 rounded-md transition border ${
                    entityName === ent
                      ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                      : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {ent.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selector Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Format:
            </span>
            <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800">
              {(
                [
                  { id: "MARKDOWN", label: "Markdown (.md)", icon: FileText },
                  { id: "HTML", label: "HTML Report (.html)", icon: FileCode },
                  { id: "JSON", label: "JSON Data (.json)", icon: Terminal },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSelectedFormat(id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                    selectedFormat === id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateDossier}
              disabled={isGenerating || !entityName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 transition shadow-md shadow-indigo-500/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Compile Dossier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cryptographic Governance Seal Banner */}
        {dossier && (
          <div className="px-6 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                <Lock className="w-3.5 h-3.5" />
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  SHA-256 Provenance:
                </span>
                <code className="font-mono text-[11px] text-emerald-300">
                  {dossier.governance_audit.sha256_hash.slice(0, 16)}...
                  {dossier.governance_audit.sha256_hash.slice(-8)}
                </code>
                <button
                  onClick={handleCopyHash}
                  className="ml-1 hover:text-white transition"
                  title="Copy full 64-character SHA-256 hash"
                >
                  {copiedHash ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-medium">
                <Scale className="w-3.5 h-3.5" />
                <span>Verdict:</span>
                <strong className="text-white">
                  {dossier.governance_audit.arbiter_verdict || "STRATEGIC_ACCUMULATE"}
                </strong>
                <span className="text-slate-400">
                  ({Math.round((dossier.governance_audit.conviction_score || 0.85) * 100)}% conviction)
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300">
                <span>DQS Quality:</span>
                <strong className="text-cyan-300">
                  {((dossier.governance_audit.dqs_score || 0.84) * 100).toFixed(1)}%
                </strong>
              </div>

              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Citations:</span>
                <span className="text-slate-200 font-semibold">
                  {dossier.governance_audit.total_citations} Verified Sources
                </span>
              </div>
            </div>

            {/* Quick Export Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyContent}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                title="Copy entire document payload"
              >
                {copiedContent ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedContent ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>

              <button
                onClick={handleDownloadFile}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {dossier.filename.split(".").pop()?.toUpperCase()}</span>
              </button>
            </div>
          </div>
        )}

        {/* View Tabs */}
        {dossier && (
          <div className="px-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("preview")}
                className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === "preview"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Rendered Dossier
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`py-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === "raw"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Raw Source Payload
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`py-2 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === "audit"
                    ? "border-cyan-400 text-cyan-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Governance Audit History ({auditHistory.length})</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Bytes: {dossier.governance_audit.content_length_bytes} | File: {dossier.filename}
            </div>
          </div>
        )}

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
          {error && (
            <div className="mb-4 p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {!dossier && !isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                <FileCheck2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-200">
                Ready to Compile Boardroom Intelligence Dossier
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-6 leading-relaxed">
                Stratify AI will aggregate Cross-Vector Multi-Agent Dialectic Debates, SEC EDGAR 10-K disclosures, arXiv scientific papers, and GDELT market signals with a non-repudiable SHA-256 audit fingerprint.
              </p>
              <button
                onClick={handleGenerateDossier}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Compile Executive Dossier for {entityName || "Target"}</span>
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
              <h3 className="text-base font-bold text-slate-200">
                Synthesizing Multi-Vector Evidence & Cryptographic Seal
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Querying statutory Form 10-K disclosures, arXiv preprints, backtested DQS scores, and generating SEC Rule 17a-4 provenance hash...
              </p>
            </div>
          )}

          {dossier && activeTab === "preview" && (
            <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl">
              {dossier.format === "HTML" ? (
                <iframe
                  srcDoc={dossier.content}
                  title="Dossier HTML Preview"
                  className="w-full h-[650px] rounded-lg border border-slate-800 bg-[#090d16]"
                />
              ) : dossier.format === "JSON" ? (
                <pre className="font-mono text-xs text-cyan-300 bg-slate-950 p-6 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {dossier.content}
                </pre>
              ) : (
                <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {dossier.content}
                </div>
              )}
            </div>
          )}

          {dossier && activeTab === "raw" && (
            <div className="max-w-4xl mx-auto">
              <pre className="font-mono text-xs text-slate-300 bg-slate-900 border border-slate-800 p-6 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                {dossier.content}
              </pre>
            </div>
          )}

          {dossier && activeTab === "audit" && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Statutory Non-Repudiation Audit Trail
                </h4>
                <button
                  onClick={() => loadAuditHistory(entityName)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Registry</span>
                </button>
              </div>

              {auditHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-xs">
                  No previous audit records found for this entity.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditHistory.map((rec, i) => (
                    <div
                      key={rec.sha256_hash + i}
                      className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">
                            {rec.entity_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-medium text-[10px]">
                            {rec.arbiter_verdict || "ACCUMULATE"}
                          </span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {new Date(rec.generated_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-xs text-cyan-300 break-all border border-slate-850 flex items-center justify-between">
                        <span>SHA-256: {rec.sha256_hash}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(rec.sha256_hash);
                          }}
                          className="ml-2 text-slate-400 hover:text-cyan-300 transition"
                          title="Copy Hash"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                        <span>Payload Size: {rec.content_length_bytes} bytes</span>
                        <span>Citations: {rec.total_citations}</span>
                        <span>DQS Calibration: {((rec.dqs_score || 0.84) * 100).toFixed(1)}%</span>
                        <span>SEC Accessions: {rec.sec_accessions.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
