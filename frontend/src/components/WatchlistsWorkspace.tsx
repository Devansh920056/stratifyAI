"use client";

import React, { useEffect, useState } from "react";
import {
  createWatchlist,
  createWebhook,
  deleteWatchlist,
  deleteWebhook,
  fetchAlerts,
  fetchWatchlists,
  fetchWebhookDeliveries,
  fetchWebhooks,
  markAlertRead,
  simulateAlert,
  testWebhookDispatch,
} from "@/lib/api";
import {
  AlertItem,
  AlertSeverityType,
  WatchlistCreateRequest,
  WatchlistResponse,
  WebhookCreateRequest,
  WebhookDeliveryItem,
  WebhookSubscriptionItem,
} from "@/types/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Globe,
  Info,
  Layers,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";

const SUGGESTED_SECTORS = [
  { sector: "Fintech & Payments (India)", entities: "Paytm, PhonePe, Razorpay, CRED, Jio Financial" },
  { sector: "EV & Mobility (India)", entities: "Tata Motors, Mahindra Electric, Ola Electric, Ather Energy" },
  { sector: "Quick Commerce & Retail", entities: "Zomato, Blinkit, Swiggy Instamart, Zepto, Reliance Retail" },
  { sector: "Renewables & Green Hydrogen", entities: "Tata Power, Adani Green, NTPC Green, ReNew Power" },
  { sector: "Indian IT & SaaS", entities: "TCS, Infosys, Wipro, HCL Tech, Zoho, Freshworks" },
];

const AVAILABLE_WEBHOOK_EVENTS = [
  { id: "*", label: "All Events (*)" },
  { id: "alert.critical", label: "Critical Alerts (alert.critical)" },
  { id: "alert.warning", label: "Warning Alerts (alert.warning)" },
  { id: "signal.regulatory", label: "Regulatory Shifts (signal.regulatory)" },
  { id: "recommendation.approved", label: "Approved Actions (recommendation.approved)" },
  { id: "evaluation.recorded", label: "Decision Audits (evaluation.recorded)" },
];

type WorkspaceTab = "alerts" | "webhooks";

export function WatchlistsWorkspace() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("alerts");

  // Watchlists & Alerts State
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

  // Watchlist Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSector, setFormSector] = useState("Fintech & Payments (India)");
  const [formEntities, setFormEntities] = useState("Paytm, PhonePe, Razorpay, Jio Financial");
  const [formThreshold, setFormThreshold] = useState(-0.2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stage 7 Webhook State
  const [webhooks, setWebhooks] = useState<WebhookSubscriptionItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

  // Webhook Form State
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("https://hooks.slack.com/services/T00/B00/X00");
  const [whEvents, setWhEvents] = useState<string[]>(["alert.critical", "alert.warning"]);
  const [whSecret, setWhSecret] = useState("");
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);

  // Initial load
  useEffect(() => {
    loadAllData();
  }, []);

  // Reload alerts when filters change
  useEffect(() => {
    if (activeTab === "alerts") {
      loadAlerts();
    }
  }, [selectedWatchlistId, selectedSeverity, unreadOnly]);

  // Load webhooks when tab changes
  useEffect(() => {
    if (activeTab === "webhooks") {
      loadWebhooks();
    }
  }, [activeTab]);

  async function loadAllData() {
    setIsLoading(true);
    setError(null);
    try {
      const [wlRes, alertRes] = await Promise.all([
        fetchWatchlists(),
        fetchAlerts(
          unreadOnly,
          selectedSeverity === "ALL" ? undefined : selectedSeverity,
          selectedWatchlistId || undefined
        ),
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

  async function loadWebhooks() {
    try {
      const [whRes, delivRes] = await Promise.all([
        fetchWebhooks(),
        fetchWebhookDeliveries(),
      ]);
      setWebhooks(whRes.subscriptions);
      setDeliveries(delivRes.deliveries);
    } catch (err: unknown) {
      console.error("Failed to load webhooks:", err);
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
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_read: nextState } : a))
    );
    setUnreadCount((c) => (nextState ? Math.max(0, c - 1) : c + 1));

    try {
      await markAlertRead(alert.id, nextState);
    } catch (err: unknown) {
      console.error("Failed to update alert read status:", err);
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
      const wlRes = await fetchWatchlists();
      setWatchlists(wlRes.watchlists);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to simulate alert.");
    } finally {
      setIsSimulating(false);
    }
  }

  // Stage 7: Create Webhook
  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!whName.trim() || !whUrl.trim()) return;

    setIsCreatingWebhook(true);
    setError(null);
    try {
      const payload: WebhookCreateRequest = {
        name: whName.trim(),
        target_url: whUrl.trim(),
        event_types: whEvents.length > 0 ? whEvents : ["*"],
        secret_token: whSecret.trim() ? whSecret.trim() : null,
        is_active: true,
      };

      const created = await createWebhook(payload);
      setWebhooks((prev) => [created, ...prev]);
      setIsWebhookModalOpen(false);
      setWhName("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create webhook subscription.");
    } finally {
      setIsCreatingWebhook(false);
    }
  }

  // Stage 7: Test Dispatch Ping
  async function handleTestWebhook(subId: string) {
    setTestingWebhookId(subId);
    setTestSuccessMessage(null);
    try {
      const delivery = await testWebhookDispatch(subId, "alert.critical");
      setTestSuccessMessage(
        `Dispatched test HMAC ping to endpoint (Status: ${delivery.status_code || "OK"}, Latency: ${delivery.duration_ms}ms)`
      );
      setDeliveries((prev) => [delivery, ...prev]);
      // Refresh webhooks to update delivery count
      const whRes = await fetchWebhooks();
      setWebhooks(whRes.subscriptions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Webhook test ping failed.");
    } finally {
      setTestingWebhookId(null);
    }
  }

  // Stage 7: Delete Webhook
  async function handleDeleteWebhook(subId: string) {
    if (!window.confirm("Are you sure you want to remove this webhook destination?")) return;
    try {
      await deleteWebhook(subId);
      setWebhooks((prev) => prev.filter((w) => w.id !== subId));
      setDeliveries((prev) => prev.filter((d) => d.subscription_id !== subId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete webhook.");
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Market Alerts & Watchlists
              </h2>
              <p className="text-sm text-slate-300">
                Track competitor shifts, market news, and send real-time alerts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === "alerts") loadAllData();
              else loadWebhooks();
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#010736] hover:bg-[#0D1C42] text-slate-300 border border-[#22396F] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#FCF1D0]" : ""}`} />
            Refresh
          </button>

          {activeTab === "alerts" ? (
            <>
              <button
                onClick={handleSimulateAlert}
                disabled={isSimulating}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#010736] hover:bg-[#0D1C42] text-[#FCF1D0] border border-[#22396F] transition shadow-sm"
              >
                <Zap className={`w-3.5 h-3.5 ${isSimulating ? "animate-pulse" : ""}`} />
                {isSimulating ? "Simulating..." : "Test Alert"}
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#FCF1D0] hover:brightness-105 text-[#010736] shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New Watchlist
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsWebhookModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#FCF1D0] hover:brightness-105 text-[#010736] shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Webhook
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#22396F] pb-3">
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "alerts"
              ? "bg-[#22396F] text-[#FCF1D0]"
              : "text-slate-400 hover:text-white hover:bg-[#0D1C42]"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Alerts & Watchlists</span>
        </button>

        <button
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "webhooks"
              ? "bg-[#22396F] text-[#FCF1D0]"
              : "text-slate-400 hover:text-white hover:bg-[#0D1C42]"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Connected Webhooks ({webhooks.length})</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success alert */}
      {testSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{testSuccessMessage}</span>
          </div>
          <button onClick={() => setTestSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════
          TAB 1: WATCHLISTS & ALERT STREAM
      ═════════════════════════════════════════════════════════ */}
      {activeTab === "alerts" && (
        <>
          {/* Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-[#22396F] bg-[#0D1C42]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Watchlists</span>
                <Target className="w-4 h-4 text-[#FCF1D0]" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{watchlists.length}</p>
              <span className="text-[11px] text-slate-400">Active market monitors</span>
            </div>

            <div className="p-4 rounded-2xl border border-[#22396F] bg-[#0D1C42]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Companies Tracked</span>
                <Tag className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-white">{totalTrackedEntities}</p>
              <span className="text-[11px] text-slate-400">Competitors & brands</span>
            </div>

            <div className="p-4 rounded-2xl border border-[#22396F] bg-[#0D1C42]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Unread Alerts</span>
                <div className="relative">
                  <Bell className="w-4 h-4 text-[#FCF1D0]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FCF1D0] animate-ping" />
                  )}
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#FCF1D0]">{unreadCount}</p>
              <span className="text-[11px] text-slate-400">Pending review</span>
            </div>

            <div className="p-4 rounded-2xl border border-[#22396F] bg-[#0D1C42]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">High Priority</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-400">{criticalAlertsCount}</span>
                <span className="text-xs text-slate-400">critical</span>
                <span className="text-slate-600">/</span>
                <span className="text-xl font-bold text-amber-400">{warningAlertsCount}</span>
                <span className="text-xs text-slate-400">warning</span>
              </div>
              <span className="text-[11px] text-slate-400">Severity breakdown</span>
            </div>
          </div>

          {/* Main Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Watchlists Manager (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FCF1D0]" />
                  <span>Watchlists ({watchlists.length})</span>
                </h3>
                {selectedWatchlistId && (
                  <button
                    onClick={() => setSelectedWatchlistId(null)}
                    className="text-xs text-[#FCF1D0] hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {watchlists.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-[#22396F] bg-[#0D1C42]">
                    <Target className="w-8 h-8 text-[#FCF1D0]/60 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">No watchlists configured</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Create a watchlist to track competitor moves and market sentiment.
                    </p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#FCF1D0] hover:brightness-105 text-[#010736]"
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
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "border-[#FCF1D0] bg-[#22396F]/40 shadow-lg ring-1 ring-[#FCF1D0]/50"
                            : "border-[#22396F] bg-[#0D1C42] hover:border-[#FCF1D0]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white hover:text-[#FCF1D0] transition">
                                {w.name}
                              </h4>
                              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#010736] border border-[#22396F] text-[#FCF1D0]">
                                {w.sector}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Alert sensitivity:{" "}
                              <span className="font-mono text-[#FCF1D0]">
                                {w.alert_threshold <= 0 ? w.alert_threshold.toFixed(2) : `+${w.alert_threshold.toFixed(2)}`}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {w.unread_alert_count > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#22396F] border border-[#FCF1D0]/40 text-[#FCF1D0]">
                                {w.unread_alert_count} unread
                              </span>
                            )}
                            <button
                              onClick={(e) => handleDeleteWatchlist(w.id, e)}
                              title="Delete Watchlist"
                              className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
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
                              className="px-2 py-0.5 text-[11px] rounded bg-[#010736] border border-[#22396F] text-slate-200"
                            >
                              {ent}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-[#22396F]/60 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Triggers: {w.alert_count}</span>
                          <span className="text-[#FCF1D0] font-medium">
                            {isSelected ? "Active filter ✓" : "Click to view alerts"}
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
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#FCF1D0]" />
                    <span>Alerts Feed ({alerts.length})</span>
                    {selectedWatchlistId && (
                      <span className="text-xs text-[#FCF1D0] font-normal">
                        (filtered)
                      </span>
                    )}
                  </h3>
                </div>

                {/* Severity Filters */}
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl bg-[#010736] border border-[#22396F] p-0.5">
                    {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setSelectedSeverity(sev)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition ${
                          selectedSeverity === sev
                            ? "bg-[#22396F] text-[#FCF1D0]"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setUnreadOnly((prev) => !prev)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-xl border transition ${
                      unreadOnly
                        ? "bg-[#22396F] border-[#FCF1D0]/40 text-[#FCF1D0]"
                        : "bg-[#010736] border-[#22396F] text-slate-400 hover:text-white"
                    }`}
                  >
                    Unread Only
                  </button>
                </div>
              </div>

              {/* Alert Cards */}
              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                {alerts.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl border border-[#22396F] bg-[#0D1C42]">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">All clear — No active alerts</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      No market alerts currently match your filters.
                    </p>
                    <button
                      onClick={handleSimulateAlert}
                      className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#010736] hover:bg-[#22396F] text-[#FCF1D0] border border-[#22396F]"
                    >
                      Test Alert
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
                        className={`p-4 rounded-2xl border transition-all ${
                          alert.is_read
                            ? "border-[#22396F]/50 bg-[#0D1C42]/50 opacity-80"
                            : isCrit
                            ? "border-rose-500/50 bg-[#0D1C42] shadow-md ring-1 ring-rose-500/30"
                            : isWarn
                            ? "border-amber-500/50 bg-[#0D1C42] shadow-md"
                            : "border-[#22396F] bg-[#0D1C42]"
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
                              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#22396F] border border-[#22396F] text-[#FCF1D0]">
                                <Info className="w-3 h-3 text-[#FCF1D0]" />
                                INFO
                              </span>
                            )}

                            {alert.watchlist_name && (
                              <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
                                • {alert.watchlist_name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {dateStr}
                            </span>
                            <button
                              onClick={() => handleToggleRead(alert)}
                              title={alert.is_read ? "Mark as unread" : "Mark as read"}
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                alert.is_read
                                  ? "bg-[#010736] text-slate-400 border-[#22396F] hover:text-white"
                                  : "bg-[#22396F] text-[#FCF1D0] border-[#22396F] hover:bg-[#22396F]/80"
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

                        <div className="mt-3 pt-2 border-t border-[#22396F]/50 flex items-center justify-between text-[11px]">
                          <span
                            className={`font-medium ${
                              alert.is_read ? "text-slate-500" : "text-emerald-400"
                            }`}
                          >
                            {alert.is_read ? "Read" : "New Alert"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═════════════════════════════════════════════════════════
          TAB 2: OUTBOUND WEBHOOKS & DELIVERY AUDIT
      ═════════════════════════════════════════════════════════ */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          {/* Subscriptions Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#FCF1D0]" />
                <span>Connected Webhooks ({webhooks.length})</span>
              </h3>
            </div>

            {webhooks.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-[#22396F] bg-[#0D1C42]">
                <Radio className="w-10 h-10 text-[#FCF1D0]/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-white">No Webhooks Connected</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Send real-time alerts directly to Slack, Discord, Microsoft Teams, or your own server.
                </p>
                <button
                  onClick={() => setIsWebhookModalOpen(true)}
                  className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-[#FCF1D0] hover:brightness-105 text-[#010736]"
                >
                  Add Webhook
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {webhooks.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-5 rounded-2xl border border-[#22396F] bg-[#0D1C42] space-y-4 hover:border-[#FCF1D0]/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{sub.name}</h4>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                              sub.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-[#010736] text-slate-400 border-[#22396F]"
                            }`}
                          >
                            {sub.is_active ? "Active" : "Disabled"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-1 truncate max-w-sm">
                          {sub.target_url}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestWebhook(sub.id)}
                          disabled={testingWebhookId === sub.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#22396F] hover:bg-[#22396F]/80 text-[#FCF1D0] border border-[#22396F] transition disabled:opacity-50"
                        >
                          <Send className={`w-3 h-3 ${testingWebhookId === sub.id ? "animate-pulse" : ""}`} />
                          {testingWebhookId === sub.id ? "Testing..." : "Test Ping"}
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(sub.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Events chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {sub.event_types.map((ev, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#010736] text-slate-300 border border-[#22396F]"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-[#22396F]/50 flex items-center justify-between text-xs text-slate-400">
                      <span>Total Sent: <strong className="text-white">{sub.total_deliveries}</strong></span>
                      <span className="text-emerald-400 font-mono">
                        Success Rate: {sub.success_rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery History */}
          <div className="space-y-4 pt-4 border-t border-[#22396F]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#FCF1D0]" />
              <span>Recent Deliveries ({deliveries.length})</span>
            </h3>

            {deliveries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No webhook deliveries recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {deliveries.map((deliv) => {
                  const is2xx = deliv.is_success;
                  const timeStr = new Date(deliv.delivered_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={deliv.id}
                      className="p-3.5 rounded-xl border border-[#22396F] bg-[#0D1C42] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            is2xx
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {deliv.status_code ? `${deliv.status_code} ${is2xx ? "OK" : "ERR"}` : "FAILED"}
                        </span>

                        <span className="font-mono text-[#FCF1D0] font-semibold">{deliv.event_type}</span>

                        <span className="text-slate-400 font-mono">
                          {deliv.duration_ms}ms
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-slate-400">
                        {deliv.error_message && (
                          <span className="text-rose-400 truncate max-w-xs">{deliv.error_message}</span>
                        )}
                        <span className="text-[11px] text-slate-400">{timeStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: New Watchlist */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-[#22396F] bg-[#0D1C42] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#22396F] pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#FCF1D0]" />
                <h3 className="text-lg font-bold text-white">Create Competitor Watchlist</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
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
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#010736] border border-[#22396F] text-white placeholder-slate-500 focus:outline-none focus:border-[#FCF1D0]"
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
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#010736] border border-[#22396F] text-white placeholder-slate-500 focus:outline-none focus:border-[#FCF1D0]"
                />
              </div>

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
                      className="px-2 py-1 text-[11px] rounded-lg bg-[#010736] hover:bg-[#22396F] text-slate-300 border border-[#22396F] transition"
                    >
                      {s.sector}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Competitors / Companies (Comma-separated)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Tesla, Rivian, Lucid Motors, Northvolt"
                  value={formEntities}
                  onChange={(e) => setFormEntities(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#010736] border border-[#22396F] text-white placeholder-slate-500 focus:outline-none focus:border-[#FCF1D0] font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Alert Sensitivity
                  </label>
                  <span className="font-mono text-xs text-[#FCF1D0] font-bold">
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
                  className="w-full accent-[#FCF1D0] cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-[#22396F] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#010736] hover:bg-[#22396F] text-slate-300 border border-[#22396F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-[#FCF1D0] hover:brightness-105 text-[#010736] transition disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isSubmitting ? "Creating..." : "Save Watchlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Webhook Destination */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-[#22396F] bg-[#0D1C42] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#22396F] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#FCF1D0]" />
                <h3 className="text-lg font-bold text-white">Add Webhook Destination</h3>
              </div>
              <button
                onClick={() => setIsWebhookModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Destination Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Slack #leadership-intel"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#010736] border border-[#22396F] text-white placeholder-slate-500 focus:outline-none focus:border-[#FCF1D0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Webhook Target URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.slack.com/services/..."
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#010736] border border-[#22396F] text-white font-mono text-xs focus:outline-none focus:border-[#FCF1D0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Events to Forward
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_WEBHOOK_EVENTS.map((ev) => {
                    const isChecked = whEvents.includes(ev.id);
                    return (
                      <label
                        key={ev.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                          isChecked
                            ? "bg-[#22396F] border-[#FCF1D0]/40 text-[#FCF1D0]"
                            : "bg-[#010736] border-[#22396F] text-slate-400 hover:text-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWhEvents((prev) => [...prev, ev.id]);
                            } else {
                              setWhEvents((prev) => prev.filter((x) => x !== ev.id));
                            }
                          }}
                          className="accent-[#FCF1D0]"
                        />
                        <span className="truncate">{ev.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#22396F] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#010736] hover:bg-[#22396F] text-slate-300 border border-[#22396F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWebhook}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-[#FCF1D0] hover:brightness-105 text-[#010736] transition disabled:opacity-50"
                >
                  {isCreatingWebhook && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isCreatingWebhook ? "Saving..." : "Save Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
