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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
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
  return request<JobDetailResponse>("/api/v1/jobs", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
