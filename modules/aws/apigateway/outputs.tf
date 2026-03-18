output "id" { value = aws_apigatewayv2_api.this.id }
output "arn" { value = aws_apigatewayv2_api.this.arn }
output "api_endpoint" { value = aws_apigatewayv2_api.this.api_endpoint }
output "execution_arn" { value = aws_apigatewayv2_api.this.execution_arn }
output "stage_id" { value = aws_apigatewayv2_stage.this.id }
output "invoke_url" { value = aws_apigatewayv2_stage.this.invoke_url }
