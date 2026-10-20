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

