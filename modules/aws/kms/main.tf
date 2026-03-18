resource "aws_kms_key" "this" {
  description              = var.description
  key_usage                = var.key_usage
  customer_master_key_spec = var.customer_master_key_spec
  enable_key_rotation      = var.enable_key_rotation
  deletion_window_in_days  = var.deletion_window_in_days
  multi_region             = var.multi_region
  policy                   = var.policy
  tags                     = var.tags
}
resource "aws_kms_alias" "this" {
  count         = var.alias_name != null ? 1 : 0
  name          = "alias/${var.alias_name}"
  target_key_id = aws_kms_key.this.key_id
}
