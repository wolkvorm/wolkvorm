locals {
  assume_role_policy = var.assume_role_policy != null ? var.assume_role_policy : jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = var.assume_role_policy_service } }]
  })
}
resource "aws_iam_role" "this" {
  name                  = var.name
  description           = var.description
  assume_role_policy    = local.assume_role_policy
  max_session_duration  = var.max_session_duration
  force_detach_policies = var.force_detach_policies
  tags                  = var.tags
}
resource "aws_iam_role_policy_attachment" "managed" {
  count      = length(var.managed_policy_arns)
  role       = aws_iam_role.this.name
  policy_arn = var.managed_policy_arns[count.index]
}
resource "aws_iam_role_policy" "inline" {
  count  = var.inline_policy_name != null && var.inline_policy_json != null ? 1 : 0
  name   = var.inline_policy_name
  role   = aws_iam_role.this.id
  policy = var.inline_policy_json
}
resource "aws_iam_instance_profile" "this" {
  name = var.name
  role = aws_iam_role.this.name
  tags = var.tags
}
