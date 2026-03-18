resource "aws_iam_role" "lambda" {
  count = var.create_role ? 1 : 0
  name  = "${var.function_name}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
  tags = var.tags
}
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count      = var.create_role ? 1 : 0
  role       = aws_iam_role.lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = var.create_role && length(var.vpc_subnet_ids) > 0 ? 1 : 0
  role       = aws_iam_role.lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
locals {
  role_arn = var.create_role ? aws_iam_role.lambda[0].arn : var.role_arn
}
resource "aws_lambda_function" "this" {
  function_name                  = var.function_name
  description                    = var.description
  handler                        = var.handler
  runtime                        = var.runtime
  filename                       = var.filename
  s3_bucket                      = var.s3_bucket
  s3_key                         = var.s3_key
  source_code_hash               = var.source_code_hash
  role                           = local.role_arn
  memory_size                    = var.memory_size
  timeout                        = var.timeout
  reserved_concurrent_executions = var.reserved_concurrent_executions
  architectures                  = var.architectures
  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content { variables = var.environment_variables }
  }
  dynamic "vpc_config" {
    for_each = length(var.vpc_subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.vpc_subnet_ids
      security_group_ids = var.vpc_security_group_ids
    }
  }
  tracing_config { mode = var.tracing_mode }
  tags = var.tags
}
