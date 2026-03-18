output "arn" { value = aws_acm_certificate.this.arn }
output "domain_name" { value = aws_acm_certificate.this.domain_name }
output "status" { value = aws_acm_certificate.this.status }
