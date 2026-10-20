# Stratify AI 2.0 — Distributed Multi-Agent Market Intelligence & Decision Governance Platform

**Stratify AI 2.0** is an enterprise-grade market intelligence, dialectic debate, and decision governance platform. Designed for investment committees, corporate strategy teams, and boardrooms, Stratify AI systematically ingests multi-source empirical evidence (statutory SEC EDGAR Form 10-K/10-Q filings, arXiv deep-tech preprints, and real-time GDELT market signals), conducts multi-agent adversarial debates (Bull Specialist vs. Bear Chief Risk Officer), backtests strategic recommendations against real outcomes, and compiles boardroom intelligence dossiers sealed with deterministic **SHA-256 cryptographic provenance** compliant with **SEC Rule 17a-4 Electronic Records Standards**.

---

## 🏛️ Comprehensive Architecture (12 Stages)

```
                                  STRATIFY AI 2.0 PLATFORM TOPOLOGY
                                  
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                     Next.js 16 Responsive Frontend                                     │
  │                     5-Pillar Navigation • Dark Glassmorphic Design System • Port 3000                 │
  ├───────────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────────┤
  │ 1. Research Core  │ 2. Action Intel   │ 3. Market Dash    │ 4. Market Pulse   │ 5. Watchlists & Alert │
  │ Decomposition 4x  │ 2x2 Impact-Effort │ 2D Moat Matrix    │ Real GDELT Stream │ Anomaly Engine        │
  │ SSE Task Stream   │ Hypothesis Ledger │ 4-Vector Radar    │ Sentiment Tone    │ Read/Unread Toggles   │
  └─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴───────────┬───────────┘
            │                   │                   │                   │                     │
            └───────────────────┴─────────┬─────────┴───────────────────┴─────────────────────┘
                                          │ REST / SSE Polling (FastAPI Port 8000)
                                          ▼
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                     FastAPI Application Coordinator                                   │
  ├───────────────────┬───────────────────┬───────────────────┬───────────────────┬───────────────────────┤
  │  Multi-Source     │  Semantic Vector  │  Dialectic Multi- │  Decision Quality │  Executive Boardroom  │
  │  Evidence Fusion  │  Memory Engine    │  Agent Debate     │  Scoring (DQS)    │  Export & Audit Trail │
  │  (SEC 10-K/arXiv) │  (128-dim Embed)  │  (Bull vs Bear)   │  (Stage 6 Engine) │  (SHA-256 Non-Repud.) │
  │  Stage 9          │  Stage 8          │  Stage 10         │  Stage 6          │  Stage 11             │
  └─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴─────────┬─────────┴───────────┬───────────┘
            │                   │                   │                   │                     │
            ▼                   ▼                   ▼                   ▼                     ▼
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                         PostgreSQL 16 Alpine Database (Port 5434 • Docker)                            │
  │  Tables: jobs, tasks, outbox, recommendations, decision_evaluations, market_signals, watchlists,      │
  │          watchlist_alerts, webhooks, vector_embeddings, fused_evidence, debates, debate_messages     │
  └───────────────────────────────────┬───────────────────────────────────────────────────────────────────┘
                                      │ Transactional Outbox (SKIP LOCKED)
                                      ▼
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                             RabbitMQ 3.13 AMQP Broker Cluster (Port 5672)                             │
  │               Exchange: stratify.tasks.exchange | Queue: stratify.tasks.queue | DLQ: dlx              │
  └───────────────────────────────────┬───────────────────────────────────────────────────────────────────┘
                                      │ Prefetch QoS=1..2 • Manual ACK after DB Commit
                                      ▼
  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                   Distributed Worker Cluster Processes                                │
  │              - Tavily Search API (Real Web Evidence & Sanitized Extraction)                           │
  │              - Google Gemini 1.5 (Grounded LLM Reasoning & Strict Anti-Hallucination Guardrails)      │
  │              - Outbound Webhook Dispatcher (HMAC-SHA256 Cryptographic Signatures)                     │
  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 💎 The 5 Core Product Pillars

1. **Research Core (`/`)**:
   - Decomposes high-stakes research questions into 4 orthogonal vectors: Market Sizing, Competitive Landscape, Regulatory Risk, and Technological Feasibility.
   - Real-time task progress tracking and final intelligence report synthesis.
2. **Action Intelligence (`/actions`)**:
   - Interactive 2x2 Impact-Effort Strategic Matrix (High Impact / Low Effort Quick Wins vs. Major Projects).
   - Strategic Hypothesis Tracking with empirical success metrics and live Dialectic Debate triggers.
3. **Market Dashboard (`/dashboard`)**:
   - 2D Interactive SVG Moat Matrix (Technological Moat vs. Pricing Power).
   - 4-Vector Risk Radar with empirical claim verification versus speculative projection classification.
4. **Market Pulse Stream (`/pulse`)**:
   - Continuous real-time ingestion from **GDELT 2.0 Global News Graph**.
   - Heuristic sentiment scoring, category classification (Competitor Moves, Regulations, Partnerships, Funding).
5. **Competitor Watchlists & Anomaly Detection (`/watchlists`)**:
   - Entity monitoring across tracked competitors (Tesla, Rivian, CrowdStrike, QuantumScape).
   - Real-time anomaly detection heuristics triggering unread alerts on sudden negative sentiment shifts or regulatory scrutiny.

---

## 🛡️ Enterprise Governance & Cross-Cutting Systems

### Stage 6: Decision Evaluation & Historical Backtesting
- Calculates empirical **Decision Quality Scores (DQS)**:
  $$\text{DQS} = (\text{Validation Rate} \times 0.6) + (\text{Normalized Impact Delta} \times 0.4)$$
- Counterfactual simulation engine evaluating historical strategic recommendations against unfolding market signals.

### Stage 7: Real-Time Webhooks & Outbound Dispatcher
- Delivers real-time events (`job.completed`, `recommendation.created`, `alert.triggered`, `debate.concluded`) to enterprise endpoints (Slack, Microsoft Teams, internal SIEMs).
- Signed with cryptographic **HMAC-SHA256** headers (`X-Stratify-Signature`) for verified origin authenticity.

### Stage 8: Semantic Intelligence & Vector Memory
- 128-dimensional dense semantic vector space with sign-hash projection.
- Cosine similarity ranking enabling sub-millisecond semantic search across millions of intelligence findings without external proprietary vector database dependencies.

### Stage 9: Multi-Source Evidence Fusion & SEC EDGAR Reconciliation
- Direct integration with **SEC EDGAR API** (institutional CIK resolution, Form 10-K / 10-Q Item 1A Risk Factor extraction).
- Ingestion of scientific deep-tech preprints via **arXiv API**.
- Automated contradiction detection between commercial PR news and statutory regulatory risk factors.

### Stage 10: Multi-Agent Dialectic Debate Engine
- Multi-round dialectic reasoning featuring:
  - **Bull Growth Specialist**: Commercial catalyst defense and revenue expansion thesis.
  - **Bear Chief Risk Officer**: Adversarial counter-thesis grounded in Form 10-K Item 1A statutory disclosures.
  - **Regulatory Compliance Auditor**: Administrative law constraints and NHTSA/FTC compliance boundaries.
  - **Principal Arbiter**: Multi-vector scorecard weighting, Arbiter Verdict assignment (`STRATEGIC_ACCUMULATE`, `TACTICAL_HOLD`, `HEDGED_CONTAINMENT`, `EXIT_DISINVEST`), and Mandatory Risk Tripwires.

### Stage 11: Executive Intelligence Export & SEC Rule 17a-4 Audit Trail
- One-click boardroom dossier compilation in **Markdown (.md)**, **Standalone HTML (.html)** with responsive `@media print` CSS, and **JSON (.json)**.
- Deterministic **SHA-256 Cryptographic Non-Repudiation Certificate** embedded into each dossier and indexed in an immutable governance audit ledger.

---

## 🚀 Port Allocation & Docker Services

| Service | Host Port | Internal Port | Protocol | Description |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL 16 Alpine** | `5434` | `5432` | TCP / SQL | Database container (`stratify_postgres`) |
| **RabbitMQ AMQP** | `5672` | `5672` | AMQP 0-9-1 | Message broker queue (`stratify_rabbitmq`) |
| **RabbitMQ Management** | `15672` | `15672` | HTTP | Broker monitoring console (`http://localhost:15672`) |
| **FastAPI Backend** | `8000` | `8000` | HTTP / REST | API Coordinator (`http://localhost:8000/docs`) |
| **Next.js Frontend** | `3000` | `3000` | HTTP / HTML | Dark Glassmorphic Web UI (`http://localhost:3000`) |

---

## ⚡ Quickstart Execution

### 1. Start Infrastructure
```bash
docker compose up -d
```

### 2. Run Backend API
```bash
./.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Run Frontend
```bash
npm run dev --prefix frontend
```

### 4. Run Automated Test Suite
```bash
./.venv/bin/pytest tests/test_stage*.py -v -k "not broker"
```
