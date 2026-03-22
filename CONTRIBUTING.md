# Contributing to Wolkvorm

Thank you for your interest in contributing to Wolkvorm! This document provides guidelines and information for contributors.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/wolkvorm/wolkvorm/issues) to avoid duplicates
2. Use the **Bug Report** issue template
3. Include steps to reproduce, expected behavior, and actual behavior
4. Add screenshots or logs if applicable

### Suggesting Features

1. Open a [Feature Request](https://github.com/wolkvorm/wolkvorm/issues/new?template=feature_request.md)
2. Describe the problem you're trying to solve
3. Propose a solution if you have one

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch from `main`: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests and linting: `make test && make lint`
5. Commit with a descriptive message following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `chore:` for maintenance tasks
   - `refactor:` for code restructuring
6. Push to your fork and open a PR against `main`
7. Fill in the PR template

### Development Setup

**Prerequisites:**
- Go 1.21+
- Node.js 20+
- Docker and Docker Compose

**Quick start:**

```bash
# Clone the repository
git clone https://github.com/wolkvorm/wolkvorm.git
cd wolkvorm

# Build everything
make build

# Run locally
docker compose up -d --build
```

**Backend (Go):**

```bash
cd backend
go build ./...
go test ./...
```

**Frontend (React):**

```bash
cd frontend
npm install
npm run build
```

## Project Structure

```
wolkvorm/
├── backend/          # Go backend (API server)
├── frontend/         # React frontend
├── runner/           # Sandboxed Terraform/OpenTofu runner container
├── schemas/          # JSON schema definitions for cloud resources
│   ├── aws/          # AWS resource schemas
│   ├── azure/        # Azure resource schemas
│   ├── gcp/          # GCP resource schemas
│   ├── huawei/       # Huawei Cloud resource schemas
│   └── digitalocean/ # DigitalOcean resource schemas
├── modules/          # Terraform modules
├── charts/           # Helm chart for Kubernetes deployment
└── landing/          # Landing page (wolkvorm.com)
```

## Coding Standards

- **Go:** Follow standard Go conventions. Run `gofmt` before committing.
- **JavaScript:** No TypeScript in this project. Use functional components and hooks.
- **Styles:** Inline styles with theme context. No Tailwind or CSS modules.
- **Comments:** Only add comments for non-obvious logic. Avoid narrating code.

## Adding a New Cloud Resource Schema

1. Create a JSON file in `schemas/<provider>/` (e.g., `schemas/aws/my-resource.json`)
2. Define inputs with `name`, `label`, `type`, `description`, `default`, and `advanced` flag
3. The schema will be automatically loaded by the backend on startup

## License

By contributing to Wolkvorm, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
