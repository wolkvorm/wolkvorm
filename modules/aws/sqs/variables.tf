variable "name" { type = string }
variable "fifo_queue" { type = bool; default = false }
variable "content_based_deduplication" { type = bool; default = false }
variable "delay_seconds" { type = number; default = 0 }
variable "max_message_size" { type = number; default = 262144 }
variable "message_retention_seconds" { type = number; default = 345600 }
variable "receive_wait_time_seconds" { type = number; default = 0 }
variable "visibility_timeout_seconds" { type = number; default = 30 }
variable "sqs_managed_sse_enabled" { type = bool; default = true }
variable "kms_master_key_id" { type = string; default = null }
variable "create_dlq" { type = bool; default = false }
variable "dlq_max_receive_count" { type = number; default = 5 }
variable "tags" { type = map(string); default = {} }
