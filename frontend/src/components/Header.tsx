"use client";

import React, { useEffect, useState } from "react";
import { checkBackendHealth } from "@/lib/api";
import {
  Activity,
  BarChart3,
  Bell,
  Clock,
  Compass,
  Layers,
  Radio,
  Sparkles,
  Target,
} from "lucide-react";
import { TelemetryModal } from "@/components/TelemetryModal";

export type NavigationTab =
  | "research"
  | "actions"
  | "dashboard"
  | "pulse"
  | "watchlists";

interface HeaderProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onNewInquiryClick: () => void;
  onRecentClick: () => void;
  activeJobId: string | null;
}

export function Header({
  currentTab,
  onTabChange,
  onNewInquiryClick,
  onRecentClick,
  activeJobId,
}: HeaderProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await checkBackendHealth();
        if (mounted) setIsHealthy(res.status === "healthy");
      } catch {
        if (mounted) setIsHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Global keyboard shortcuts (Cmd+K for Recent, N for new inquiry)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onRecentClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRecentClick]);

  return (
    <>
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-4 sm:px-6 py-3.5 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div
            onClick={onNewInquiryClick}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-violet-500 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold bg-gradient-to-r from-slate-100 via-slate-200 to-cyan-300 bg-clip-text text-transparent">
                  Stratify AI
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                  Multi-Agent
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Distributed Market Intelligence Platform
              </p>
            </div>
          </div>

          {/* Navigation Pill Switcher (Stratify AI 2.0 Core Pillars) */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-md">
            {[
              { id: "research", label: "Research Core", icon: Compass },
              { id: "actions", label: "Action Intel", icon: Target },
              { id: "dashboard", label: "Dashboard", icon: BarChart3 },
              { id: "pulse", label: "Market Pulse", icon: Radio },
              { id: "watchlists", label: "Watchlists", icon: Bell },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = currentTab === id;
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id as NavigationTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-cyan-400" : "text-slate-400"
                    }`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Backend Status & Telemetry Button */}
            <button
              onClick={() => setIsTelemetryOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs transition group cursor-pointer"
              title="Click to view live architecture telemetry"
            >
              <Activity className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              <span className="text-slate-400 hidden md:inline">Cluster:</span>
              {isHealthy === null ? (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                  Connecting...
                </span>
              ) : isHealthy ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                  Operational
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Disconnected
                </span>
              )}
            </button>

            {/* Past Jobs button with Cmd+K hint */}
            <button
              onClick={onRecentClick}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all cursor-pointer"
              title="Recent Inquiries (⌘K)"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Recent Inquiries</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* New Inquiry Button */}
            <button
              onClick={onNewInquiryClick}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Inquiry</span>
            </button>
          </div>
        </div>
      </header>

      {/* Architecture & Telemetry Modal */}
      <TelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
      />
    </>
  );
}
