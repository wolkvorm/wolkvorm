variable "name" { type = string }
variable "billing_mode" {
  type = string
  default = "PAY_PER_REQUEST"
}
variable "read_capacity" {
  type = number
  default = null
}
variable "write_capacity" {
  type = number
  default = null
}
variable "hash_key" {
  type = string
  default = "id"
}
variable "hash_key_type" {
  type = string
  default = "S"
}
variable "range_key" {
  type = string
  default = null
}
variable "range_key_type" {
  type = string
  default = "S"
}
variable "stream_enabled" {
  type = bool
  default = false
}
variable "stream_view_type" {
  type = string
  default = null
}
variable "point_in_time_recovery_enabled" {
  type = bool
  default = true
}
variable "deletion_protection_enabled" {
  type = bool
  default = false
}
variable "server_side_encryption_enabled" {
  type = bool
  default = true
}
variable "ttl_attribute_name" {
  type = string
  default = null
}
variable "tags" {
  type = map(string)
  default = {}
}
