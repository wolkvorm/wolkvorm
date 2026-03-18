output "id" { value = aws_sqs_queue.this.id }
output "arn" { value = aws_sqs_queue.this.arn }
output "url" { value = aws_sqs_queue.this.url }
output "dlq_arn" { value = try(aws_sqs_queue.dlq[0].arn, null) }
