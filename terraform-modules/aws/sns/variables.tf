variable "name" { type = string }
variable "fifo_topic" { type = bool; default = false }
variable "content_based_deduplication" { type = bool; default = false }
variable "display_name" { type = string; default = null }
variable "kms_master_key_id" { type = string; default = null }
variable "policy" { type = string; default = null }
variable "subscriptions" {
  type    = list(object({ protocol = string, endpoint = string }))
  default = []
}
variable "tags" { type = map(string); default = {} }
