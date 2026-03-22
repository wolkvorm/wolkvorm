.PHONY: build build-backend build-frontend test lint docker docker-up docker-down clean help

BINARY_NAME=wolkvorm-backend

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: build-backend build-frontend ## Build both backend and frontend

build-backend: ## Build Go backend binary
	cd backend && CGO_ENABLED=0 go build -o ../$(BINARY_NAME) .

build-frontend: ## Build React frontend
	cd frontend && npm run build

test: ## Run backend tests
	cd backend && go test -v -race ./...

test-cover: ## Run backend tests with coverage
	cd backend && go test -v -race -coverprofile=coverage.out ./...
	cd backend && go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: backend/coverage.html"

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Go code
	cd backend && go vet ./...
	@which golangci-lint > /dev/null 2>&1 && cd backend && golangci-lint run || echo "golangci-lint not installed, skipping"

lint-frontend: ## Lint frontend code
	cd frontend && npx eslint src/ --max-warnings=0 || true

schemas: ## Validate JSON schemas
	@echo "Validating schemas..."
	@for f in schemas/aws/*.json; do \
		python3 -c "import json; json.load(open('$$f'))" || exit 1; \
		echo "  OK: $$f"; \
	done
	@echo "All schemas valid."

docker: ## Build all Docker images
	docker compose build

docker-up: ## Start all services
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

docker-logs: ## Tail logs from all services
	docker compose logs -f

deps-backend: ## Download Go dependencies
	cd backend && go mod download && go mod tidy

deps-frontend: ## Install frontend dependencies
	cd frontend && npm install

deps: deps-backend deps-frontend ## Install all dependencies

clean: ## Clean build artifacts
	rm -f $(BINARY_NAME)
	rm -f backend/coverage.out backend/coverage.html
	rm -rf frontend/build
