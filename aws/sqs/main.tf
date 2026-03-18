resource "aws_sqs_queue" "dlq" {
  count = var.create_dlq ? 1 : 0
  name  = "${var.name}-dlq${var.fifo_queue ? ".fifo" : ""}"
  fifo_queue = var.fifo_queue
  tags  = var.tags
}
resource "aws_sqs_queue" "this" {
  name                        = "${var.name}${var.fifo_queue ? ".fifo" : ""}"
  fifo_queue                  = var.fifo_queue
  content_based_deduplication = var.fifo_queue ? var.content_based_deduplication : null
  delay_seconds               = var.delay_seconds
  max_message_size            = var.max_message_size
  message_retention_seconds   = var.message_retention_seconds
  receive_wait_time_seconds   = var.receive_wait_time_seconds
  visibility_timeout_seconds  = var.visibility_timeout_seconds
  sqs_managed_sse_enabled     = var.sqs_managed_sse_enabled
  kms_master_key_id           = var.kms_master_key_id
  dynamic "redrive_policy" {
    for_each = var.create_dlq ? [1] : []
    content {
      deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
      maxReceiveCount     = var.dlq_max_receive_count
    }
  }
  tags = var.tags
}
