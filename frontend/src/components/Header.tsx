"use client";

import React, { useEffect, useState } from "react";
import { checkBackendHealth } from "@/lib/api";
import { Activity, Clock, Layers, Sparkles } from "lucide-react";

interface HeaderProps {
  onNewInquiryClick: () => void;
  onRecentClick: () => void;
  activeJobId: string | null;
}

export function Header({
  onNewInquiryClick,
  onRecentClick,
  activeJobId,
}: HeaderProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

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

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={onNewInquiryClick}
          className="flex items-center gap-3 cursor-pointer group"
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
            <p className="text-xs text-slate-400">
              Distributed Market Intelligence Platform
            </p>
          </div>
        </div>

        {/* Right Nav */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Backend Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">System:</span>
            {isHealthy === null ? (
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                Connecting...
              </span>
            ) : isHealthy ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Operational
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Disconnected
              </span>
            )}
          </div>

          {/* Past Jobs button */}
          <button
            onClick={onRecentClick}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Recent Jobs</span>
          </button>

          {/* New Inquiry Button */}
          <button
            onClick={onNewInquiryClick}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Research Inquiry</span>
          </button>
        </div>
      </div>
    </header>
  );
}
