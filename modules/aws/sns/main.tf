resource "aws_sns_topic" "this" {
  name                        = "${var.name}${var.fifo_topic ? ".fifo" : ""}"
  fifo_topic                  = var.fifo_topic
  content_based_deduplication = var.fifo_topic ? var.content_based_deduplication : null
  display_name                = var.display_name
  kms_master_key_id           = var.kms_master_key_id
  policy                      = var.policy
  tags                        = var.tags
}
resource "aws_sns_topic_subscription" "this" {
  count     = length(var.subscriptions)
  topic_arn = aws_sns_topic.this.arn
  protocol  = var.subscriptions[count.index].protocol
  endpoint  = var.subscriptions[count.index].endpoint
}
