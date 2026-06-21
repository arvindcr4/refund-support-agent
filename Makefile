.DEFAULT_GOAL := help
.PHONY: help install backend frontend test eval seed reset

help:
	@echo "Targets:"
	@echo "  install   Set up backend venv deps (+ dev) + frontend npm install"
	@echo "  backend   Run FastAPI server (uvicorn) on port 8000"
	@echo "  frontend  Run frontend dev server (npm run dev)"
	@echo "  test      Run backend pytest suite"
	@echo "  eval      Run the live agent eval over all 16 orders"
	@echo "  seed      Reset backend state (alias: reset)"
	@echo "  reset     Reset backend state via POST /api/reset"

install:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt -r requirements-dev.txt
	cd frontend && npm install

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && . .venv/bin/activate && python -m pytest tests/ -q

eval:
	cd backend && . .venv/bin/activate && python -m eval.run_eval

seed reset:
	curl -s -X POST localhost:8000/api/reset
