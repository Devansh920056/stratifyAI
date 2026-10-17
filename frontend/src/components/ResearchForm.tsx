"use client";

import React, { useMemo, useState } from "react";
import { JobCreateRequest, JobDetailResponse } from "@/types/api";
import { createJob } from "@/lib/api";
import {
  ArrowRight,
  Check,
  Compass,
  Globe,
  HelpCircle,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Target,
  X,
  Zap,
} from "lucide-react";

interface ResearchFormProps {
  onJobCreated: (job: JobDetailResponse) => void;
}

interface TemplateItem {
  id: string;
  name: string;
  tag: string;
  question: string;
  market: string;
  geography: string;
  timeRange: string;
  focus: string[];
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "solid-state",
    name: "Solid-State Batteries",
    tag: "CleanTech",
    question:
      "What is the commercialization timeline, manufacturing cost parity with LFP, and supply chain readiness of solid-state lithium batteries through 2030?",
    market: "Energy Storage & Electric Vehicles",
    geography: "Global (North America & APAC)",
    timeRange: "2024-2030",
    focus: ["Capex Parity", "Electrolyte Durability", "Automaker MOUs", "Yield Rates"],
  },
  {
    id: "supersonic",
    name: "Supersonic Passenger Flight",
    tag: "Aerospace",
    question:
      "Assess the market feasibility, fuel economics, and sonic boom regulatory framework for passenger supersonic commercial aircraft.",
    market: "Commercial Aerospace",
    geography: "Transatlantic & Transpacific Routes",
    timeRange: "2025-2032",
    focus: ["FAA Noise Standards", "Sustainable Aviation Fuel", "Business Class Pricing"],
  },
  {
    id: "ai-coding",
    name: "Agentic AI Software Synthesis",
    tag: "Enterprise AI",
    question:
      "Analyze enterprise adoption velocity, security IP concerns, and displacement of legacy offshore development by autonomous AI coding assistants.",
    market: "Enterprise Software & DevTools",
    geography: "North America & Europe",
    timeRange: "2024-2027",
    focus: ["SOC2 Compliance", "Productivity Gains", "Per-Seat Pricing", "IP Indemnification"],
  },
  {
    id: "smr-nuclear",
    name: "Small Modular Nuclear Reactors",
    tag: "Energy & Infra",
    question:
      "Evaluate private capital deployment, NRC design certification bottlenecks, and data center co-location demand for Gen-IV SMR nuclear reactors.",
    market: "Nuclear Energy & Hyperscale Infrastructure",
    geography: "North America & Europe",
    timeRange: "2025-2035",
    focus: ["NRC Licensing", "HALEU Enrichment", "PPA Pricing", "Data Center Demand"],
  },
  {
    id: "glp1-therapeutics",
    name: "GLP-1 Receptor Agonists",
    tag: "Biotech",
    question:
      "Examine competitive moats, oral formulation pipelines, and insurance payer reimbursement thresholds for next-generation obesity drugs.",
    market: "Biopharma & Metabolic Therapeutics",
    geography: "United States & EU5",
    timeRange: "2024-2029",
    focus: ["Payer Coverage", "Oral Bioavailability", "Supply Chain Fill-Finish", "Generic Threat"],
  },
  {
    id: "quantum-computing",
    name: "Commercial Quantum Advantage",
    tag: "DeepTech",
    question:
      "Identify the commercial timeline for fault-tolerant logical qubits, post-quantum cryptography migration, and financial optimization use cases.",
    market: "Quantum Computing & Cryptography",
    geography: "Global",
    timeRange: "2025-2032",
    focus: ["Fault Tolerance", "NIST Post-Quantum Standards", "QPU Co-processing"],
  },
];

const SUGGESTED_FOCUS_TAGS = [
  "Capex Parity",
  "Regulatory Moats",
  "Customer Churn",
  "Unit Economics",
  "Gross Margins",
  "Supply Chain Friction",
  "Enterprise Sales Cycles",
  "IP Litigation Risks",
];

const TIME_RANGES = ["Next 12 Mos", "2024-2027", "2025-2030", "2025-2035"];

export function ResearchForm({ onJobCreated }: ResearchFormProps) {
  const [question, setQuestion] = useState("");
  const [market, setMarket] = useState("");
  const [geography, setGeography] = useState("Global");
  const [timeRange, setTimeRange] = useState("2024-2030");
  const [focusInput, setFocusInput] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Dynamic strength calculation
  const inquiryStrength = useMemo(() => {
    let score = 0;
    const len = question.trim().length;
    if (len > 20) score += 30;
    if (len > 60) score += 20;
    if (market.trim().length > 3) score += 20;
    if (focusAreas.length >= 2) score += 20;
    if (focusAreas.length >= 4) score += 10;
    return Math.min(score, 100);
  }, [question, market, focusAreas]);

  const strengthLabel = useMemo(() => {
    if (inquiryStrength < 40) return { text: "Basic Inquiry", color: "text-amber-400", bar: "bg-amber-400" };
    if (inquiryStrength < 75) return { text: "Well Formulated", color: "text-cyan-400", bar: "bg-cyan-400" };
    return { text: "Executive Grade", color: "text-emerald-400", bar: "bg-emerald-400" };
  }, [inquiryStrength]);

  const applyTemplate = (t: TemplateItem) => {
    setSelectedTemplateId(t.id);
    setQuestion(t.question);
    setMarket(t.market);
    setGeography(t.geography);
    setTimeRange(t.timeRange);
    setFocusAreas(t.focus);
    setError(null);
  };

  const handleAddFocus = (tagToAdd?: string) => {
    const tag = (tagToAdd || focusInput).trim();
    if (tag && !focusAreas.includes(tag) && focusAreas.length < 8) {
      setFocusAreas([...focusAreas, tag]);
      if (!tagToAdd) setFocusInput("");
    }
  };

  const handleRemoveFocus = (tag: string) => {
    setFocusAreas(focusAreas.filter((f) => f !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 10) {
      setError("Research inquiry must be at least 10 characters long.");
      return;
    }
    if (!market.trim()) {
      setError("Please specify a target market sector.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: JobCreateRequest = {
      research_question: question.trim(),
      target_market: market.trim(),
      geography: geography.trim(),
      time_range: timeRange.trim() || undefined,
      focus_areas: focusAreas.length > 0 ? focusAreas : undefined,
    };

    try {
      const job = await createJob(payload);
      onJobCreated(job);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit research inquiry.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* ─── Preset Industry Templates ───────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Curated Strategic Templates
            </span>
          </div>
          <span className="text-[11px] text-slate-500">Click any card to auto-populate</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {TEMPLATES.map((t) => {
            const isSelected = selectedTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`p-3 rounded-xl text-left border transition-all duration-200 cursor-pointer flex flex-col justify-between h-24 ${
                  isSelected
                    ? "bg-cyan-950/60 border-cyan-500/80 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/50"
                    : "glass-card hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900/80 text-cyan-400 border border-slate-700">
                    {t.tag}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <span className="text-xs font-semibold text-slate-200 line-clamp-2 leading-tight">
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Submission Card ────────────────────────────── */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl relative shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              Configure Research Vector Matrix
            </h2>
            <p className="text-xs text-slate-400">
              The platform decomposes inquiries into 4 orthogonal units: TAM, Moats, Churn, and Regulation.
            </p>
          </div>

          {/* Inquiry Strength Meter */}
          <div className="hidden sm:flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Inquiry Depth:</span>
              <span className={`font-semibold ${strengthLabel.color}`}>{strengthLabel.text}</span>
            </div>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${strengthLabel.bar}`}
                style={{ width: `${inquiryStrength}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
            <X className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Research Question */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="research_question"
                className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                Strategic Inquiry / Research Question *
              </label>
              <span className="text-[11px] text-slate-500">
                {question.length}/500 chars
              </span>
            </div>
            <textarea
              id="research_question"
              rows={3}
              required
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setSelectedTemplateId(null);
              }}
              placeholder="e.g. What is the commercialization timeline, manufacturing cost parity with LFP, and supply chain readiness of solid-state lithium batteries through 2030?"
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm transition outline-none resize-none"
            />
          </div>

          {/* Market & Geography Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="target_market"
                className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                Target Market / Sector *
              </label>
              <input
                id="target_market"
                type="text"
                required
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="e.g. Energy Storage & Electric Vehicles"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm transition outline-none"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="geography"
                className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Geographic Scope
              </label>
              <input
                id="geography"
                type="text"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="e.g. Global, North America & APAC, EU5"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm transition outline-none"
              />
            </div>
          </div>

          {/* Time Horizon Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Strategic Time Horizon
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    timeRange === r
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  {r}
                </button>
              ))}
              <input
                type="text"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                placeholder="Custom (e.g. 2026-2035)"
                className="px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 outline-none w-36"
              />
            </div>
          </div>

          {/* Focus Areas Tag Input */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="focus_input"
                className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-violet-400" />
                Target Research Vectors & Focus Areas ({focusAreas.length}/8)
              </label>
              <span className="text-[11px] text-slate-500">Press Enter to add tag</span>
            </div>

            {/* Existing tags */}
            {focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFocus(tag)}
                      className="text-slate-400 hover:text-rose-400 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Input row */}
            <div className="flex gap-2">
              <input
                id="focus_input"
                type="text"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddFocus();
                  }
                }}
                placeholder="Add custom vector (e.g. Supply Chain Bottlenecks)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm transition outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddFocus()}
                disabled={!focusInput.trim() || focusAreas.length >= 8}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 mr-1">Suggestions:</span>
              {SUGGESTED_FOCUS_TAGS.map((tag) => {
                const isAdded = focusAreas.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={isAdded || focusAreas.length >= 8}
                    onClick={() => handleAddFocus(tag)}
                    className={`text-[11px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                      isAdded
                        ? "opacity-30 border-slate-800 text-slate-600 cursor-not-allowed"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-cyan-300 hover:border-slate-700"
                    }`}
                  >
                    + {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Grounded in Tavily web search with Gemini synthesis.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Decomposing & Dispatching...</span>
                </>
              ) : (
                <>
                  <span>Dispatch 4-Vector Inquiry</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
