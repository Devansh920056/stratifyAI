/**
 * Stratify AI API Client
 * Connects to the FastAPI distributed intelligence backend.
 */

import {
  HealthResponse,
  JobCreateRequest,
  JobDetailResponse,
  ReportResponse,
  TaskSummaryResponse,
  TelemetryResponse,
} from "@/types/api";

function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "localhost";
    return `http://${hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg =
            typeof errJson.detail === "string"
              ? errJson.detail
              : JSON.stringify(errJson.detail);
        }
      } catch {
        errorMsg = res.statusText || errorMsg;
      }
      throw new ApiError(res.status, errorMsg);
    }
    return await res.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Network error";
    throw new ApiError(0, `Cannot connect to Stratify API backend: ${message}`);
  }
}

export async function createJob(data: JobCreateRequest): Promise<JobDetailResponse> {
  const job = await request<JobDetailResponse>("/api/v1/jobs", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!job.tasks || job.tasks.length === 0) {
    try {
      return await getJob(job.id);
    } catch {
      return { ...job, tasks: job.tasks || [], has_report: job.has_report || false };
    }
  }
  return job;
}

export async function getJob(jobId: string): Promise<JobDetailResponse> {
  return request<JobDetailResponse>(`/api/v1/jobs/${jobId}`);
}

export async function getJobTasks(jobId: string): Promise<TaskSummaryResponse[]> {
  return request<TaskSummaryResponse[]>(`/api/v1/jobs/${jobId}/tasks`);
}

export async function getJobReport(jobId: string): Promise<ReportResponse | null> {
  try {
    return await request<ReportResponse>(`/api/v1/jobs/${jobId}/report`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function listRecentJobs(limit = 20): Promise<JobDetailResponse[]> {
  return request<JobDetailResponse[]>(`/api/v1/jobs?limit=${limit}`);
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/v1/health/live");
}

export async function getSystemTelemetry(): Promise<TelemetryResponse> {
  return request<TelemetryResponse>("/api/v1/health/telemetry");
}

export async function fetchRecommendations(
  jobId: string
): Promise<import("@/types/api").RecommendationListResponse> {
  return request<import("@/types/api").RecommendationListResponse>(
    `/api/v1/jobs/${jobId}/recommendations`
  );
}

export async function generateRecommendations(
  jobId: string
): Promise<import("@/types/api").RecommendationListResponse> {
  return request<import("@/types/api").RecommendationListResponse>(
    `/api/v1/jobs/${jobId}/recommendations/generate`,
    { method: "POST" }
  );
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: import("@/types/api").RecommendationStatusType
): Promise<import("@/types/api").RecommendationItem> {
  return request<import("@/types/api").RecommendationItem>(
    `/api/v1/recommendations/${recommendationId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

export async function getJobDashboard(
  jobId: string
): Promise<import("@/types/api").JobDashboardResponse> {
  return request<import("@/types/api").JobDashboardResponse>(
    `/api/v1/jobs/${jobId}/dashboard`
  );
}

export async function fetchMarketPulse(
  sector?: string,
  signalType?: string,
  limit = 40
): Promise<import("@/types/api").MarketPulseResponse> {
  const params = new URLSearchParams();
  if (sector && sector !== "ALL") params.append("sector", sector);
  if (signalType && signalType !== "ALL") params.append("signal_type", signalType);
  params.append("limit", limit.toString());
  return request<import("@/types/api").MarketPulseResponse>(
    `/api/v1/pulse?${params.toString()}`
  );
}

export async function syncMarketPulse(
  sector: string,
  maxSignals = 15
): Promise<import("@/types/api").MarketPulseResponse> {
  return request<import("@/types/api").MarketPulseResponse>(
    "/api/v1/pulse/sync",
    {
      method: "POST",
      body: JSON.stringify({ sector, max_signals: maxSignals }),
    }
  );
}

export async function fetchMarketPulseStats(): Promise<import("@/types/api").MarketPulseStatsResponse> {
  return request<import("@/types/api").MarketPulseStatsResponse>(
    "/api/v1/pulse/stats"
  );
}

export async function fetchWatchlists(): Promise<import("@/types/api").WatchlistListResponse> {
  return request<import("@/types/api").WatchlistListResponse>("/api/v1/watchlists");
}

export async function createWatchlist(
  data: import("@/types/api").WatchlistCreateRequest
): Promise<import("@/types/api").WatchlistResponse> {
  return request<import("@/types/api").WatchlistResponse>("/api/v1/watchlists", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteWatchlist(id: string): Promise<void> {
  return request<void>(`/api/v1/watchlists/${id}`, {
    method: "DELETE",
  });
}

export async function fetchAlerts(
  unreadOnly = false,
  severity?: string,
  watchlistId?: string
): Promise<import("@/types/api").AlertListResponse> {
  const params = new URLSearchParams();
  if (unreadOnly) params.append("unread_only", "true");
  if (severity && severity !== "ALL") params.append("severity", severity);
  if (watchlistId) params.append("watchlist_id", watchlistId);
  return request<import("@/types/api").AlertListResponse>(
    `/api/v1/alerts?${params.toString()}`
  );
}

export async function markAlertRead(
  id: string,
  isRead = true
): Promise<import("@/types/api").AlertItem> {
  return request<import("@/types/api").AlertItem>(`/api/v1/alerts/${id}/read`, {
    method: "PATCH",
    body: JSON.stringify({ is_read: isRead }),
  });
}

export async function simulateAlert(
  data: import("@/types/api").AlertSimulateRequest
): Promise<import("@/types/api").AlertItem> {
  return request<import("@/types/api").AlertItem>("/api/v1/alerts/simulate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function recordEvaluation(
  recommendationId: string,
  data: import("@/types/api").DecisionEvaluationCreateRequest
): Promise<import("@/types/api").DecisionEvaluationItem> {
  return request<import("@/types/api").DecisionEvaluationItem>(
    `/api/v1/recommendations/${recommendationId}/evaluations`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function fetchEvaluationsForRecommendation(
  recommendationId: string
): Promise<import("@/types/api").DecisionEvaluationItem[]> {
  return request<import("@/types/api").DecisionEvaluationItem[]>(
    `/api/v1/recommendations/${recommendationId}/evaluations`
  );
}

export async function fetchDecisionAnalytics(): Promise<import("@/types/api").DecisionAnalyticsSummaryResponse> {
  return request<import("@/types/api").DecisionAnalyticsSummaryResponse>(
    "/api/v1/evaluations/analytics"
  );
}

export async function runBacktestSimulation(
  jobId?: string,
  lookbackDays = 60
): Promise<import("@/types/api").BacktestResultResponse> {
  return request<import("@/types/api").BacktestResultResponse>(
    "/api/v1/evaluations/backtest",
    {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, lookback_days: lookbackDays }),
    }
  );
}

export async function fetchWebhooks(): Promise<import("@/types/api").WebhookListResponse> {
  return request<import("@/types/api").WebhookListResponse>("/api/v1/webhooks");
}

export async function createWebhook(
  data: import("@/types/api").WebhookCreateRequest
): Promise<import("@/types/api").WebhookSubscriptionItem> {
  return request<import("@/types/api").WebhookSubscriptionItem>("/api/v1/webhooks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(id: string): Promise<void> {
  return request<void>(`/api/v1/webhooks/${id}`, {
    method: "DELETE",
  });
}

export async function testWebhookDispatch(
  id: string,
  eventType = "alert.critical"
): Promise<import("@/types/api").WebhookDeliveryItem> {
  return request<import("@/types/api").WebhookDeliveryItem>(`/api/v1/webhooks/${id}/test`, {
    method: "POST",
    body: JSON.stringify({ event_type: eventType }),
  });
}

export async function fetchWebhookDeliveries(
  subscriptionId?: string
): Promise<import("@/types/api").WebhookDeliveryListResponse> {
  const path = subscriptionId
    ? `/api/v1/webhooks/${subscriptionId}/deliveries`
    : "/api/v1/webhooks/deliveries/all";
  return request<import("@/types/api").WebhookDeliveryListResponse>(path);
}

export async function searchSemanticMemory(
  data: import("@/types/api").SemanticSearchRequest
): Promise<import("@/types/api").SemanticSearchResponse> {
  return request<import("@/types/api").SemanticSearchResponse>(
    "/api/v1/semantic/search",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function indexVectorMemory(
  reindexAll = false
): Promise<import("@/types/api").VectorIndexResponse> {
  return request<import("@/types/api").VectorIndexResponse>(
    "/api/v1/semantic/index",
    {
      method: "POST",
      body: JSON.stringify({ reindex_all: reindexAll }),
    }
  );
}

export async function fetchVectorStats(): Promise<import("@/types/api").VectorMemoryStatsResponse> {
  return request<import("@/types/api").VectorMemoryStatsResponse>(
    "/api/v1/semantic/stats"
  );
}






