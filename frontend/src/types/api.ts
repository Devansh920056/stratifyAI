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

export type DecisionOutcomeStatusType =
  | "VALIDATED"
  | "PARTIALLY_VALIDATED"
  | "INVALIDATED"
  | "IN_PROGRESS"
  | "INCONCLUSIVE";

export interface MetricEvidenceItem {
  metric: string;
  projected: string;
  actual: string;
  status: string;
}

export interface DecisionEvaluationCreateRequest {
  outcome_status: DecisionOutcomeStatusType;
  evaluator_notes: string;
  actual_outcome: string;
  actual_metric_value?: string | null;
  impact_delta?: number;
  confidence_score?: number;
  metric_evidence?: MetricEvidenceItem[];
  linked_signal_ids?: string[];
}

export interface DecisionEvaluationItem {
  id: string;
  recommendation_id: string;
  outcome_status: DecisionOutcomeStatusType;
  evaluator_notes: string;
  actual_outcome: string;
  actual_metric_value?: string | null;
  impact_delta: number;
  confidence_score: number;
  metric_evidence: MetricEvidenceItem[];
  linked_signal_ids: string[];
  evaluated_at: string;
  created_at: string;
  updated_at: string;
  recommendation_title?: string | null;
}

export interface DecisionEvaluationListResponse {
  evaluations: DecisionEvaluationItem[];
  total: number;
}

export interface DecisionAnalyticsSummaryResponse {
  total_evaluated: number;
  validated_count: number;
  partially_validated_count: number;
  invalidated_count: number;
  in_progress_count: number;
  validation_rate: number;
  average_impact_delta: number;
  average_confidence: number;
  top_validated_hypotheses: string[];
  top_failing_hypotheses: string[];
}

export interface BacktestFindingItem {
  recommendation_id: string;
  title: string;
  original_hypothesis: string;
  estimated_impact: number;
  market_signal_count: number;
  market_sentiment_trend: number;
  backtest_verdict: "STRONGLY_ALIGNED" | "MODERATELY_ALIGNED" | "DIVERGENT" | "NEUTRAL";
  confidence: number;
  key_market_evidence: string[];
}

export interface BacktestResultResponse {
  total_recommendations: number;
  aligned_recommendations: number;
  divergent_recommendations: number;
  alignment_score: number;
  findings: BacktestFindingItem[];
}

export interface WebhookCreateRequest {
  name: string;
  target_url: string;
  event_types?: string[];
  secret_token?: string | null;
  is_active?: boolean;
}

export interface WebhookSubscriptionItem {
  id: string;
  name: string;
  target_url: string;
  event_types: string[];
  is_active: boolean;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  success_rate: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookListResponse {
  subscriptions: WebhookSubscriptionItem[];
  total: number;
}

export interface WebhookDeliveryItem {
  id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, any>;
  status_code?: number | null;
  response_body?: string | null;
  error_message?: string | null;
  duration_ms: number;
  is_success: boolean;
  delivered_at: string;
}

export interface WebhookDeliveryListResponse {
  deliveries: WebhookDeliveryItem[];
  total: number;
}

export interface SemanticSearchRequest {
  query: string;
  entity_types?: string[];
  sector?: string;
  min_similarity?: number;
  limit?: number;
  synthesize_insight?: boolean;
}

export interface SemanticMatchItem {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  content_text: string;
  sector?: string | null;
  similarity_score: number;
  match_percentage: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SemanticSearchResponse {
  query: string;
  total_matches: number;
  matches: SemanticMatchItem[];
  ai_insight?: string | null;
  key_drivers: string[];
  dimensions: number;
  latency_ms: number;
}

export interface VectorIndexRequest {
  reindex_all?: boolean;
}

export interface VectorIndexResponse {
  indexed_count: number;
  signals_indexed: number;
  recommendations_indexed: number;
  findings_indexed: number;
  message: string;
}

export interface VectorMemoryStatsResponse {
  total_embeddings: number;
  by_entity_type: Record<string, number>;
  dimensions: number;
  supported_encoders: string[];
  active_encoder: string;
}

export interface EvidenceQueryRequest {
  entity_name: string;
  topic?: string | null;
  include_sec?: boolean;
  include_arxiv?: boolean;
  reconcile?: boolean;
}

export interface FusedEvidenceItem {
  id: string;
  entity_name: string;
  source_type: string;
  filing_type: string;
  title: string;
  content_excerpt: string;
  source_url: string;
  reliability_score: number;
  divergence_status: "ALIGNED" | "DIVERGENT" | "CONTRADICTORY" | "UNVERIFIED";
  reconciliation_notes?: string | null;
  fiscal_period?: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EvidenceReconciliationSummary {
  entity_name: string;
  total_fused_sources: number;
  sec_filings_count: number;
  arxiv_preprints_count: number;
  divergent_claims_count: number;
  contradictory_claims_count: number;
  evidence_reliability_index: number;
  reconciliation_takeaway: string;
}

export interface FusedEvidenceListResponse {
  entity_name: string;
  items: FusedEvidenceItem[];
  total: number;
  summary?: EvidenceReconciliationSummary | null;
}

// ─── Stage 10 Dialectic Debate Contracts ───────────────────────
export type AgentDebateRoleType =
  | "BULL_SPECIALIST"
  | "BEAR_RISK_OFFICER"
  | "REGULATORY_AUDITOR"
  | "PRINCIPAL_ARBITER";

export type ArgumentType =
  | "THESIS"
  | "ANTITHESIS"
  | "REBUTTAL"
  | "REGULATORY_CHALLENGE"
  | "SYNTHESIS";

export type ArbiterVerdictType =
  | "STRONG_BUY"
  | "STRATEGIC_ACCUMULATE"
  | "NEUTRAL_HOLD"
  | "DEFENSIVE_HEDGE"
  | "DIVEST_AVOID";

export type DebateStatusType = "IN_PROGRESS" | "CONCLUDED" | "ARCHIVED";

export interface EvidenceCitationItem {
  source_type: string;
  title: string;
  reference_id?: string | null;
  url?: string | null;
  reconciliation_impact?: string | null;
}

export interface DebateMessageItem {
  id: string;
  debate_id: string;
  agent_role: AgentDebateRoleType;
  agent_name: string;
  round_number: number;
  argument_type: ArgumentType;
  content: string;
  evidence_citations: EvidenceCitationItem[];
  confidence_score: number;
  created_at: string;
}

export interface DebateSynthesisMatrix {
  bull_score: number;
  bear_score: number;
  regulatory_risk_score: number;
  primary_growth_vector: string;
  primary_vulnerability: string;
  tripwires: string[];
  evidence_weighting?: {
    statutory_sec_weight: number;
    scientific_arxiv_weight: number;
    commercial_news_weight: number;
  };
}

export interface DebateListItem {
  id: string;
  topic: string;
  entity_name: string;
  status: DebateStatusType;
  rounds_count: number;
  arbiter_verdict?: ArbiterVerdictType | null;
  conviction_score?: number | null;
  executive_summary?: string | null;
  created_at: string;
}

export interface DebateDetailResponse {
  id: string;
  topic: string;
  entity_name: string;
  status: DebateStatusType;
  rounds_count: number;
  arbiter_verdict?: ArbiterVerdictType | null;
  conviction_score?: number | null;
  executive_summary?: string | null;
  synthesis_matrix: DebateSynthesisMatrix;
  created_at: string;
  updated_at: string;
  messages: DebateMessageItem[];
}

export interface DebateListResponse {
  debates: DebateListItem[];
  total: number;
}

export interface DebateInitiateRequest {
  topic: string;
  entity_name: string;
  focus_areas?: string[];
  rounds_count?: number;
}







