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

export interface TaskResultResponse {
  grounded_summary: string;
  key_findings: KeyFinding[];
  confidence_score: number;
  citations: CitationItem[];
  model_name: string;
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
  result?: TaskResultResponse | null;
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
  components?: Record<string, string>;
}

export interface TelemetryResponse {
  status: string;
  version: string;
  timestamp: string;
  database: {
    status: string;
    host_port: number;
    container: string;
    engine: string;
    isolation: string;
  };
  broker: {
    status: string;
    amqp_port: number;
    management_port: number;
    exchange: string;
    queue: string;
    dlq: string;
    delivery_mode: string;
  };
  orchestrator: {
    concurrency_control: string;
    outbox_pattern: string;
    max_worker_retries: number;
    qos_prefetch_count: number;
  };
  ai_providers: {
    llm: string;
    search: string;
    anti_hallucination: string;
  };
  metrics: {
    total_jobs: number;
    completed_jobs: number;
    processing_jobs: number;
    total_tasks: number;
  };
}

export type RecommendationStatusType =
  | "DRAFT"
  | "APPROVED"
  | "IMPLEMENTED"
  | "REVIEWED"
  | "DISMISSED";

export type TimeHorizonType =
  | "IMMEDIATE"
  | "NEAR_TERM"
  | "MEDIUM_TERM"
  | "LONG_TERM";

export interface RecommendationItem {
  id: string;
  job_id: string;
  title: string;
  description: string;
  rationale: string;
  estimated_impact: number;
  estimated_effort: number;
  priority_score: number;
  time_horizon: TimeHorizonType;
  outcome_hypothesis: string;
  success_metric: string;
  target_metric_value: string | null;
  status: RecommendationStatusType;
  evidence_ids: any[];
  created_at: string;
  updated_at: string;
}

export interface RecommendationListResponse {
  job_id: string;
  total: number;
  items: RecommendationItem[];
}

export interface MoatCompetitorPoint {
  name: string;
  technological_moat: number;
  pricing_power: number;
  quadrant: string;
  summary: string;
  confidence: number;
  source_url?: string | null;
}

export interface VectorScoreItem {
  vector_key: string;
  label: string;
  confidence: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  evidence_count: number;
  summary_snippet: string;
}

export interface ClaimClassification {
  claim: string;
  source_url?: string | null;
  is_empirical: boolean;
  confidence: number;
  vector_type: string;
}

export interface SourceDomainItem {
  domain: string;
  count: number;
  percentage: number;
}

export interface JobDashboardResponse {
  job_id: string;
  target_market: string;
  geography: string;
  overall_confidence: number;
  moat_matrix: MoatCompetitorPoint[];
  vector_scores: VectorScoreItem[];
  claims_breakdown: ClaimClassification[];
  empirical_facts_count: number;
  inferred_projections_count: number;
  source_domains: SourceDomainItem[];
  total_citations: number;
}

export type SignalCategoryType =
  | "COMPETITOR_MOVE"
  | "REGULATORY_UPDATE"
  | "MARKET_SHIFT"
  | "PARTNERSHIP"
  | "FUNDING";

export interface MarketSignalItem {
  id: string;
  market_sector: string;
  headline: string;
  summary: string;
  source_url: string;
  canonical_url: string;
  source_domain: string;
  sentiment_score: number;
  relevance_score: number;
  signal_type: SignalCategoryType;
  published_at: string;
  created_at: string;
}

export interface MarketPulseResponse {
  signals: MarketSignalItem[];
  total: number;
  sector?: string | null;
  signal_type?: string | null;
}

export interface SectorStatItem {
  sector: string;
  count: number;
  avg_sentiment: number;
}

export interface DomainStatItem {
  domain: string;
  count: number;
}

export interface MarketPulseStatsResponse {
  total_signals: number;
  positive_signals: number;
  neutral_signals: number;
  negative_signals: number;
  average_sentiment: number;
  top_sectors: SectorStatItem[];
  top_domains: DomainStatItem[];
}

export type AlertSeverityType = "INFO" | "WARNING" | "CRITICAL";

export interface AlertItem {
  id: string;
  watchlist_id: string;
  signal_id?: string | null;
  title: string;
  message: string;
  severity: AlertSeverityType;
  is_read: boolean;
  triggered_at: string;
  watchlist_name?: string | null;
}

export interface AlertListResponse {
  alerts: AlertItem[];
  total: number;
  unread_count: number;
}

export interface WatchlistCreateRequest {
  name: string;
  sector: string;
  target_entities: string[];
  alert_threshold?: number;
  is_active?: boolean;
}

export interface WatchlistResponse {
  id: string;
  name: string;
  sector: string;
  target_entities: string[];
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  alert_count: number;
  unread_alert_count: number;
  recent_alerts: AlertItem[];
}

export interface WatchlistListResponse {
  watchlists: WatchlistResponse[];
  total: number;
}

export interface AlertSimulateRequest {
  watchlist_id?: string | null;
  title?: string | null;
  message?: string | null;
  severity?: AlertSeverityType;
}




