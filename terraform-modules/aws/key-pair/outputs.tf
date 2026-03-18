output "key_pair_id" { value = aws_key_pair.this.id }
output "key_pair_arn" { value = aws_key_pair.this.arn }
output "key_name" { value = aws_key_pair.this.key_name }
output "private_key_pem" { value = try(tls_private_key.this[0].private_key_pem, null); sensitive = true }
