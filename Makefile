# FastChat Application Makefile

# Variables
COMPOSE_FILE = infra/docker-compose.yml
PROJECT_NAME = fastchat

# Default target
.PHONY: help
help:
	@echo "FastChat Application - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make logs        - Show logs for all services"
	@echo "  make logs-backend - Show backend logs"
	@echo "  make logs-frontend - Show frontend logs"
	@echo ""
	@echo "Building:"
	@echo "  make build       - Build all Docker images"
	@echo "  make build-backend - Build backend image"
	@echo "  make build-frontend - Build frontend image"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean       - Remove containers, networks, and images"
	@echo "  make prune       - Remove unused Docker resources"
	@echo "  make shell-backend - Open shell in backend container"
	@echo "  make shell-frontend - Open shell in frontend container"
	@echo ""
	@echo "Database:"
	@echo "  make migrate     - Run database migrations"
	@echo "  make migrate-up  - Apply pending migrations"
	@echo "  make migrate-down - Rollback last migration"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run backend tests"
	@echo "  make test-frontend - Run frontend tests"
	@echo "  make lint        - Run linting checks"

# Development commands
.PHONY: up
up:
	@echo "Starting FastChat services..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) up -d

.PHONY: down
down:
	@echo "Stopping FastChat services..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) down

.PHONY: restart
restart: down up

.PHONY: logs
logs:
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) logs -f

.PHONY: logs-backend
logs-backend:
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) logs -f backend

.PHONY: logs-frontend
logs-frontend:
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) logs -f frontend

# Building commands
.PHONY: build
build:
	@echo "Building all Docker images..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) build

.PHONY: build-backend
build-backend:
	@echo "Building backend image..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) build backend

.PHONY: build-frontend
build-frontend:
	@echo "Building frontend image..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) build frontend

# Maintenance commands
.PHONY: clean
clean:
	@echo "Cleaning up Docker resources..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) down -v --rmi all

.PHONY: prune
prune:
	@echo "Removing unused Docker resources..."
	docker system prune -f

.PHONY: shell-backend
shell-backend:
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend /bin/bash

.PHONY: shell-frontend
shell-frontend:
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec frontend /bin/sh

# Database commands
.PHONY: migrate
migrate:
	@echo "Running database migrations..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend alembic upgrade head

.PHONY: migrate-up
migrate-up:
	@echo "Applying pending migrations..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend alembic upgrade +1

.PHONY: migrate-down
migrate-down:
	@echo "Rolling back last migration..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend alembic downgrade -1

# Testing commands
.PHONY: test
test:
	@echo "Running backend tests..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend python -m pytest

.PHONY: test-frontend
test-frontend:
	@echo "Running frontend tests..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec frontend npm test

.PHONY: lint
lint:
	@echo "Running linting checks..."
	@echo "Backend linting..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend black --check .
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec backend ruff check .
	@echo "Frontend linting..."
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) exec frontend npm run lint

# Status commands
.PHONY: status
status:
	@echo "Service Status:"
	docker-compose -f $(COMPOSE_FILE) -p $(PROJECT_NAME) ps

.PHONY: health
health:
	@echo "Health Check:"
	@echo "Backend:"
	@curl -f http://localhost:8000/health || echo "Backend is not healthy"
	@echo "Frontend:"
	@curl -f http://localhost:3000/health || echo "Frontend is not healthy"
