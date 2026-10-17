# Stratify AI — Multi-Agent Growth & Market Intelligence Platform

Stratify AI is a production-grade, distributed autonomous market research system. When an analyst submits a high-stakes market question, the platform decomposes the inquiry into 4 orthogonal research tasks, distributes them across independent Python worker processes via RabbitMQ, retrieves verifiable real web evidence (Tavily Search API), conducts structured AI reasoning with anti-hallucination citation guardrails (Google Gemini), persists state with Optimistic Concurrency Control (OCC) in PostgreSQL 16, synthesizes an executive intelligence report, and streams real-time execution telemetry to a responsive Next.js frontend.

---

## 🏛️ System Architecture

```
                    ┌─────────────────────────────────────────┐
                    │      Next.js 16 Responsive Frontend     │
                    │        (Port 3000 • Dark Glassmorphic)   │
                    └────────────────────┬────────────────────┘
                                         │ HTTP REST Polling (2s)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │       FastAPI API Coordinator           │
                    │          (Port 8000 • Uvicorn)          │
                    └────────────┬────────────────────────────┘
                                 │
                     ACID Database Transaction
                     (Job + 4 Tasks + 4 Outbox Events)
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  PostgreSQL 16 Database │
                    │   (Host Port 5434, OCC) │
                    └────────────┬────────────┘
                                 │
                   Background Poller (SELECT ... FOR UPDATE SKIP LOCKED)
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Outbox Relay Daemon    │
                    └────────────┬────────────┘
                                 │ Publisher Confirms (delivery_mode=2)
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │        RabbitMQ 3.13 Broker             │
                    │   Exchange: stratify.tasks.exchange     │
                    │   Queue:    stratify.tasks.queue        │
                    │   DLQ:      stratify.tasks.dlq          │
                    └────────────┬────────────────────────────┘
                                 │ aio-pika (Prefetch QoS=1..2, Manual Ack)
                                 ▼
              ┌───────────────────────────────────────────────┐
              │          Independent Worker Cluster           │
              │  (Worker Task Processor • Bounded Retries 3x) │
              └──────────────┬─────────────────┬──────────────┘
                             │                 │
                             ▼                 ▼
                 ┌───────────────────┐ ┌───────────────────┐
                 │ Tavily Search API │ │ Google Gemini LLM │
                 │ Real Web Evidence │ │ Grounded Analysis │
                 └───────────────────┘ └───────────────────┘
                             │                 │
                             └────────┬────────┘
                                      │
                        State Persistence (OCC version++)
                        Manual ACK strictly after DB Commit
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │         Report Aggregator Engine        │
                    │  (Citation Deduplication • Cross-Vector)│
                    └─────────────────────────────────────────┘
```

---

## 🔬 Distributed Systems Invariants

| System Layer | Invariant Guarantee | Implementation Detail |
| :--- | :--- | :--- |
| **Transactional Outbox** | At-least-once task dispatch | Tasks and outbox events inserted in a single atomic DB transaction. |
| **Publisher Confirms** | Zero silent drop during broker push | RabbitMQ publisher confirms enabled (`channel.confirm_delivery()`). |
| **Broker Topology** | Resilient routing with DLQ safety | Topic exchange (`stratify.tasks.exchange`) routed to durable queue with dead-letter exchange (`stratify.tasks.dlx`). |
| **Consumer Acks** | Manual ACK strictly after commit | Messages are acknowledged only after database state commits. Bounded retries (3x) before dead-letter rejection (`requeue=False`). |
| **OCC & Idempotency** | Race-free duplicate execution | Integer `version` column increments on each write (`UPDATE ... WHERE version = :expected`). `UNIQUE(task_id)` enforces result idempotency. |
| **Grounding & Guardrails** | Zero hallucinated citations | Post-generation citation check verifies every claim URL against retrieved evidence. |
| **Graceful Degradation** | High-availability report fallback | When worker tasks fail or timeout, aggregator synthesizes `PARTIAL` report with limitations callout. |

---

## 🚀 Port Allocation Strategy

| Service | Host Port | Internal Port | Rationale |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Container** | `5434` | `5432` | Bound to `127.0.0.1:5434` to prevent collisions with existing local PostgreSQL services. |
| **RabbitMQ AMQP** | `5672` | `5672` | AMQP protocol for reliable message pub/sub. |
| **RabbitMQ Management** | `15672` | `15672` | Broker web management console. |
| **FastAPI Backend** | `8000` | `8000` | REST API, OpenAPI docs, and job telemetry endpoints. |
| **Next.js Frontend** | `3000` | `3000` | Web user interface with live telemetry and report synthesis. |

---

## ⚡ Quickstart & Local Execution

### 1. Prerequisites
- **macOS** (Apple Silicon or Intel)
- **OrbStack** or **Docker Desktop**
- **Python 3.11+** (Python 3.13 supported) with `uv`
- **Node.js 18+** and `npm`

### 2. Configure Environment
```bash
cp .env.example .env
```
*(Optionally provide live `TAVILY_API_KEY` and `GEMINI_API_KEY` in `.env`. Deterministic mock providers are active by default).*

### 3. Start Infrastructure Containers
```bash
make up
make ps
```

### 4. Run Migrations & Launch All Services
```bash
make dev
```
*(Runs FastAPI on port 8000, Outbox Relay daemon, Python Worker cluster, and Next.js frontend on port 3000 with unified signal handling).*

Access the services:
- **Web UI:** [http://localhost:3000](http://localhost:3000)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **RabbitMQ Dashboard:** [http://localhost:15672](http://localhost:15672) (User: `stratify_broker`, Pass: `broker_dev_secret_change_me`)

---

## 🧪 Automated Test Suite (68 Tests)

Stratify AI includes 68 comprehensive automated tests verifying all 10 stages:
```bash
make test
```
```text
tests/test_stage10_e2e.py::test_e2e_full_distributed_lifecycle PASSED    [  1%]
tests/test_stage10_e2e.py::test_e2e_partial_degradation_and_dlq_handling PASSED [  2%]
tests/test_stage10_e2e.py::test_e2e_concurrent_multi_job_orchestration PASSED [  4%]
tests/test_stage1_foundation.py (5 tests) PASSED
tests/test_stage2_database.py (6 tests) PASSED
tests/test_stage3_api.py (9 tests) PASSED
tests/test_stage4_broker.py (6 tests) PASSED
tests/test_stage5_workers.py (4 tests) PASSED
tests/test_stage6_search.py (15 tests) PASSED
tests/test_stage7_llm.py (13 tests) PASSED
tests/test_stage8_aggregator.py (7 tests) PASSED
============================== 68 passed in 7.45s ==============================
```

---

## 🛠️ Developer Commands

| Command | Description |
| :--- | :--- |
| `make up` | Start PostgreSQL & RabbitMQ docker containers |
| `make down` | Stop docker containers |
| `make ps` | Check container health status |
| `make migrate` | Run Alembic database migrations |
| `make dev` | Launch unified platform (`run_system.py`) |
| `make test` | Run complete automated test suite (68 tests) |
| `make lint` | Run ruff code linter |
| `make format` | Run ruff code formatter |
| `make frontend-build` | Validate Next.js production compilation |
| `make clean` | Remove temporary caches (`__pycache__`, `.pytest_cache`) |
