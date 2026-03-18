output "key_id" { value = aws_kms_key.this.key_id }
output "key_arn" { value = aws_kms_key.this.arn }
output "alias_arn" { value = try(aws_kms_alias.this[0].arn, null) }
