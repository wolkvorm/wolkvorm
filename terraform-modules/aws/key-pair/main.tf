resource "tls_private_key" "this" {
  count     = var.create_private_key ? 1 : 0
  algorithm = var.private_key_algorithm
  rsa_bits  = var.private_key_rsa_bits
}
resource "aws_key_pair" "this" {
  key_name   = var.key_name
  public_key = var.create_private_key ? tls_private_key.this[0].public_key_openssh : var.public_key
  tags       = var.tags
}
