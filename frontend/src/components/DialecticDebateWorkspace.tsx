"use client";

import React, { useEffect, useState } from "react";
import {
  fetchDebateDetail,
  fetchDebates,
  initiateDebate,
} from "@/lib/api";
import {
  AgentDebateRoleType,
  ArbiterVerdictType,
  ArgumentType,
  DebateDetailResponse,
  DebateListItem,
  DebateMessageItem,
} from "@/types/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  FileCheck2,
  Flame,
  Gavel,
  History,
  Layers,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { ExecutiveDossierModal } from "@/components/ExecutiveDossierModal";

const SUGGESTED_DEBATES = [
  {
    entity: "Tata Motors",
    ticker: "TATAMOTORS",
    topic: "Tata Motors EV Passenger Fleet Dominance vs Mahindra Born-Electric SUVs",
    focus: "Battery Localization, PLI Subsidies & Commercial Fleet Margin",
  },
  {
    entity: "Reliance Jio",
    ticker: "RELIANCE",
    topic: "Jio 5G Fixed Wireless Monetization vs Bharti Airtel Premium ARPU",
    focus: "Network Capex, FWA Adoption & Enterprise Cloud Services",
  },
  {
    entity: "Zomato / Blinkit",
    ticker: "ZOMATO",
    topic: "Quick Commerce 10-Minute Dark Store Expansion vs Tier-2 Unit Economics",
    focus: "Dark Store Density, Take-Rates & Delivery Partner Retention",
  },
  {
    entity: "HDFC Bank",
    ticker: "HDFCBANK",
    topic: "Post-Merger Deposit Mobilization vs Loan-to-Deposit Ratio Normalization",
    focus: "Net Interest Margins, Branch Expansion & Credit Underwriting",
  },
];

export function DialecticDebateWorkspace() {
  const [debatesList, setDebatesList] = useState<DebateListItem[]>([]);
  const [activeDebate, setActiveDebate] = useState<DebateDetailResponse | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [targetEntity, setTargetEntity] = useState("Tata Motors");
  const [targetTopic, setTargetTopic] = useState(
    "Tata Motors EV Passenger Fleet Dominance vs Mahindra Born-Electric SUVs"
  );
  const [roundsCount, setRoundsCount] = useState<number>(3);
  const [isLoading, setIsLoading] = useState(false);
  const [isDebating, setIsDebating] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDebates = async (entity?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchDebates(entity);
      setDebatesList(res.debates || []);
      if (res.debates && res.debates.length > 0 && !activeDebate) {
        const firstDetail = await fetchDebateDetail(res.debates[0].id);
        setActiveDebate(firstDetail);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load debates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDebates();
  }, []);

  const handleSelectDebate = async (debateId: string) => {
    setIsLoading(true);
    try {
      const detail = await fetchDebateDetail(debateId);
      setActiveDebate(detail);
      setSelectedRound(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch debate transcript.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchDebate = async () => {
    if (!targetTopic.trim() || !targetEntity.trim()) return;
    setIsDebating(true);
    setError(null);
    try {
      const res = await initiateDebate({
        topic: targetTopic.trim(),
        entity_name: targetEntity.trim(),
        rounds_count: roundsCount,
      });
      setActiveDebate(res);
      setSelectedRound(1);
      await loadDebates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute debate session.");
    } finally {
      setIsDebating(false);
    }
  };

  const getVerdictBadge = (verdict?: ArbiterVerdictType | null) => {
    switch (verdict) {
      case "STRONG_BUY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#22396F] text-[#FCF1D0]">
            <TrendingUp className="w-3.5 h-3.5 text-[#FCF1D0]" />
            FAVORABLE OUTLOOK
          </span>
        );
      case "STRATEGIC_ACCUMULATE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#22396F] text-[#FCF1D0]">
            <Sparkles className="w-3.5 h-3.5 text-[#FCF1D0]" />
            POSITIVE OUTLOOK
          </span>
        );
      case "NEUTRAL_HOLD":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#010736] border border-[#22396F] text-slate-200">
            <Scale className="w-3.5 h-3.5 text-[#FCF1D0]" />
            BALANCED OUTLOOK
          </span>
        );
      case "DEFENSIVE_HEDGE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#010736] border border-[#22396F] text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
            CAUTIOUS OUTLOOK
          </span>
        );
      case "DIVEST_AVOID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950/80 border border-rose-500/30 text-rose-300">
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            HIGH RISK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#010736] border border-[#22396F] text-slate-300">
            DELIBERATING
          </span>
        );
    }
  };

  const currentRoundMessages = activeDebate?.messages.filter(
    (m) => m.round_number === selectedRound
  ) || [];

  const bullMessage = currentRoundMessages.find(
    (m) => m.agent_role === "BULL_SPECIALIST"
  );
  const bearMessage = currentRoundMessages.find(
    (m) => m.agent_role === "BEAR_RISK_OFFICER"
  );
  const regulatoryMessage = currentRoundMessages.find(
    (m) => m.agent_role === "REGULATORY_AUDITOR"
  );
  const arbiterMessage = activeDebate?.messages.find(
    (m) => m.agent_role === "PRINCIPAL_ARBITER"
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── Header & Arena Title ────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#22396F]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#0D1C42] border border-[#22396F] text-[#FCF1D0] mb-2">
            <Swords className="w-3.5 h-3.5 text-[#FCF1D0]" />
            <span>AI Pro vs Con Analysis</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FCF1D0] tracking-tight">
            AI Debate: Opportunity vs Risk
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-3xl">
            Two AI perspectives debate the growth opportunities and risk factors of an investment or strategy, giving you a clear, balanced conclusion.
          </p>
        </div>

        {/* Quick Launch CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLaunchDebate}
            disabled={isDebating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isDebating ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#010736]" />
            ) : (
              <Play className="w-4 h-4 fill-[#010736] text-[#010736]" />
            )}
            <span>{isDebating ? "Debating..." : "Start AI Debate"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Target & Topic Configuration Drawer ───────────── */}
      <div className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          <div className="w-full lg:w-48">
            <label className="text-xs font-medium text-slate-200 block mb-1">
              Company or Target
            </label>
            <input
              type="text"
              value={targetEntity}
              onChange={(e) => setTargetEntity(e.target.value)}
              placeholder="e.g. Tesla, CrowdStrike"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#010736] border border-[#22396F] text-white text-xs focus:outline-none focus:border-[#FCF1D0]"
            />
          </div>

          <div className="flex-1">
            <label className="text-xs font-medium text-slate-200 block mb-1">
              Debate Question or Topic
            </label>
            <input
              type="text"
              value={targetTopic}
              onChange={(e) => setTargetTopic(e.target.value)}
              placeholder="e.g. Robotaxi commercialization timeline & battery manufacturing capacity"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#010736] border border-[#22396F] text-white text-xs focus:outline-none focus:border-[#FCF1D0]"
            />
          </div>

          <div className="w-full lg:w-36">
            <label className="text-xs font-medium text-slate-200 block mb-1">
              Debate Depth
            </label>
            <select
              value={roundsCount}
              onChange={(e) => setRoundsCount(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-[#010736] border border-[#22396F] text-white text-xs focus:outline-none focus:border-[#FCF1D0]"
            >
              <option value={2}>2 Rounds (Quick)</option>
              <option value={3}>3 Rounds (Standard)</option>
              <option value={4}>4 Rounds (In-Depth)</option>
            </select>
          </div>
        </div>

        {/* Quick Suggested Scenarios */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#22396F]">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-[#FCF1D0]" />
            Examples:
          </span>
          {SUGGESTED_DEBATES.map((item) => (
            <button
              key={item.entity}
              onClick={() => {
                setTargetEntity(item.entity);
                setTargetTopic(item.topic);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer border flex items-center gap-1.5 ${
                targetEntity.toLowerCase() === item.entity.toLowerCase()
                  ? "bg-[#22396F] border-[#FCF1D0] text-[#FCF1D0]"
                  : "bg-[#010736] border-[#22396F] text-slate-300 hover:text-white"
              }`}
            >
              <span className="font-semibold text-[#FCF1D0]">{item.entity}</span>
              <span className="text-[10px] font-mono text-slate-400">[{item.ticker}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Active Debate Overview Card ────────────────────────── */}
      {activeDebate && (
        <div className="bg-[#0D1C42] p-6 rounded-2xl border border-[#22396F] space-y-6">
          {/* Top Verdict & Scorecard Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#22396F]">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Target: {activeDebate.entity_name}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-400">
                  {activeDebate.rounds_count} Rounds Completed
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {activeDebate.topic}
              </h2>
            </div>

            {/* Verdict & Meters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-[#010736] px-4 py-2.5 rounded-xl border border-[#22396F] text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Confidence Score
                </span>
                <div className="text-xl font-extrabold text-[#FCF1D0] font-mono">
                  {activeDebate.conviction_score
                    ? `${(activeDebate.conviction_score * 100).toFixed(0)}%`
                    : "N/A"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Conclusion
                </span>
                {getVerdictBadge(activeDebate.arbiter_verdict)}
              </div>

              <button
                onClick={() => setIsDossierOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#FCF1D0] bg-[#22396F] hover:bg-[#2d4c94] border border-[#22396F] transition shadow-sm cursor-pointer"
                title="Export Research Report"
              >
                <FileCheck2 className="w-4 h-4 text-[#FCF1D0]" />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* Balance Gauges */}
          {activeDebate.synthesis_matrix && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-[#010736] border border-[#22396F] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FCF1D0] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#FCF1D0]" />
                    Growth Potential
                  </span>
                  <span className="font-mono text-sm font-extrabold text-[#FCF1D0]">
                    {(activeDebate.synthesis_matrix.bull_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-[#0D1C42] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#FCF1D0] h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeDebate.synthesis_matrix.bull_score * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#010736] border border-[#22396F] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Operational Risk
                  </span>
                  <span className="font-mono text-sm font-extrabold text-rose-300">
                    {(activeDebate.synthesis_matrix.bear_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-[#0D1C42] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeDebate.synthesis_matrix.bear_score * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#010736] border border-[#22396F] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    Regulatory Exposure
                  </span>
                  <span className="font-mono text-sm font-extrabold text-amber-300">
                    {(activeDebate.synthesis_matrix.regulatory_risk_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-[#0D1C42] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeDebate.synthesis_matrix.regulatory_risk_score * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Executive Summary Banner */}
          {activeDebate.executive_summary && (
            <div className="p-4 rounded-xl bg-[#010736] border border-[#22396F] text-xs text-slate-300 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#FCF1D0] flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5 text-[#FCF1D0]" />
                AI Analysis & Decision Summary
              </div>
              <p className="leading-relaxed text-slate-200">
                {activeDebate.executive_summary}
              </p>
            </div>
          )}

          {/* ─── Dialectic Round Navigator ───────────────────────── */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#010736] border border-[#22396F] w-fit flex-wrap">
            <button
              onClick={() => setSelectedRound(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedRound === 1
                  ? "bg-[#22396F] text-[#FCF1D0]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Round 1: Opening Arguments</span>
            </button>

            {activeDebate.rounds_count >= 2 && (
              <button
                onClick={() => setSelectedRound(2)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedRound === 2
                    ? "bg-[#22396F] text-[#FCF1D0]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Round 2: Cross-Rebuttal</span>
              </button>
            )}

            {activeDebate.rounds_count >= 3 && (
              <button
                onClick={() => setSelectedRound(3)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedRound === 3
                    ? "bg-[#22396F] text-[#FCF1D0]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Round 3: Risk & Regulation</span>
              </button>
            )}

            <button
              onClick={() => setSelectedRound(99)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedRound === 99
                  ? "bg-[#FCF1D0] text-[#010736]"
                  : "text-[#FCF1D0] hover:text-white"
              }`}
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>Final Decision & Risks</span>
            </button>
          </div>

          {/* ─── Round Arena Display ─────────────────────────────── */}
          {selectedRound === 99 ? (
            /* Final Decision & Indicators */
            <div className="space-y-6">
              <div className="bg-[#010736] p-6 rounded-2xl border border-[#22396F] space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#22396F]">
                  <div className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-[#FCF1D0]" />
                    <h3 className="text-base font-bold text-white">
                      Overall Analysis & Summary
                    </h3>
                  </div>
                  {getVerdictBadge(activeDebate.arbiter_verdict)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0D1C42] border border-[#22396F] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FCF1D0]">
                      Primary Growth Catalyst
                    </span>
                    <p className="text-xs font-semibold text-slate-200">
                      {activeDebate.synthesis_matrix?.primary_growth_vector}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0D1C42] border border-[#22396F] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                      Key Risk or Bottleneck
                    </span>
                    <p className="text-xs font-semibold text-slate-200">
                      {activeDebate.synthesis_matrix?.primary_vulnerability}
                    </p>
                  </div>
                </div>

                {/* Risk Indicators to Watch */}
                <div className="p-4 rounded-xl bg-[#0D1C42] border border-[#22396F] space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-300" />
                    Key Risk Indicators to Watch
                  </span>
                  <div className="space-y-2">
                    {activeDebate.synthesis_matrix?.tripwires?.map((tw, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#010736] border border-[#22396F] text-xs text-slate-200 flex items-start gap-2.5"
                      >
                        <span className="font-mono font-bold text-[#FCF1D0]">
                          [Alert {idx + 1}]
                        </span>
                        <span>{tw}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Arbiter Speech */}
              {arbiterMessage && (
                <div className="bg-[#010736] p-6 rounded-2xl border border-[#22396F] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#22396F]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#22396F] flex items-center justify-center font-bold text-[#FCF1D0] text-xs">
                        AI
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          {arbiterMessage.agent_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          CONFIDENCE: {(arbiterMessage.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {arbiterMessage.content}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Split Dual-Perspective Arena View */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pro-Growth Column */}
              {bullMessage && (
                <div className="bg-[#010736] p-5 rounded-2xl border border-[#22396F] space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-[#22396F]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#22396F] flex items-center justify-center font-bold text-[#FCF1D0] text-xs">
                          <TrendingUp className="w-4 h-4 text-[#FCF1D0]" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">
                            {bullMessage.agent_name}
                          </span>
                          <span className="text-[10px] font-mono text-[#FCF1D0] uppercase tracking-wider">
                            OPPORTUNITY & GROWTH PERSPECTIVE
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-mono">Confidence</span>
                        <span className="text-xs font-mono font-bold text-[#FCF1D0]">
                          {(bullMessage.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {bullMessage.content}
                    </div>
                  </div>

                  {bullMessage.evidence_citations && bullMessage.evidence_citations.length > 0 && (
                    <div className="pt-3 border-t border-[#22396F] space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#FCF1D0] flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#FCF1D0]" />
                        Key Sources Cited:
                      </span>
                      <div className="space-y-1.5">
                        {bullMessage.evidence_citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-[#0D1C42] border border-[#22396F] text-[11px] text-slate-300 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{cite.title}</span>
                            {cite.url && (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#FCF1D0] hover:underline flex-shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Risk & Caution Column */}
              {bearMessage && (
                <div className="bg-[#010736] p-5 rounded-2xl border border-[#22396F] space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-[#22396F]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#22396F] flex items-center justify-center font-bold text-rose-300 text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">
                            {bearMessage.agent_name}
                          </span>
                          <span className="text-[10px] font-mono text-rose-300 uppercase tracking-wider">
                            RISK & SCRUTINY PERSPECTIVE
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-mono">Confidence</span>
                        <span className="text-xs font-mono font-bold text-rose-300">
                          {(bearMessage.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {bearMessage.content}
                    </div>
                  </div>

                  {bearMessage.evidence_citations && bearMessage.evidence_citations.length > 0 && (
                    <div className="pt-3 border-t border-[#22396F] space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                        <Scale className="w-3 h-3 text-rose-400" />
                        Official Disclosures Cited:
                      </span>
                      <div className="space-y-1.5">
                        {bearMessage.evidence_citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-[#0D1C42] border border-[#22396F] text-[11px] text-slate-300 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{cite.title}</span>
                            {cite.url && (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-rose-300 hover:underline flex-shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Regulatory Auditor Column (Round 3) */}
              {selectedRound === 3 && regulatoryMessage && (
                <div className="lg:col-span-2 bg-[#010736] p-5 rounded-2xl border border-[#22396F] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#22396F]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#22396F] flex items-center justify-center font-bold text-amber-300 text-xs">
                        <Scale className="w-4 h-4 text-amber-300" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          {regulatoryMessage.agent_name}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 uppercase tracking-wider">
                          REGULATORY COMPLIANCE PERSPECTIVE
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-mono">Confidence</span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {(regulatoryMessage.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {regulatoryMessage.content}
                  </div>

                  {regulatoryMessage.evidence_citations && regulatoryMessage.evidence_citations.length > 0 && (
                    <div className="pt-3 border-t border-[#22396F] space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-amber-300" />
                        Official Sources Audited:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {regulatoryMessage.evidence_citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-[#0D1C42] border border-[#22396F] text-[11px] text-slate-300 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{cite.title}</span>
                            {cite.url && (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-300 hover:underline flex-shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Recent Debates Archive ──────────────────── */}
      {debatesList.length > 0 && (
        <div className="bg-[#0D1C42] p-5 rounded-2xl border border-[#22396F] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#FCF1D0]" />
              Past Debates ({debatesList.length})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {debatesList.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelectDebate(d.id)}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  activeDebate?.id === d.id
                    ? "bg-[#22396F] border-[#FCF1D0]"
                    : "bg-[#010736] border-[#22396F] hover:border-[#FCF1D0]/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">
                      {d.entity_name}
                    </span>
                    {getVerdictBadge(d.arbiter_verdict)}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {d.topic}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#22396F] text-[10px] text-slate-400 font-mono">
                  <span>{d.rounds_count} Rounds</span>
                  <span>Confidence: {d.conviction_score ? `${(d.conviction_score * 100).toFixed(0)}%` : "N/A"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      <ExecutiveDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        defaultEntity={activeDebate?.entity_name || targetEntity}
        defaultDebateId={activeDebate?.id}
      />
    </div>
  );
}
