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
    entity: "Tesla",
    ticker: "TSLA",
    topic: "Tesla Robotaxi Fleet Commercialization & 4680 In-House Yield Scaling",
    focus: "Manufacturing Yield & Autonomous Safety",
  },
  {
    entity: "CrowdStrike",
    ticker: "CRWD",
    topic: "CrowdStrike Single-Kernel Sensor Outage Resilience Post-Channel 291",
    focus: "Kernel Architecture & Warranty Liabilities",
  },
  {
    entity: "Rivian",
    ticker: "RIVN",
    topic: "Rivian Commercial Van Dual-Sourcing & R2 Architecture Capex Run-Rate",
    focus: "Capital Expenditure & Dual-Sourcing",
  },
  {
    entity: "QuantumScape",
    ticker: "QS",
    topic: "Solid-State Ceramic Sintering Roll-to-Roll Yield Viability at Scale",
    focus: "Roll-to-Roll Micro-Cracking & Energy Density",
  },
];

export function DialecticDebateWorkspace() {
  const [debatesList, setDebatesList] = useState<DebateListItem[]>([]);
  const [activeDebate, setActiveDebate] = useState<DebateDetailResponse | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [targetEntity, setTargetEntity] = useState("Tesla");
  const [targetTopic, setTargetTopic] = useState(
    "Tesla Robotaxi Fleet Commercialization & 4680 In-House Yield Scaling"
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
    } catch (err: any) {
      setError(err?.message || "Failed to load dialectic debates.");
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
    } catch (err: any) {
      setError(err?.message || "Failed to fetch debate transcript.");
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
    } catch (err: any) {
      setError(err?.message || "Failed to execute dialectic debate session.");
    } finally {
      setIsDebating(false);
    }
  };

  const getVerdictBadge = (verdict?: ArbiterVerdictType | null) => {
    switch (verdict) {
      case "STRONG_BUY":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/10">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            STRONG BUY
          </span>
        );
      case "STRATEGIC_ACCUMULATE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-500/10">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            STRATEGIC ACCUMULATE
          </span>
        );
      case "NEUTRAL_HOLD":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10">
            <Scale className="w-4 h-4 text-amber-400" />
            NEUTRAL HOLD
          </span>
        );
      case "DEFENSIVE_HEDGE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 border border-orange-500/50 text-orange-300 shadow-md shadow-orange-500/10">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            DEFENSIVE HEDGE
          </span>
        );
      case "DIVEST_AVOID":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 border border-rose-500/50 text-rose-300 shadow-md shadow-rose-500/10">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            DIVEST / AVOID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
            DELIBERATING
          </span>
        );
    }
  };

  // Filter messages for current selected round
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 mb-2">
            <Swords className="w-3.5 h-3.5 text-indigo-400" />
            <span>Adversarial Dialectic Reasoning Engine Online</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-indigo-900 text-indigo-300">
              Stage 10
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
            Multi-Agent Cross-Vector Debate Arena
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Specialized autonomous personas (Bull Growth Specialist, Bear Risk Officer, and Regulatory Auditor)
            subject strategic hypotheses to rigorous multi-round adversity before the Principal Arbiter renders an institutional verdict.
          </p>
        </div>

        {/* Quick Launch CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLaunchDebate}
            disabled={isDebating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-600/25 transition cursor-pointer disabled:opacity-50"
          >
            {isDebating ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{isDebating ? "Agents Deliberating..." : "Execute Dialectic Debate"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Target & Topic Configuration Drawer ───────────── */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          <div className="w-full lg:w-48">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Target Entity
            </label>
            <input
              type="text"
              value={targetEntity}
              onChange={(e) => setTargetEntity(e.target.value)}
              placeholder="e.g. Tesla, CrowdStrike"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Strategic Thesis / Debate Topic
            </label>
            <input
              type="text"
              value={targetTopic}
              onChange={(e) => setTargetTopic(e.target.value)}
              placeholder="e.g. Robotaxi Fleet Commercialization & 4680 In-House Yield Scaling"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="w-full lg:w-36">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Rounds Count
            </label>
            <select
              value={roundsCount}
              onChange={(e) => setRoundsCount(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value={2}>2 Rounds (Expedited)</option>
              <option value={3}>3 Rounds (Standard)</option>
              <option value={4}>4 Rounds (Deep Audit)</option>
            </select>
          </div>
        </div>

        {/* Quick Suggested Scenarios */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Institutional Catalysts:
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
                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-200"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span className="font-bold text-slate-300">{item.entity}</span>
              <span className="text-[10px] font-mono text-slate-500">[{item.ticker}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Active Debate Overview Card ────────────────────────── */}
      {activeDebate && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          {/* Top Verdict & Scorecard Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Entity: {activeDebate.entity_name}
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-500">
                  {activeDebate.rounds_count} Multi-Agent Rounds Concluded
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-100 tracking-tight">
                {activeDebate.topic}
              </h2>
            </div>

            {/* Verdict & Conviction Meters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="glass-panel px-4 py-2.5 rounded-xl border border-slate-800 text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Conviction Score
                </span>
                <div className="text-xl font-extrabold text-cyan-300 font-mono">
                  {activeDebate.conviction_score
                    ? `${(activeDebate.conviction_score * 100).toFixed(0)}%`
                    : "N/A"}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Arbiter Decision Verdict
                </span>
                {getVerdictBadge(activeDebate.arbiter_verdict)}
              </div>

              {/* Stage 11 Export Dossier Trigger */}
              <button
                onClick={() => setIsDossierOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 hover:border-emerald-500/60 transition shadow-sm cursor-pointer"
                title="Export SHA-256 Verified Executive Dossier"
              >
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Export Dossier (SHA-256)</span>
              </button>
            </div>
          </div>

          {/* 3-Vector Balance Gauge Bar */}
          {activeDebate.synthesis_matrix && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Bull Expansion Vector
                  </span>
                  <span className="font-mono text-sm font-extrabold text-emerald-300">
                    {(activeDebate.synthesis_matrix.bull_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeDebate.synthesis_matrix.bull_score * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Bear Operational Risk
                  </span>
                  <span className="font-mono text-sm font-extrabold text-rose-300">
                    {(activeDebate.synthesis_matrix.bear_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeDebate.synthesis_matrix.bear_score * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    Regulatory Exposure Surface
                  </span>
                  <span className="font-mono text-sm font-extrabold text-amber-300">
                    {(activeDebate.synthesis_matrix.regulatory_risk_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${activeDebate.synthesis_matrix.regulatory_risk_score * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Executive Takeaway Banner */}
          {activeDebate.executive_summary && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-xs text-slate-300 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5" />
                Principal Arbiter Executive Synthesis
              </div>
              <p className="leading-relaxed text-slate-200">
                {activeDebate.executive_summary}
              </p>
            </div>
          )}

          {/* ─── Dialectic Round Navigator ───────────────────────── */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 w-fit">
            <button
              onClick={() => setSelectedRound(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedRound === 1
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Round 1: Opening Thesis</span>
            </button>

            {activeDebate.rounds_count >= 2 && (
              <button
                onClick={() => setSelectedRound(2)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedRound === 2
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
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
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Round 3: Regulatory Scrutiny</span>
              </button>
            )}

            <button
              onClick={() => setSelectedRound(99)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedRound === 99
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30"
                  : "text-purple-400 hover:text-purple-300"
              }`}
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>Arbitration Matrix & Tripwires</span>
            </button>
          </div>

          {/* ─── Round Arena Display ─────────────────────────────── */}
          {selectedRound === 99 ? (
            /* Final Decision Matrix & Tripwires View */
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 bg-purple-950/10 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-extrabold text-slate-100">
                      Arbiter Synthesis Matrix & Vector Balance
                    </h3>
                  </div>
                  {getVerdictBadge(activeDebate.arbiter_verdict)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Primary Growth Catalyst
                    </span>
                    <p className="text-xs font-semibold text-slate-200">
                      {activeDebate.synthesis_matrix?.primary_growth_vector}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                      Primary Operational Bottleneck
                    </span>
                    <p className="text-xs font-semibold text-slate-200">
                      {activeDebate.synthesis_matrix?.primary_vulnerability}
                    </p>
                  </div>
                </div>

                {/* Conditional Risk Tripwires */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Mandatory Conditional Risk Tripwires
                  </span>
                  <div className="space-y-2">
                    {activeDebate.synthesis_matrix?.tripwires?.map((tw, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5"
                      >
                        <span className="font-mono font-bold text-amber-400">
                          [Tripwire {idx + 1}]
                        </span>
                        <span>{tw}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Arbiter Speech */}
              {arbiterMessage && (
                <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center font-bold text-indigo-300 text-xs">
                        AC
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          {arbiterMessage.agent_name}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-400">
                          ROLE: PRINCIPAL ARBITER • CONVICTION: {(arbiterMessage.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {arbiterMessage.content}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Split Dual-Agent Arena View for Rounds 1, 2, 3 */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bull Specialist Column */}
              {bullMessage && (
                <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center font-bold text-emerald-300 text-xs">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">
                            {bullMessage.agent_name}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                            GROWTH & EXPANSION SPECIALIST
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-mono">Confidence</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {(bullMessage.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {bullMessage.content}
                    </div>
                  </div>

                  {/* Empirical Citations */}
                  {bullMessage.evidence_citations && bullMessage.evidence_citations.length > 0 && (
                    <div className="pt-3 border-t border-emerald-500/20 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-emerald-400" />
                        Commercial Signals Cited:
                      </span>
                      <div className="space-y-1.5">
                        {bullMessage.evidence_citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-slate-900 border border-emerald-500/20 text-[11px] text-slate-300 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{cite.title}</span>
                            {cite.url && (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 flex-shrink-0"
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

              {/* Bear Risk Officer Column */}
              {bearMessage && (
                <div className="glass-panel p-5 rounded-2xl border border-rose-500/30 bg-rose-950/5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center font-bold text-rose-300 text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">
                            {bearMessage.agent_name}
                          </span>
                          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider">
                            CHIEF RISK OFFICER
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block font-mono">Confidence</span>
                        <span className="text-xs font-mono font-bold text-rose-400">
                          {(bearMessage.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {bearMessage.content}
                    </div>
                  </div>

                  {/* Statutory SEC 10-K Citations */}
                  {bearMessage.evidence_citations && bearMessage.evidence_citations.length > 0 && (
                    <div className="pt-3 border-t border-rose-500/20 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                        <Scale className="w-3 h-3 text-rose-400" />
                        Statutory 10-K Disclosures Cited:
                      </span>
                      <div className="space-y-1.5">
                        {bearMessage.evidence_citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-slate-900 border border-rose-500/20 text-[11px] text-slate-300 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{cite.title}</span>
                            {cite.url && (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-rose-400 hover:text-rose-300 flex-shrink-0"
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

              {/* Regulatory Auditor Column (Round 3 only) */}
              {selectedRound === 3 && regulatoryMessage && (
                <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center font-bold text-amber-300 text-xs">
                        <Scale className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          {regulatoryMessage.agent_name}
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                          REGULATORY COMPLIANCE & EMPIRICAL AUDITOR
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block font-mono">Confidence</span>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {(regulatoryMessage.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {regulatoryMessage.content}
                  </div>

                  {regulatoryMessage.evidence_citations && regulatoryMessage.evidence_citations.length > 0 && (
                    <div className="pt-3 border-t border-amber-500/20 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-amber-400" />
                        Statutory Filings & arXiv Preprints Audited:
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {regulatoryMessage.evidence_citations.map((cite, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-slate-900 border border-amber-500/20 text-[11px] text-slate-300 flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{cite.title}</span>
                            {cite.url && (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-400 hover:text-amber-300 flex-shrink-0"
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

      {/* ─── Recent Debates Archive Drawer ──────────────────── */}
      {debatesList.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-400" />
              Concluded Dialectic Debates ({debatesList.length})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {debatesList.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelectDebate(d.id)}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  activeDebate?.id === d.id
                    ? "bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-600/10"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
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

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
                  <span>{d.rounds_count} Rounds</span>
                  <span>Conviction: {d.conviction_score ? `${(d.conviction_score * 100).toFixed(0)}%` : "N/A"}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Executive Intelligence Dossier & Governance Audit Modal */}
      <ExecutiveDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        defaultEntity={activeDebate?.entity_name || targetEntity}
        defaultDebateId={activeDebate?.id}
      />
    </div>
  );
}
