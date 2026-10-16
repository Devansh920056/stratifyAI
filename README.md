# Stratify AI — Distributed Market Intelligence Platform

Stratify AI is a production-grade, distributed market research system. When a user submits an analytical inquiry, the platform decomposes the question into orthogonal research tasks, distributes them across independent worker processes via RabbitMQ, retrieves verifiable external evidence, analyzes evidence using an LLM, persists relational state in PostgreSQL, and synthesizes an executive intelligence report.

---

## Architecture Overview

```
[ Next.js Frontend ] (Port 3000)
        │
        ▼ HTTP REST / Polling
[ FastAPI Coordinator ] (Port 8000)
        │
        ├── ACID DB Transaction ────────┐
        ▼                               ▼
[ PostgreSQL Database ]         [ Transactional Outbox ]
  (Host Port 5434)                      │
                                        ▼ Background Relay
                                [ RabbitMQ Broker ]
                                  (AMQP Port 5672)
                                        │
                                        ▼ aio-pika (Prefetch=1, Manual Ack)
                                [ Independent Python Workers ]
                                        │
                                        ├── SearchProvider (Tavily / Mock)
                                        ├── LLMProvider (Gemini / Mock)
                                        ▼
                                [ PostgreSQL State Persistence ]
```

---

## Repository Structure

```
Stratify AI/
├── .env.example              # Template with non-default development credentials
├── .gitignore                # Excludes secrets, venvs, and build artifacts
├── pyproject.toml            # Python packaging and dependencies
├── README.md                 # System overview and operational runbook
├── docker/
│   └── docker-compose.yml    # PostgreSQL 16 & RabbitMQ 3.13 services
├── backend/
│   └── app/
│       ├── core/
│       │   └── config.py     # Pydantic Settings environment validation
│       └── ...
├── workers/                  # Independent worker process code
└── frontend/                 # Next.js TypeScript web application
```

---

## Prerequisites

- **macOS** with Apple Silicon or Intel
- **OrbStack** (or Docker Desktop) with Docker Compose v2+
- **Python 3.11+** (Python 3.13 supported) with `uv`
- **Node.js 18+** (Node v25+ supported) and `npm`

---

## Port Allocation Strategy

| Service | Internal Port | Host Port | Rationale |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Container** | `5432` | `5434` | Bound to `127.0.0.1:5434` to prevent collisions with existing macOS Homebrew PostgreSQL services on `5432`. |
| **RabbitMQ AMQP** | `5672` | `5672` | Standard AMQP message broker protocol port. Bound to `127.0.0.1`. |
| **RabbitMQ Management** | `15672` | `15672` | RabbitMQ Web Management Dashboard. Bound to `127.0.0.1`. |
| **FastAPI Backend** | `8000` | `8000` | Local HTTP API server. |
| **Next.js Frontend** | `3000` | `3000` | Local Web Application. |

---

## Local Infrastructure Quickstart

### 1. Configure Local Environment
```bash
cp .env.example .env
```

### 2. Start PostgreSQL and RabbitMQ Services
From the repository root:
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 3. Verify Container Health
```bash
docker compose -f docker/docker-compose.yml ps
```
Both `stratify_postgres` and `stratify_rabbitmq` should report `Up (healthy)`.

### 4. Inspect RabbitMQ Management UI
Open your browser to:
[http://127.0.0.1:15672](http://127.0.0.1:15672)
- **Username:** `stratify_broker`
- **Password:** `broker_dev_secret_change_me` (or your configured value in `.env`)

### 5. Tear Down Infrastructure
To stop containers without losing data:
```bash
docker compose -f docker/docker-compose.yml down
```
To stop containers and wipe persistent volumes (disposable reset):
```bash
docker compose -f docker/docker-compose.yml down -v
```
