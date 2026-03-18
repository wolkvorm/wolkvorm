resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = var.validation_method
  tags                      = var.tags
  lifecycle { create_before_destroy = true }
}
resource "aws_acm_certificate_validation" "this" {
  count           = var.wait_for_validation ? 1 : 0
  certificate_arn = aws_acm_certificate.this.arn
}
