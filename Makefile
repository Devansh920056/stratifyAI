.PHONY: help up down restart ps migrate dev test lint format frontend-build clean

PYTHON := .venv/bin/python
PYTEST := .venv/bin/pytest
COMPOSE := docker compose -f docker/docker-compose.yml

help:
	@echo "Stratify AI — Available Commands:"
	@echo "  make up              Start PostgreSQL & RabbitMQ docker containers"
	@echo "  make down            Stop docker containers"
	@echo "  make ps              Check container health status"
	@echo "  make migrate         Run Alembic database migrations"
	@echo "  make dev             Launch full system (FastAPI, Relay, Worker, Frontend)"
	@echo "  make test            Run all 68 automated pytest tests"
	@echo "  make lint            Run ruff linter checks"
	@echo "  make format          Run ruff code formatter"
	@echo "  make frontend-build  Compile and validate Next.js production build"

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

migrate:
	$(PYTHON) -m alembic upgrade head

dev:
	$(PYTHON) run_system.py

test:
	$(PYTEST) -v

lint:
	uv run --with ruff ruff check .

format:
	uv run --with ruff ruff format .

frontend-build:
	cd frontend && npm run build

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
