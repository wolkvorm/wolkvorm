output "arn" { value = aws_lambda_function.this.arn }
output "invoke_arn" { value = aws_lambda_function.this.invoke_arn }
output "function_name" { value = aws_lambda_function.this.function_name }
output "role_arn" { value = local.role_arn }
