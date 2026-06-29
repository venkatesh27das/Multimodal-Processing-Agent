PYTHON ?= python3
VENV ?= .venv
PIP := $(VENV)/bin/pip
PY := $(VENV)/bin/python
UVICORN := $(VENV)/bin/uvicorn
API_HOST ?= 0.0.0.0
API_PORT ?= 8000
WEB_PORT ?= 3000

.PHONY: help install install-api install-web api agent-api agent-worker web dev docker-up docker-down verify verify-api verify-web clean clean-state

help:
	@echo "Common commands:"
	@echo "  make install      Install backend and frontend dependencies"
	@echo "  make api          Run API only on port $(API_PORT)"
	@echo "  make agent-api    Alias for API-only agent service"
	@echo "  make agent-worker Run persisted parser-agent task worker"
	@echo "  make web          Run frontend on port $(WEB_PORT)"
	@echo "  make docker-up    Build and run the full app with Docker Compose"
	@echo "  make verify       Run backend and frontend verification"
	@echo "  make clean        Remove generated caches and build outputs"
	@echo "  make clean-state  Also remove local runtime DB/storage"

install: install-api install-web

install-api:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -U pip
	$(PIP) install -e ".[dev,postgres]"

install-web:
	cd frontend && npm ci

api:
	$(UVICORN) backend.app.main:app --reload --host $(API_HOST) --port $(API_PORT)

agent-api: api

agent-worker:
	$(PY) -m backend.app.workers.agent_worker

web:
	cd frontend && npm run dev -- --port $(WEB_PORT)

dev:
	@echo "Run these in two terminals: make api and make web"

docker-up:
	docker compose up --build

docker-down:
	docker compose down

verify: verify-api verify-web

verify-api:
	$(PY) -m pytest
	$(PY) -m ruff check backend tests
	PYTHONPYCACHEPREFIX=/tmp/mmpa-pycache $(PY) -m compileall backend/app

verify-web:
	cd frontend && npm run typecheck
	cd frontend && npm run lint

clean:
	rm -rf .pytest_cache .ruff_cache .mypy_cache
	rm -rf backend/__pycache__ backend/app/__pycache__ tests/__pycache__
	find backend tests -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf frontend/.next frontend/tsconfig.tsbuildinfo
	rm -rf build dist *.egg-info

clean-state: clean
	rm -rf local.db local.db-journal storage
