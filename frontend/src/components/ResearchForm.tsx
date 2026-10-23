"use client";

import React, { useMemo, useState } from "react";
import { JobCreateRequest, JobDetailResponse } from "@/types/api";
import { createJob } from "@/lib/api";
import {
  ArrowRight,
  Check,
  Compass,
  Globe,
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
    id: "upi-credit",
    name: "UPI & Digital Lending Credit",
    tag: "Fintech & Banking",
    question:
      "How will RBI digital lending guidelines, RuPay credit cards on UPI, and default loss guarantee norms impact fintech net interest margins and credit penetration in India through 2028?",
    market: "Fintech & Digital Banking",
    geography: "India (Pan-India)",
    timeRange: "2025-2028",
    focus: ["RBI Regulations", "UPI Take-Rates", "NPA Ratios", "RuPay Credit Expansion"],
  },
  {
    id: "ev-2w-pli",
    name: "India EV 2W & Battery PLI",
    tag: "EV & Mobility",
    question:
      "What is the commercialization timeline, subsidy impact of EMPS/FAME transition, and localized battery cell manufacturing under the PLI scheme for Indian 2W EV OEMs through 2027?",
    market: "Electric Vehicles & Clean Mobility",
    geography: "India (Metro & Tier-2/3)",
    timeRange: "FY 2025-26",
    focus: ["PLI Scheme Subsidies", "Battery Localization", "TCO Parity", "Charging Infra"],
  },
  {
    id: "quick-commerce",
    name: "Quick Commerce Dark Stores",
    tag: "Retail & Consumer",
    question:
      "Analyze dark store unit economics, delivery partner retention costs, and grocery vs non-grocery margin expansion across Blinkit, Zepto, and Swiggy Instamart through 2027.",
    market: "Quick Commerce & Instant Logistics",
    geography: "India (Top 20 Metros)",
    timeRange: "2025-2028",
    focus: ["Dark Store EBITDA", "Average Order Value (₹)", "Delivery Fleet Costs", "Ad Monetization"],
  },
  {
    id: "semiconductor-ism",
    name: "India Semiconductor Mission",
    tag: "DeepTech & OSAT",
    question:
      "Evaluate the progress of the India Semiconductor Mission (ISM), fab construction milestones across Tata Electronics and Micron, and OSAT packaging supply chain readiness through 2030.",
    market: "Semiconductor Fabrication & OSAT",
    geography: "India (Gujarat, Assam, Tamil Nadu)",
    timeRange: "Vision 2030",
    focus: ["ISM Fiscal Incentives", "OSAT Packaging", "Industrial Water & Power", "Talent Pipeline"],
  },
  {
    id: "renewables-hydrogen",
    name: "Green Hydrogen & 500 GW Target",
    tag: "Energy & Infrastructure",
    question:
      "Assess India's target of 500 GW non-fossil power capacity by 2030, ISTS waiver phase-out impact, and National Green Hydrogen Mission bidding economics across Adani, Reliance, and NTPC.",
    market: "Renewable Energy & Green Power",
    geography: "India (Pan-India)",
    timeRange: "Vision 2030",
    focus: ["Solar & Wind PPA Tariffs", "Green Hydrogen Mission", "Grid Transmission (ISTS)", "Battery Storage BESS"],
  },
  {
    id: "gcc-enterprise-ai",
    name: "Indian GCCs & Enterprise AI",
    tag: "IT & Digital Services",
    question:
      "How are Global Capability Centers (GCCs) in India transitioning from cost centers to generative AI innovation hubs, and what is the impact on Tier-1 IT services billing models through 2028?",
    market: "IT Services & Global Capability Centers",
    geography: "India (Bengaluru, Hyderabad, Pune, NCR)",
    timeRange: "2025-2028",
    focus: ["GCC Expansion", "IT Services Margins", "GenAI Headcount Shift", "Enterprise Billing Rates"],
  },
];

const SUGGESTED_FOCUS_TAGS = [
  "RBI / SEBI Compliance",
  "PLI Scheme Subsidies",
  "Unit Economics (₹)",
  "Dark Store Density",
  "Tier-2/3 Adoption",
  "UPI Integration",
  "Supply Chain Localization",
  "Export Competitiveness",
];

const TIME_RANGES = ["Next 12 Mos", "FY 2025-26", "2025-2028", "Vision 2030"];

export function ResearchForm({ onJobCreated }: ResearchFormProps) {
  const [question, setQuestion] = useState("");
  const [market, setMarket] = useState("");
  const [geography, setGeography] = useState("India (Pan-India)");
  const [timeRange, setTimeRange] = useState("2025-2028");
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
      {/* ─── Example Topics ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#FCF1D0]" />
            <span className="text-xs font-semibold text-[#FCF1D0] tracking-wide">
              Example Market Topics
            </span>
          </div>
          <span className="text-xs text-slate-400">Click one to get started</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {TEMPLATES.map((t) => {
            const isSelected = selectedTemplateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`p-3 rounded-xl text-left border transition-all duration-200 cursor-pointer flex flex-col justify-between h-22 ${
                  isSelected
                    ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0] shadow-sm"
                    : "bg-[#0D1C42] border-[#22396F] hover:bg-[#142554] text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#010736] text-[#FCF1D0] border border-[#22396F]">
                    {t.tag}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#FCF1D0]" />}
                </div>
                <span className="text-xs font-medium line-clamp-2 leading-tight">
                  {t.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Inquiry Card ───────────────────────────────── */}
      <div className="bg-[#0D1C42] border border-[#22396F] p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
        <div className="border-b border-[#22396F] pb-4">
          <h2 className="text-lg font-bold text-[#FCF1D0] flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#FCF1D0]" />
            Ask Your Market Question
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Enter a market, industry, or competitive question below to get verified research.
          </p>
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
                className="text-xs font-medium text-slate-200"
              >
                What do you want to learn? *
              </label>
              <span className="text-xs text-slate-400">
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
              placeholder="e.g. What is the commercialization timeline, costs, and market readiness of solid-state lithium batteries through 2030?"
              className="w-full px-4 py-3 rounded-xl bg-[#010736] border border-[#22396F] focus:border-[#FCF1D0] text-white placeholder-slate-400 text-sm transition outline-none resize-none"
            />
          </div>

          {/* Market & Geography Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="target_market"
                className="text-xs font-medium text-slate-200 flex items-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5 text-[#FCF1D0]" />
                Target Market or Industry *
              </label>
              <input
                id="target_market"
                type="text"
                required
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="e.g. Electric Vehicles & Energy Storage"
                className="w-full px-4 py-2.5 rounded-xl bg-[#010736] border border-[#22396F] focus:border-[#FCF1D0] text-white placeholder-slate-400 text-sm transition outline-none"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="geography"
                className="text-xs font-medium text-slate-200 flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-[#FCF1D0]" />
                Region / Geographic Scope
              </label>
              <input
                id="geography"
                type="text"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="e.g. Global, North America, Europe"
                className="w-full px-4 py-2.5 rounded-xl bg-[#010736] border border-[#22396F] focus:border-[#FCF1D0] text-white placeholder-slate-400 text-sm transition outline-none"
              />
            </div>
          </div>

          {/* Time Horizon Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#FCF1D0]" />
              Time Period
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    timeRange === r
                      ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                      : "bg-[#010736] border-[#22396F] text-slate-300 hover:text-white hover:border-slate-500"
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
                className="px-3 py-1.5 rounded-lg bg-[#010736] border border-[#22396F] text-xs text-white placeholder-slate-400 focus:border-[#FCF1D0] outline-none w-44"
              />
            </div>
          </div>

          {/* Focus Areas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="focus_input"
                className="text-xs font-medium text-slate-200 flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-[#FCF1D0]" />
                Key Focus Topics (Optional)
              </label>
              <span className="text-xs text-slate-400">Press Enter to add</span>
            </div>

            {/* Existing tags */}
            {focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#010736] border border-[#22396F] text-[#FCF1D0]"
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
                placeholder="Add a topic (e.g. Supply Chain, Regulations, Cost)"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#010736] border border-[#22396F] focus:border-[#FCF1D0] text-white placeholder-slate-400 text-sm transition outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddFocus()}
                disabled={!focusInput.trim() || focusAreas.length >= 8}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#22396F] hover:bg-[#2d4c94] border border-[#22396F] text-[#FCF1D0] disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-slate-400 mr-1">Suggestions:</span>
              {SUGGESTED_FOCUS_TAGS.map((tag) => {
                const isAdded = focusAreas.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={isAdded || focusAreas.length >= 8}
                    onClick={() => handleAddFocus(tag)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition cursor-pointer ${
                      isAdded
                        ? "opacity-30 border-[#22396F] text-slate-500 cursor-not-allowed"
                        : "border-[#22396F] bg-[#010736] text-slate-300 hover:text-[#FCF1D0] hover:border-[#FCF1D0]"
                    }`}
                  >
                    + {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-[#22396F] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FCF1D0]" />
              <span>Verified with live sources and real market data.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-md active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#010736]" />
                  <span>Researching Market...</span>
                </>
              ) : (
                <>
                  <span>Generate Research Report</span>
                  <ArrowRight className="w-4 h-4 text-[#010736]" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
