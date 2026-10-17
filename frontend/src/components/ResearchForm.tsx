"use client";

import React, { useState } from "react";
import { JobCreateRequest, JobDetailResponse } from "@/types/api";
import { createJob } from "@/lib/api";
import {
  ArrowRight,
  Compass,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Target,
  X,
} from "lucide-react";

interface ResearchFormProps {
  onJobCreated: (job: JobDetailResponse) => void;
}

const TEMPLATES = [
  {
    name: "Solid-State Batteries",
    question:
      "What is the commercialization timeline, manufacturing cost parity with LFP, and supply chain readiness of solid-state lithium batteries through 2030?",
    market: "Energy Storage & Electric Vehicles",
    geography: "Global (North America & APAC)",
    timeRange: "2024-2030",
    focus: ["Capex Parity", "Electrolyte Durability", "Automaker MOUs"],
  },
  {
    name: "Supersonic Commercial Flight",
    question:
      "Assess the market feasibility, fuel economics, and sonic boom regulatory framework for passenger supersonic commercial aircraft.",
    market: "Commercial Aerospace",
    geography: "Transatlantic & Transpacific Routes",
    timeRange: "2025-2032",
    focus: ["FAA Noise Standards", "Sustainable Aviation Fuel", "Business Class Pricing"],
  },
  {
    name: "AI Code Synthesis in Enterprise",
    question:
      "Analyze enterprise adoption velocity, security IP concerns, and displacement of legacy offshore development by agentic AI coding platforms.",
    market: "Enterprise Software & DevTools",
    geography: "North America & Europe",
    timeRange: "2024-2027",
    focus: ["SOC2 Compliance", "Productivity Gains", "Seat Pricing"],
  },
];

export function ResearchForm({ onJobCreated }: ResearchFormProps) {
  const [question, setQuestion] = useState("");
  const [market, setMarket] = useState("");
  const [geography, setGeography] = useState("Global");
  const [timeRange, setTimeRange] = useState("2024-2030");
  const [focusInput, setFocusInput] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (t: (typeof TEMPLATES)[0]) => {
    setQuestion(t.question);
    setMarket(t.market);
    setGeography(t.geography);
    setTimeRange(t.timeRange);
    setFocusAreas(t.focus);
    setError(null);
  };

  const handleAddFocus = () => {
    const trimmed = focusInput.trim();
    if (trimmed && !focusAreas.includes(trimmed) && focusAreas.length < 8) {
      setFocusAreas([...focusAreas, trimmed]);
      setFocusInput("");
    }
  };

  const handleRemoveFocus = (tag: string) => {
    setFocusAreas(focusAreas.filter((f) => f !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 10) {
      setError("Research question must be at least 10 characters long.");
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
      time_range: timeRange.trim(),
      focus_areas: focusAreas,
    };

    try {
      const job = await createJob(payload);
      onJobCreated(job);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to submit research job."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Template Quick Starts */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Quick-Start Intelligence Templates
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => applyTemplate(t)}
              className="text-left p-3.5 rounded-xl glass-card hover:bg-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-200 group-hover:text-cyan-300">
                  {t.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{t.question}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Inquiry Form Card */}
      <form
        onSubmit={handleSubmit}
        className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2 flex items-center justify-between">
              <span>Market Research Inquiry</span>
              <span className="text-xs font-normal text-slate-400">
                Decomposes into 4 orthogonal distributed vectors
              </span>
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Analyze the commercial viability, competitive moats, and regulatory landscape of autonomous eVTOL urban air mobility in the EU..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm outline-none transition-all resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                Target Market Sector
              </label>
              <input
                type="text"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="e.g. Clean Energy / Battery Storage"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                Geographic Scope
              </label>
              <input
                type="text"
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="e.g. North America, Global, EU"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                Temporal Scope
              </label>
              <input
                type="text"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                placeholder="e.g. 2024-2030"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-slate-100 placeholder-slate-500 text-sm outline-none transition-all"
              />
            </div>
          </div>

          {/* Focus Areas Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              Priority Focus Areas (Optional)
            </label>
            <div className="flex gap-2 mb-2.5">
              <input
                type="text"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddFocus();
                  }
                }}
                placeholder="Add a priority topic and press Enter (e.g. Supply Chain, IP Protection)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 focus:border-cyan-500 text-slate-100 placeholder-slate-500 text-xs outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleAddFocus}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {focusAreas.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveFocus(tag)}
                      className="hover:text-cyan-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Dispatches parallel tasks via RabbitMQ with worker OCC versioning
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Decomposing & Enqueuing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Multi-Agent Research</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
