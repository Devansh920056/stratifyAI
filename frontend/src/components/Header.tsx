"use client";

import React, { useEffect, useState } from "react";
import { checkBackendHealth } from "@/lib/api";
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Clock,
  Compass,
  FileCheck2,
  Layers,
  Menu,
  Radio,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { TelemetryModal } from "@/components/TelemetryModal";
import { SemanticSearchModal } from "@/components/SemanticSearchModal";
import { ExecutiveDossierModal } from "@/components/ExecutiveDossierModal";

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
  const [isSemanticSearchOpen, setIsSemanticSearchOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Global keyboard shortcuts (Cmd+K for Recent, Cmd+S for Semantic Search, Cmd+E for Executive Dossier)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onRecentClick();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsSemanticSearchOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsDossierOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRecentClick]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0D1C42]/95 border-b border-[#22396F] px-4 sm:px-6 py-3 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div
            onClick={onNewInquiryClick}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#FCF1D0] flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5 text-[#010736]" />
            </div>
            <div>
              <span className="text-lg font-bold text-[#FCF1D0] tracking-tight">
                Stratify AI
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Market Intelligence · India
              </p>
            </div>
          </div>

          {/* Navigation Switcher */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-[#010736] border border-[#22396F]">
            {[
              { id: "research", label: "New Research", icon: Compass },
              { id: "actions", label: "Action Plan", icon: Target },
              { id: "dashboard", label: "Insights", icon: BarChart3 },
              { id: "pulse", label: "Market Trends", icon: Radio },
              { id: "watchlists", label: "Alerts", icon: Bell },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = currentTab === id;
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id as NavigationTab)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-[#22396F] text-[#FCF1D0] shadow-sm font-semibold"
                      : "text-slate-300 hover:text-[#FCF1D0] hover:bg-[#142554]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-[#FCF1D0]" : "text-slate-400"
                    }`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Status indicator */}
            <button
              onClick={() => setIsTelemetryOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#010736] border border-[#22396F] text-xs text-slate-300 hover:text-white transition cursor-pointer"
              title="System Status"
            >
              {isHealthy === null ? (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                  <span className="hidden sm:inline">Connecting</span>
                </span>
              ) : isHealthy ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">Online</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="hidden sm:inline">Offline</span>
                </span>
              )}
            </button>

            {/* Search */}
            <button
              onClick={() => setIsSemanticSearchOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#FCF1D0] bg-[#010736] hover:bg-[#142554] border border-[#22396F] transition-all cursor-pointer"
              title="Search (⌘S)"
            >
              <Search className="w-3.5 h-3.5 text-[#FCF1D0]" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden lg:inline-block px-1 py-0.2 rounded text-[10px] font-mono text-slate-400 bg-[#0D1C42] border border-[#22396F]">
                ⌘S
              </kbd>
            </button>

            {/* Export Report */}
            <button
              onClick={() => setIsDossierOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#010736] bg-[#FCF1D0] hover:bg-[#fae8b4] transition-all cursor-pointer shadow-sm"
              title="Export Report (⌘E)"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-[#010736]" />
              <span className="hidden sm:inline">Export Report</span>
              <kbd className="hidden lg:inline-block px-1 py-0.2 rounded text-[10px] font-mono text-[#010736] bg-[#FCF1D0]/70 border border-[#010736]/30">
                ⌘E
              </kbd>
            </button>

            {/* Past Inquiries */}
            <button
              onClick={onRecentClick}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-[#010736] hover:bg-[#142554] border border-[#22396F] transition-all cursor-pointer"
              title="History (⌘K)"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg bg-[#010736] border border-[#22396F] text-slate-300 hover:text-white transition"
              aria-label="Toggle mobile navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-[#FCF1D0]" />
              ) : (
                <Menu className="w-5 h-5 text-slate-300" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#22396F] animate-fade-in">
            <div className="grid grid-cols-2 gap-1.5 pb-1">
              {[
                { id: "research", label: "New Research", icon: Compass },
                { id: "actions", label: "Action Plan", icon: Target },
                { id: "dashboard", label: "Insights", icon: BarChart3 },
                { id: "pulse", label: "Market Trends", icon: Radio },
                { id: "watchlists", label: "Alerts", icon: Bell },
              ].map(({ id, label, icon: Icon }) => {
                const isActive = currentTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      onTabChange(id as NavigationTab);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? "bg-[#22396F] text-[#FCF1D0] font-semibold"
                        : "text-slate-300 hover:text-[#FCF1D0] hover:bg-[#142554]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Architecture & Telemetry Modal */}
      <TelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => setIsTelemetryOpen(false)}
      />

      {/* Semantic Search & Vector Memory Modal */}
      <SemanticSearchModal
        isOpen={isSemanticSearchOpen}
        onClose={() => setIsSemanticSearchOpen(false)}
      />

      {/* Executive Intelligence Dossier & Governance Audit Modal */}
      <ExecutiveDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        defaultJobId={activeJobId}
      />
    </>
  );
}
