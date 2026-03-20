# VPC
output "vpc_id" {
  value = module.vpc.vpc_id
}
output "vpc_public_subnets" {
  value = module.vpc.public_subnets
}
output "vpc_private_subnets" {
  value = module.vpc.private_subnets
}

# Security Group
output "security_group_id" {
  value = module.security_group.security_group_id
}

# S3
output "s3_bucket_name" {
  value = module.s3.s3_bucket_id
}
output "s3_bucket_arn" {
  value = module.s3.s3_bucket_arn
}

# KMS
output "kms_key_arn" {
  value = module.kms.key_arn
}

# DynamoDB
output "dynamodb_table_name" {
  value = module.dynamodb.dynamodb_table_id
}

# ECR
output "ecr_repository_url" {
  value = module.ecr.repository_url
}

# SQS
output "sqs_queue_url" {
  value = module.sqs.queue_url
}

# SNS
output "sns_topic_arn" {
  value = module.sns.topic_arn
}

# Secrets Manager
output "secret_arn" {
  value = module.secrets_manager.secret_arn
}

# IAM Role
output "iam_role_arn" {
  value = module.iam_role.arn
}

# IAM Policy
output "iam_policy_arn" {
  value = module.iam_policy.arn
}

# Key Pair
output "key_pair_name" {
  value = module.key_pair.key_pair_name
}

# Route53
output "route53_zone_id" {
  value = module.route53.id
}

# ECS
output "ecs_cluster_arn" {
  value = module.ecs.cluster_arn
}

# API Gateway
output "apigateway_api_endpoint" {
  value = module.apigateway.api_endpoint
}

# ALB
output "alb_dns_name" {
  value = module.alb.dns_name
}
output "alb_arn" {
  value = module.alb.arn
}

# RDS
output "rds_endpoint" {
  value = module.rds.db_instance_endpoint
}
output "rds_arn" {
  value = module.rds.db_instance_arn
}

# ElastiCache
output "elasticache_cluster_id" {
  value = module.elasticache.cluster_arn
}

# EC2
output "ec2_instance_id" {
  value = module.ec2.id
}
output "ec2_public_ip" {
  value = module.ec2.public_ip
}

# Autoscaling
output "autoscaling_group_name" {
  value = module.autoscaling.autoscaling_group_name
}

# Lambda
output "lambda_function_arn" {
  value = module.lambda.lambda_function_arn
}
output "lambda_function_name" {
  value = module.lambda.lambda_function_name
}

# EKS
output "eks_cluster_name" {
  value = module.eks.cluster_name
}
output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

# CloudFront
output "cloudfront_domain_name" {
  value = module.cloudfront.cloudfront_distribution_domain_name
}
output "cloudfront_distribution_id" {
  value = module.cloudfront.cloudfront_distribution_id
}
