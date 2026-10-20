"use client";

import React, { useEffect, useState } from "react";
import {
  createWatchlist,
  deleteWatchlist,
  fetchAlerts,
  fetchWatchlists,
  markAlertRead,
  simulateAlert,
} from "@/lib/api";
import {
  AlertItem,
  AlertSeverityType,
  WatchlistCreateRequest,
  WatchlistResponse,
} from "@/types/api";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Flame,
  Info,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";

const SUGGESTED_SECTORS = [
  { sector: "Climate Tech", entities: "Tesla, Rivian, Lucid Motors, Northvolt" },
  { sector: "Cybersecurity", entities: "CrowdStrike, SentinelOne, Palo Alto Networks" },
  { sector: "Developer Productivity", entities: "GitHub, GitLab, JetBrains, Cursor" },
  { sector: "Autonomous Mobility", entities: "Waymo, Cruise, Zoox, Baidu Apollo" },
];

export function WatchlistsWorkspace() {
  const [watchlists, setWatchlists] = useState<WatchlistResponse[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Filters
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSector, setFormSector] = useState("Climate Tech");
  const [formEntities, setFormEntities] = useState("Tesla, Rivian, Lucid Motors");
  const [formThreshold, setFormThreshold] = useState(-0.2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, []);

  // Reload alerts when filters change
  useEffect(() => {
    loadAlerts();
  }, [selectedWatchlistId, selectedSeverity, unreadOnly]);

  async function loadAllData() {
    setIsLoading(true);
    setError(null);
    try {
      const [wlRes, alertRes] = await Promise.all([
        fetchWatchlists(),
        fetchAlerts(unreadOnly, selectedSeverity === "ALL" ? undefined : selectedSeverity, selectedWatchlistId || undefined),
      ]);
      setWatchlists(wlRes.watchlists);
      setAlerts(alertRes.alerts);
      setTotalAlerts(alertRes.total);
      setUnreadCount(alertRes.unread_count);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load watchlists and alerts.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAlerts() {
    try {
      const res = await fetchAlerts(
        unreadOnly,
        selectedSeverity === "ALL" ? undefined : selectedSeverity,
        selectedWatchlistId || undefined
      );
      setAlerts(res.alerts);
      setTotalAlerts(res.total);
      setUnreadCount(res.unread_count);
    } catch (err: unknown) {
      console.error("Failed to load alerts:", err);
    }
  }

  async function handleCreateWatchlist(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formSector.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const entitiesList = formEntities
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const payload: WatchlistCreateRequest = {
        name: formName.trim(),
        sector: formSector.trim(),
        target_entities: entitiesList,
        alert_threshold: formThreshold,
        is_active: true,
      };

      const created = await createWatchlist(payload);
      setWatchlists((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setFormName("");
      // Reload alerts to catch retroactively evaluated signals
      await loadAlerts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create watchlist.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteWatchlist(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this watchlist and its alert history?")) {
      return;
    }
    try {
      await deleteWatchlist(id);
      setWatchlists((prev) => prev.filter((w) => w.id !== id));
      if (selectedWatchlistId === id) {
        setSelectedWatchlistId(null);
      }
      await loadAlerts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete watchlist.");
    }
  }

  async function handleToggleRead(alert: AlertItem) {
    const nextState = !alert.is_read;
    // Optimistic UI update
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_read: nextState } : a))
    );
    setUnreadCount((c) => (nextState ? Math.max(0, c - 1) : c + 1));

    try {
      await markAlertRead(alert.id, nextState);
    } catch (err: unknown) {
      console.error("Failed to update alert read status:", err);
      // Revert on failure
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, is_read: alert.is_read } : a))
      );
      setUnreadCount((c) => (nextState ? c + 1 : Math.max(0, c - 1)));
    }
  }

  async function handleSimulateAlert() {
    setIsSimulating(true);
    try {
      const sim = await simulateAlert({
        watchlist_id: selectedWatchlistId || undefined,
        severity: "WARNING",
      });
      setAlerts((prev) => [sim, ...prev]);
      setTotalAlerts((t) => t + 1);
      setUnreadCount((u) => u + 1);
      // Refresh watchlists to reflect alert counts
      const wlRes = await fetchWatchlists();
      setWatchlists(wlRes.watchlists);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to simulate alert.");
    } finally {
      setIsSimulating(false);
    }
  }

  // Aggregate stats
  const totalTrackedEntities = watchlists.reduce(
    (acc, w) => acc + (w.target_entities?.length || 0),
    0
  );
  const criticalAlertsCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const warningAlertsCount = alerts.filter((a) => a.severity === "WARNING").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Competitor Watchlists & Anomaly Alerts
              </h2>
              <p className="text-sm text-slate-400">
                Rule-based scanning engine monitoring strategic competitor shifts, sentiment shocks, and regulatory changes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadAllData()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
            Refresh
          </button>

          <button
            onClick={handleSimulateAlert}
            disabled={isSimulating}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition shadow-sm"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? "animate-pulse" : ""}`} />
            {isSimulating ? "Simulating..." : "Simulate Test Alert"}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New Watchlist
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Watchlists</span>
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{watchlists.length}</p>
          <span className="text-[11px] text-slate-500">Autonomous rule evaluators</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Tracked Entities</span>
            <Tag className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{totalTrackedEntities}</p>
          <span className="text-[11px] text-slate-500">Competitors & brands</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Unread Alerts</span>
            <div className="relative">
              <Bell className="w-4 h-4 text-rose-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400">{unreadCount}</p>
          <span className="text-[11px] text-slate-500">Requiring acknowledgment</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Risk Severity</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{criticalAlertsCount}</span>
            <span className="text-xs text-slate-400">critical</span>
            <span className="text-slate-600">/</span>
            <span className="text-xl font-bold text-amber-400">{warningAlertsCount}</span>
            <span className="text-xs text-slate-400">warning</span>
          </div>
          <span className="text-[11px] text-slate-500">Breakdown in active stream</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Watchlists Manager (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Watchlist Targets ({watchlists.length})
            </h3>
            {selectedWatchlistId && (
              <button
                onClick={() => setSelectedWatchlistId(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="space-y-3">
            {watchlists.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/20">
                <Target className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-400">No watchlists configured</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Create a watchlist to track competitor moves, negative sentiment spikes, and regulatory mandates.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  Create Watchlist
                </button>
              </div>
            ) : (
              watchlists.map((w) => {
                const isSelected = selectedWatchlistId === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() =>
                      setSelectedWatchlistId(isSelected ? null : w.id)
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "border-indigo-500/80 bg-indigo-950/20 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/50"
                        : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white hover:text-indigo-300 transition">
                            {w.name}
                          </h4>
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                            {w.sector}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Threshold:{" "}
                          <span className="font-mono text-amber-400">
                            {w.alert_threshold <= 0 ? w.alert_threshold.toFixed(2) : `+${w.alert_threshold.toFixed(2)}`}
                          </span>{" "}
                          sentiment delta
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {w.unread_alert_count > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300">
                            {w.unread_alert_count} unread
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDeleteWatchlist(w.id, e)}
                          title="Delete Watchlist"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Entities chips */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {w.target_entities.map((ent, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[11px] rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Total triggers: {w.alert_count}</span>
                      <span className="text-indigo-400 font-medium">
                        {isSelected ? "Filtering Feed ✓" : "Click to filter"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Real-Time Alerts Feed (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-400" />
                Alert Stream ({alerts.length})
                {selectedWatchlistId && (
                  <span className="text-xs text-indigo-400 lowercase font-normal">
                    (filtered by watchlist)
                  </span>
                )}
              </h3>
            </div>

            {/* Severity Filters */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition ${
                      selectedSeverity === sev
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setUnreadOnly((prev) => !prev)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition ${
                  unreadOnly
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Unread Only
              </button>
            </div>
          </div>

          {/* Alert Cards */}
          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/70 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-300">All clear — No active alerts</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No signals have triggered your threshold criteria or matched competitor filters yet.
                </p>
                <button
                  onClick={handleSimulateAlert}
                  className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Simulate Trigger Event
                </button>
              </div>
            ) : (
              alerts.map((alert) => {
                const isCrit = alert.severity === "CRITICAL";
                const isWarn = alert.severity === "WARNING";
                const dateStr = new Date(alert.triggered_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border transition-all ${
                      alert.is_read
                        ? "border-slate-800/80 bg-slate-900/20 opacity-75"
                        : isCrit
                        ? "border-rose-500/40 bg-rose-950/20 shadow-md shadow-rose-950/20 ring-1 ring-rose-500/30"
                        : isWarn
                        ? "border-amber-500/40 bg-amber-950/20 shadow-md shadow-amber-950/20"
                        : "border-sky-500/30 bg-sky-950/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isCrit ? (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                            CRITICAL
                          </span>
                        ) : isWarn ? (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            WARNING
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 border border-sky-500/40 text-sky-300">
                            <Info className="w-3 h-3 text-sky-400" />
                            INFO
                          </span>
                        )}

                        {alert.watchlist_name && (
                          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                            • {alert.watchlist_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {dateStr}
                        </span>
                        <button
                          onClick={() => handleToggleRead(alert)}
                          title={alert.is_read ? "Mark as unread" : "Acknowledge / Mark as read"}
                          className={`p-1.5 rounded-lg border text-xs transition ${
                            alert.is_read
                              ? "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="mt-2 text-sm font-semibold text-white leading-snug">
                      {alert.title}
                    </h4>

                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                      {alert.message}
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-mono">
                        Alert ID: {alert.id.substring(0, 8)}
                      </span>
                      <span
                        className={`font-medium ${
                          alert.is_read ? "text-slate-500" : "text-emerald-400"
                        }`}
                      >
                        {alert.is_read ? "Acknowledged" : "Active / Unread"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: New Watchlist */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Create Competitor Watchlist</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWatchlist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Watchlist Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-Gen EV Competitors"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Market Sector
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Climate Tech"
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Quick sector templates */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium">Quick Templates:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_SECTORS.map((s) => (
                    <button
                      type="button"
                      key={s.sector}
                      onClick={() => {
                        setFormSector(s.sector);
                        setFormEntities(s.entities);
                        setFormName(`${s.sector} Radar`);
                      }}
                      className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      {s.sector}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Competitors / Entities (Comma-separated)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Tesla, Rivian, Lucid Motors, Northvolt"
                  value={formEntities}
                  onChange={(e) => setFormEntities(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
                <span className="text-[11px] text-slate-500">
                  Real-time signals matching any of these names trigger automated checks.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Sentiment Shock Threshold
                  </label>
                  <span className="font-mono text-xs text-amber-400 font-bold">
                    {formThreshold <= 0 ? formThreshold.toFixed(2) : `+${formThreshold.toFixed(2)}`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.8"
                  max="0.0"
                  step="0.05"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>-0.80 (Severe Shocks Only)</span>
                  <span>-0.20 (Standard Anomaly)</span>
                  <span>0.00 (Any Negative)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmitting ? "Creating..." : "Save Watchlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
