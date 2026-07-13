.PHONY: up down test lint typecheck build seed

up:
	docker compose up --build

down:
	docker compose down

test:
	cd backend && pytest
	cd frontend && npm test -- --run

lint:
	cd backend && ruff check .
	cd frontend && npm run lint

typecheck:
	cd backend && mypy app
	cd frontend && npm run typecheck

build:
	cd frontend && npm run build

seed:
	cd backend && python -m app.seed

