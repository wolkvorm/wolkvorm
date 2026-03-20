terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = ">= 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

provider "aws" {
  region = var.region
}

locals {
  tags = {
    Project     = "wolkvorm"
    Environment = "test"
    ManagedBy   = "terraform"
  }
}

resource "random_id" "suffix" {
  byte_length = 4
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

################################################################################
# LAYER 1 - Independent modules (no cross-dependencies)
################################################################################

module "vpc" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/vpc?ref=main"

  name = var.name_prefix
  cidr = "10.0.0.0/16"

  azs              = slice(data.aws_availability_zones.available.names, 0, 2)
  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets  = ["10.0.11.0/24", "10.0.12.0/24"]
  database_subnets = ["10.0.21.0/24", "10.0.22.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group = true

  tags = local.tags
}

module "kms" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/kms?ref=main"

  description             = "Wolkvorm test KMS key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.tags
}

module "s3" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/s3?ref=main"

  bucket        = "${var.name_prefix}-${random_id.suffix.hex}"
  force_destroy = true

  tags = local.tags
}

module "dynamodb" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/dynamodb?ref=main"

  name         = var.name_prefix
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attributes = [
    { name = "id", type = "S" }
  ]

  tags = local.tags
}

module "ecr" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/ecr?ref=main"

  repository_name                 = var.name_prefix
  repository_image_tag_mutability = "MUTABLE"
  repository_image_scan_on_push   = false

  tags = local.tags
}

module "sqs" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/sqs?ref=main"

  name = var.name_prefix

  tags = local.tags
}

module "sns" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/sns?ref=main"

  name = var.name_prefix

  tags = local.tags
}

module "secrets_manager" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/secrets-manager?ref=main"

  name          = "${var.name_prefix}-${random_id.suffix.hex}"
  description   = "Wolkvorm test secret"
  secret_string = jsonencode({ test_key = "test_value" })

  tags = local.tags
}

module "key_pair" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/key-pair?ref=main"

  key_name           = var.name_prefix
  create_private_key = true

  tags = local.tags
}

module "iam_role" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/iam-role?ref=main"

  name = var.name_prefix

  trust_policy_permissions = {
    ec2_lambda = {
      actions = ["sts:AssumeRole"]
      effect  = "Allow"
      principals = [
        {
          type        = "Service"
          identifiers = ["ec2.amazonaws.com", "lambda.amazonaws.com"]
        }
      ]
    }
  }

  policies = {
    s3_read = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
  }

  tags = local.tags
}

module "iam_policy" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/iam-policy?ref=main"

  name        = var.name_prefix
  description = "Wolkvorm test IAM policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = "*"
      }
    ]
  })

  tags = local.tags
}

module "ecs" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/ecs?ref=main"

  cluster_name = var.name_prefix

  tags = local.tags
}

module "apigateway" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/apigateway?ref=main"

  name          = var.name_prefix
  description   = "Wolkvorm test API"
  protocol_type = "HTTP"

  create_domain_name    = false
  create_domain_records = false
  create_certificate    = false

  tags = local.tags
}

################################################################################
# LAYER 2 - VPC-dependent modules
################################################################################

module "security_group" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/security-group?ref=main"

  name        = var.name_prefix
  description = "Wolkvorm test security group"
  vpc_id      = module.vpc.vpc_id

  ingress_with_cidr_blocks = [
    { from_port = 80, to_port = 80, protocol = "tcp", cidr_blocks = "0.0.0.0/0", description = "HTTP" },
    { from_port = 443, to_port = 443, protocol = "tcp", cidr_blocks = "0.0.0.0/0", description = "HTTPS" },
    { from_port = 22, to_port = 22, protocol = "tcp", cidr_blocks = "10.0.0.0/8", description = "SSH" },
    { from_port = 3306, to_port = 3306, protocol = "tcp", cidr_blocks = "10.0.0.0/8", description = "MySQL/RDS" },
    { from_port = 6379, to_port = 6379, protocol = "tcp", cidr_blocks = "10.0.0.0/8", description = "Redis" },
  ]

  egress_with_cidr_blocks = [
    { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = "0.0.0.0/0", description = "All outbound" }
  ]

  tags = local.tags
}

module "route53" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/route53?ref=main"

  name         = "${var.name_prefix}.internal"
  comment      = "Wolkvorm test private zone"
  private_zone = true
  create_zone  = true

  vpc = {
    main = { vpc_id = module.vpc.vpc_id }
  }

  tags = local.tags
}

################################################################################
# LAYER 3 - VPC + Security Group dependent modules
################################################################################

module "alb" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/alb?ref=main"

  name    = var.name_prefix
  vpc_id  = module.vpc.vpc_id
  subnets = module.vpc.public_subnets

  security_groups            = [module.security_group.security_group_id]
  enable_deletion_protection = false

  tags = local.tags
}

module "rds" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/rds?ref=main"

  identifier = var.name_prefix

  engine               = "mysql"
  engine_version       = "8.0"
  major_engine_version = "8.0"
  family               = "mysql8.0"
  instance_class       = "db.t3.micro"

  allocated_storage = 20
  storage_type      = "gp2"

  db_name                     = "wolkvorm"
  username                    = "admin"
  manage_master_user_password = true

  vpc_security_group_ids = [module.security_group.security_group_id]
  db_subnet_group_name   = module.vpc.database_subnet_group_name

  skip_final_snapshot = true
  deletion_protection = false
  multi_az            = false

  tags = local.tags
}

module "elasticache" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/elasticache?ref=main"

  cluster_id           = "${var.name_prefix}-${random_id.suffix.hex}"
  replication_group_id = "${var.name_prefix}-rg-${random_id.suffix.hex}"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1

  subnet_ids         = module.vpc.private_subnets
  security_group_ids = [module.security_group.security_group_id]

  tags = local.tags
}

module "ec2" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/ec2?ref=main"

  name = var.name_prefix
  ami  = data.aws_ami.amazon_linux.id

  instance_type          = "t3.nano"
  key_name               = module.key_pair.key_pair_name
  monitoring             = false
  vpc_security_group_ids = [module.security_group.security_group_id]
  subnet_id              = module.vpc.public_subnets[0]

  tags = local.tags
}

module "autoscaling" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/autoscaling?ref=main"

  name = var.name_prefix

  min_size         = 1
  max_size         = 1
  desired_capacity = 1

  vpc_zone_identifier = module.vpc.private_subnets

  image_id        = data.aws_ami.amazon_linux.id
  instance_type   = "t3.nano"
  security_groups = [module.security_group.security_group_id]

  tags = local.tags
}

################################################################################
# LAYER 4 - Special dependencies
################################################################################

module "lambda" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/lambda?ref=main"

  function_name = var.name_prefix
  description   = "Wolkvorm test lambda function"
  handler       = "index.handler"
  runtime       = "python3.12"

  create_package = true
  source_path    = "${path.module}/lambda_src"

  lambda_role = module.iam_role.arn

  tags = local.tags
}

module "eks" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/eks?ref=main"

  name               = var.name_prefix
  kubernetes_version = "1.31"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  endpoint_public_access  = true
  endpoint_private_access = true

  authentication_mode                      = "API_AND_CONFIG_MAP"
  enable_cluster_creator_admin_permissions = true

  eks_managed_node_groups = {
    default = {
      instance_types = ["t3.medium"]
      min_size       = 1
      max_size       = 1
      desired_size   = 1
    }
  }

  tags = local.tags
}

module "cloudfront" {
  source = "git::https://github.com/wolkvorm/wolkvorm.git//modules/aws/cloudfront?ref=main"

  comment             = "Wolkvorm test distribution"
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  http_version        = "http2"

  origin = {
    alb = {
      domain_name = module.alb.dns_name
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  default_cache_behavior = {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    use_forwarded_values   = false
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions = {
    geo_restriction = {
      restriction_type = "none"
    }
  }

  viewer_certificate = {
    cloudfront_default_certificate = true
  }

  tags = local.tags
}
