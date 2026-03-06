# GrandForm

**Open-source Terragrunt UI** -- Deploy AWS infrastructure through a visual interface. Select a resource, fill in a form, run `terragrunt plan`, and generate a GitHub Pull Request -- all without writing HCL.

## Features

- **Schema-driven** -- Each AWS resource is defined as a JSON file. Add new resources by adding a JSON schema.
- **Dynamic forms** -- The UI generates input forms automatically from the schema.
- **Terragrunt plan** -- Run `terragrunt plan` in a sandboxed Docker container and see live output.
- **GitHub integration** -- Create branches, commit `terragrunt.hcl` files, and open PRs via GitHub App.
- **Kubernetes-ready** -- Deploy with the included Helm chart.

## Supported Resources

| Resource | Schema | Module |
|----------|--------|--------|
| S3 Bucket | `schemas/aws/s3.json` | `terraform-aws-modules/terraform-aws-s3-bucket` |
| EC2 Instance | `schemas/aws/ec2.json` | `terraform-aws-modules/terraform-aws-ec2-instance` |
| RDS Database | `schemas/aws/rds.json` | `terraform-aws-modules/terraform-aws-rds` |
| VPC | `schemas/aws/vpc.json` | `terraform-aws-modules/terraform-aws-vpc` |
| Security Group | `schemas/aws/security-group.json` | `terraform-aws-modules/terraform-aws-security-group` |

## Architecture

```
schemas/aws/*.json    -->  Go Backend (schema loader + HCL generator)  -->  Docker Runner
                           |                                                    |
React Frontend        <--  API (/api/schemas, /api/plan)               terragrunt plan
                           |
                           GitHub App API (branches, commits, PRs)
```

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 20+
- Docker
- A GitHub App (for PR integration)

### 1. Build the Terragrunt runner

```bash
cd runner
docker build -t terragrunt-runner .
```

### 2. Start the backend

```bash
cd backend
export GITHUB_APP_ID=your-app-id
# Place your GitHub App private key as backend/github-app.pem
go run .
```

The backend runs on `http://localhost:8080`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000`.

### 4. Open in browser

Navigate to `http://localhost:3000`. Select a resource, fill in the form, and click **Run Plan**.

## API Reference

### Schema Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemas` | List all available resource schemas |
| GET | `/api/schemas/{id}` | Get full schema by ID |

### Plan Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/plan` | Run terragrunt plan |
| GET | `/api/plan/logs` | Get latest plan output |

**POST /api/plan body:**
```json
{
  "schemaId": "s3",
  "inputs": { "bucket": "my-bucket", "acl": "private" },
  "region": "eu-central-1",
  "env": "dev"
}
```

### GitHub Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/github/repos` | List repos where the GitHub App is installed |
| GET | `/api/github/branch-sha?repo=owner/repo` | Get main branch SHA |
| POST | `/api/github/create-branch` | Create a new branch |
| POST | `/api/github/commit-file` | Commit generated terragrunt.hcl |
| POST | `/api/github/create-pr` | Create a pull request |

## Adding a New Resource

Create a JSON file in `schemas/aws/`:

```json
{
  "id": "my-resource",
  "name": "My Resource",
  "description": "Description of the resource",
  "provider": "aws",
  "icon": "my-resource",
  "module": {
    "source": "git::https://github.com/terraform-aws-modules/terraform-aws-my-resource.git//?ref=v1.0.0"
  },
  "inputs": [
    {
      "name": "name",
      "label": "Resource Name",
      "type": "string",
      "required": true,
      "placeholder": "my-resource-name",
      "description": "Name for the resource"
    }
  ],
  "common_inputs": {
    "region": true,
    "environment": true,
    "tags": true
  },
  "path_template": "infra/{env}/my-resource-{name}/terragrunt.hcl"
}
```

**Input types:** `string`, `number`, `boolean`, `select`, `multiline`

Restart the backend and the new resource will appear in the UI.

## Kubernetes Deployment

### Using Helm

```bash
# Create the GitHub App PEM secret
kubectl create secret generic grandform-github-pem \
  --from-file=github-app.pem=backend/github-app.pem

# Install the chart
helm install grandform helm/grandform \
  --set backend.env.GITHUB_APP_ID=your-app-id \
  --set ingress.enabled=true \
  --set ingress.host=grandform.yourdomain.com
```

### Using Docker

```bash
# Build images
docker build -f Dockerfile.backend -t grandform-backend .
docker build -f Dockerfile.frontend -t grandform-frontend .
docker build -f runner/Dockerfile -t terragrunt-runner runner/
```

## Project Structure

```
grandform/
├── schemas/aws/          # Resource schema definitions (JSON)
├── backend/              # Go API server
│   ├── main.go           # Routes and server setup
│   ├── schema_loader.go  # Load schemas from disk
│   ├── hcl_generator.go  # Generate terragrunt.hcl from schema + inputs
│   ├── handler_schema.go # Schema API endpoints
│   ├── handler_plan.go   # Plan execution endpoint
│   └── handler_github.go # GitHub App integration
├── frontend/src/         # React application
│   ├── pages/            # HomePage (grid), ResourcePage (form)
│   ├── components/       # DynamicForm, PlanModal, PRButton, etc.
│   └── styles/           # Theme configuration
├── runner/               # Docker image for running Terragrunt
├── helm/                 # Kubernetes Helm chart
├── Dockerfile.backend    # Backend container image
└── Dockerfile.frontend   # Frontend container image
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Add your changes
4. Run the backend: `cd backend && go run .`
5. Run the frontend: `cd frontend && npm start`
6. Submit a pull request

### Adding support for new providers

1. Create a directory under `schemas/` (e.g., `schemas/gcp/`)
2. Add JSON schema files for each resource
3. The backend will automatically discover and serve them

## License

MIT
