# Wolkvorm `BETA`

> **Note:** Wolkvorm is currently in **beta**. Features may change and bugs are expected. Feedback and contributions are welcome.

**Shape Your Cloud Infrastructure** — Deploy AWS resources through visual forms. No HCL knowledge required. Wolkvorm generates Terraform configurations, manages state, and runs plan/apply in sandboxed containers.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- AWS IAM Role (EC2 instance profile)

### Install with Pre-built Images (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/wolkvorm/wolkvorm/main/docker-compose.prod.yml -o docker-compose.yml
docker compose up -d
```

### Install from Source

```bash
git clone https://github.com/wolkvorm/wolkvorm.git
cd wolkvorm
docker compose up -d --build
```

Open `http://localhost:3000` in your browser. The first visit will prompt you to create an admin account.

### Update

```bash
# Pre-built images
docker compose pull && docker compose up -d

# From source
git pull && docker compose up -d --build
```

### Ports

| Service  | Port | Description |
|----------|------|-------------|
| Frontend | 3000 | React UI (nginx proxy) |
| Backend  | 8080 | Go API server |

## Deploy to EC2

### 1. Launch an EC2 Instance

- **AMI**: Ubuntu 22.04 LTS
- **Type**: `t3.medium` (2 vCPU, 4 GB RAM — sufficient for single user)
- **Storage**: 30 GB gp3
- **Security Group**: Open ports 22 (SSH), 3000 (UI), 8080 (API)
- **IAM Role**: Attach a role with permissions for the AWS services you want to manage

### 2. Install and Run

```bash
ssh -i your-key.pem ubuntu@<PUBLIC_IP>

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Option 1: Pre-built images (fast, ~30 seconds)
curl -fsSL https://raw.githubusercontent.com/wolkvorm/wolkvorm/main/docker-compose.prod.yml -o docker-compose.yml
docker compose up -d

# Option 2: Build from source (for customization, ~5 minutes)
git clone https://github.com/wolkvorm/wolkvorm.git ~/wolkvorm
cd ~/wolkvorm
docker compose up -d --build
```

## Supported Services (25)

### Compute

| Service | Schema | Module |
|---------|--------|--------|
| EC2 Instance | `schemas/aws/ec2.json` | `terraform-aws-modules/ec2-instance` |
| EKS Cluster | `schemas/aws/eks.json` | `terraform-aws-modules/eks` |
| EKS Addons | `schemas/aws/eks-addons.json` | Custom EKS addons module |
| ECS | `schemas/aws/ecs.json` | `terraform-aws-modules/ecs` |
| Lambda | `schemas/aws/lambda.json` | `terraform-aws-modules/lambda` |
| Auto Scaling | `schemas/aws/autoscaling.json` | `terraform-aws-modules/autoscaling` |

### Storage & Database

| Service | Schema | Module |
|---------|--------|--------|
| S3 Bucket | `schemas/aws/s3.json` | `terraform-aws-modules/s3-bucket` |
| RDS | `schemas/aws/rds.json` | `terraform-aws-modules/rds` |
| DynamoDB | `schemas/aws/dynamodb.json` | `terraform-aws-modules/dynamodb-table` |
| ElastiCache | `schemas/aws/elasticache.json` | `terraform-aws-modules/elasticache` |

### Networking

| Service | Schema | Module |
|---------|--------|--------|
| VPC | `schemas/aws/vpc.json` | `terraform-aws-modules/vpc` |
| ALB | `schemas/aws/alb.json` | `terraform-aws-modules/alb` |
| CloudFront | `schemas/aws/cloudfront.json` | `terraform-aws-modules/cloudfront` |
| Route 53 | `schemas/aws/route53.json` | `terraform-aws-modules/route53` |
| Security Group | `schemas/aws/security-group.json` | `terraform-aws-modules/security-group` |
| API Gateway | `schemas/aws/apigateway.json` | `terraform-aws-modules/apigateway-v2` |

### Security & Identity

| Service | Schema | Module |
|---------|--------|--------|
| IAM Role | `schemas/aws/iam-role.json` | `terraform-aws-modules/iam` |
| IAM Policy | `schemas/aws/iam-policy.json` | `terraform-aws-modules/iam` |
| KMS | `schemas/aws/kms.json` | `terraform-aws-modules/kms` |
| Secrets Manager | `schemas/aws/secrets-manager.json` | Custom module |
| ACM | `schemas/aws/acm.json` | `terraform-aws-modules/acm` |
| Key Pair | `schemas/aws/key-pair.json` | `terraform-aws-modules/key-pair` |

### Messaging & Containers

| Service | Schema | Module |
|---------|--------|--------|
| SNS | `schemas/aws/sns.json` | `terraform-aws-modules/sns` |
| SQS | `schemas/aws/sqs.json` | `terraform-aws-modules/sqs` |
| ECR | `schemas/aws/ecr.json` | `terraform-aws-modules/ecr` |

## Features

- **Form-Based Deployment** — Select a resource, fill a form, click deploy. No HCL or CLI needed.
- **Real-Time Logs** — WebSocket-streamed terraform plan/apply output with persistent floating operation bars.
- **Resource Graph** — Interactive dependency graph showing how resources connect.
- **My Resources** — Track all deployed resources with status, outputs, and one-click destroy.
- **Cost Dashboard** — Estimate costs before deploying, track spending across resources.
- **Approval Workflows** — Require team approval before applying changes to production.
- **Audit Logs** — Complete history of every plan, apply, and destroy operation.
- **Policy Engine** — Enforce naming conventions, required tags, allowed instance types.
- **Import Existing Resources** — Scan your AWS account and import resources into Wolkvorm.
- **Multi-Environment** — Manage dev, staging, and production from one dashboard.
- **GitHub PR Integration** — Generate Terraform HCL and open pull requests directly from the UI.
- **Dark / Light Mode** — Full theme support across the entire UI.
- **RBAC** — Role-based access control (admin, operator, deployer, viewer).
- **S3 State Backend** — Automatic remote state management with S3.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React UI  │────▶│   Go Backend     │────▶│  Docker Runner   │
│  (nginx)    │◀────│   (API + WS)     │◀────│  (Terraform)     │
│  port 3000  │     │   port 8080      │     │                  │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                           │                          │
                    ┌──────┴──────┐            ┌──────┴──────┐
                    │   SQLite    │            │    AWS API   │
                    │  (app data) │            │  (resources) │
                    └─────────────┘            └─────────────┘
                    ┌─────────────┐
                    │  S3 Bucket  │
                    │  (tf state) │
                    └─────────────┘
```

## Configuration

### AWS Credentials

Go to **Settings > AWS** in the UI:

- **IAM Role** (recommended for EC2): No credentials needed — uses instance profile.
- **Access Key**: Enter AWS Access Key ID and Secret Access Key.
- **Default Region**: Set the default AWS region for new resources.

### S3 State Backend

Go to **Settings > AWS** and configure:

- **S3 Bucket Name**: Bucket for storing Terraform state files.
- **DynamoDB Table** (optional): For state locking.

Then go to **My Resources** and click **Initialize State Backend**.

### GitHub Integration (optional)

Go to **Settings > GitHub**:

- Create a GitHub App with repository read/write permissions.
- Enter the App ID and upload the private key PEM file.

## Adding a Custom Resource

Create a JSON file in `schemas/aws/`:

```json
{
  "id": "my-service",
  "name": "My Service",
  "description": "Description of the service",
  "provider": "aws",
  "icon": "my-service",
  "category": "compute",
  "module": {
    "source": "git::https://github.com/terraform-aws-modules/terraform-aws-my-service.git?ref=main",
    "outputs": ["arn", "id"]
  },
  "inputs": [
    {
      "name": "name",
      "label": "Service Name",
      "type": "string",
      "required": true,
      "placeholder": "my-service",
      "description": "Name for the service"
    },
    {
      "name": "instance_type",
      "label": "Instance Type",
      "type": "select",
      "default": "t3.micro",
      "options": ["t3.micro", "t3.small", "t3.medium"],
      "description": "Instance size",
      "advanced": true
    }
  ],
  "common_inputs": {
    "region": true,
    "environment": true,
    "tags": true
  },
  "path_template": "infra/{env}/my-service-{name}/main.tf"
}
```

**Input types:** `string`, `number`, `boolean`, `select`, `multiline`, `hcl`, `nodegroups`

**Special fields:**
- `advanced: true` — Hidden under "Advanced Settings" toggle
- `required: true` — Form validation enforced
- `aws_resource: "vpc"` — Enables live AWS resource picker dropdown
- `multi: true` — Comma-separated list input

Restart the backend and the new resource appears in the UI.

## API Reference

### Schemas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemas` | List all resource schemas |
| GET | `/api/schemas/{id}` | Get schema by ID |

### Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/plan` | Run terraform plan |
| POST | `/api/apply` | Run terraform apply |
| POST | `/api/destroy` | Run terraform destroy |
| WS | `/api/ws/run` | WebSocket for real-time operation logs |
| GET | `/api/plan/history` | List execution history |
| GET | `/api/plan/history/{id}` | Get execution detail with full logs |

### Resources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resources` | List managed resources |
| GET | `/api/resources/{id}` | Get resource details |
| POST | `/api/resources/{id}/refresh-outputs` | Fetch outputs from Terraform state |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get current settings |
| POST | `/api/settings/aws` | Configure AWS credentials and region |
| POST | `/api/settings/github` | Configure GitHub App |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/graph` | Get resource dependency graph |
| POST | `/api/cost-estimate` | Estimate resource cost |
| GET | `/api/audit` | List audit log entries |
| GET | `/api/approvals` | List pending approvals |
| POST | `/api/import/scan` | Scan AWS for importable resources |
| POST | `/api/import/execute` | Import scanned resources |

## Project Structure

```
wolkvorm/
├── schemas/aws/           # Resource schema definitions (25 JSON files)
├── modules/aws/           # Terraform modules (forked from terraform-aws-modules)
├── backend/               # Go API server
│   ├── main.go            # Routes, middleware, server setup
│   ├── schema_loader.go   # Load and serve JSON schemas
│   ├── hcl_generator.go   # Generate Terraform HCL from schema + inputs
│   ├── handler_plan.go    # Plan/apply/destroy execution (HTTP)
│   ├── handler_ws.go      # WebSocket-based operation streaming
│   ├── handler_resources.go # Resource CRUD and output fetching
│   ├── handler_github.go  # GitHub App PR integration
│   ├── handler_graph.go   # Resource dependency graph
│   ├── database.go        # SQLite database layer
│   └── auth.go            # Authentication and RBAC
├── frontend/src/          # React application
│   ├── pages/             # ResourcePage, MyResourcesPage, GraphPage, etc.
│   ├── components/        # DynamicForm, PlanModal, NodeGroupEditor, OperationBars
│   └── contexts/          # ThemeContext, AuthContext, OperationContext
├── runner/                # Docker image for running Terraform
├── landing/               # Landing page (wolkvorm.com)
├── docker-compose.yml     # Production deployment
├── Dockerfile.backend     # Backend container
└── Dockerfile.frontend    # Frontend container (nginx)
```

## Development

### Backend

```bash
cd backend
go run .
```

Runs on `http://localhost:8080`. Set `SCHEMAS_DIR` to point to your schemas folder.

### Frontend

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:8080 npm start
```

Runs on `http://localhost:3000` with hot reload.

## Instance Size Guide

| Users | Instance | RAM | Monthly Cost |
|-------|----------|-----|-------------|
| 1 | t3.medium | 4 GB | ~$30 |
| 2-3 | t3.large | 8 GB | ~$60 |
| 4+ | t3.xlarge | 16 GB | ~$120 |

Each concurrent terraform operation uses ~200-500 MB RAM in a Docker container.

## License

MIT
