/**
 * TypeScript API contracts matching FastAPI backend schemas.
 */

export interface JobCreateRequest {
  research_question: string;
  target_market: string;
  geography: string;
  time_range?: string;
  focus_areas?: string[];
}

export interface TaskSummaryResponse {
  id: string;
  job_id: string;
  task_type: string;
  search_queries: string[];
  status: "PENDING" | "DISPATCHED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  attempt_count: number;
  version: number;
  started_at: string | null;
  completed_at: string | null;
  error_details: string | null;
  created_at: string;
}

export interface JobDetailResponse {
  id: string;
  research_question: string;
  target_market: string;
  geography: string;
  time_range: string | null;
  focus_areas: string[];
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";
  tasks_count: number;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  has_report: boolean;
  tasks: TaskSummaryResponse[];
}

export interface KeyFinding {
  claim: string;
  source_url: string;
  confidence: number;
}

export interface CitationItem {
  url: string;
  title?: string;
  task_type?: string;
  claim_id?: string;
}

export interface ReportSection {
  status: "COMPLETED" | "FAILED" | "UNAVAILABLE";
  summary: string;
  key_findings: KeyFinding[];
  confidence: number;
  citations: CitationItem[];
  model?: string;
  error?: string;
}

export interface ReportResponse {
  id: string;
  job_id: string;
  executive_summary: string;
  market_findings: ReportSection;
  competitor_analysis: ReportSection;
  customer_insights: ReportSection;
  opportunities_and_risks: ReportSection;
  citations: CitationItem[];
  research_limitations: string | null;
  status: "FINAL" | "PARTIAL" | "FAILED" | "DRAFT";
  created_at: string;
  updated_at: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  database?: string;
  broker?: string;
}
