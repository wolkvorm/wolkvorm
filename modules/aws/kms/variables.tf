variable "description" {
  type = string
  default = "KMS key managed by Wolkvorm"
}
variable "key_usage" {
  type = string
  default = "ENCRYPT_DECRYPT"
}
variable "customer_master_key_spec" {
  type = string
  default = "SYMMETRIC_DEFAULT"
}
variable "enable_key_rotation" {
  type = bool
  default = true
}
variable "deletion_window_in_days" {
  type = number
  default = 30
}
variable "multi_region" {
  type = bool
  default = false
}
variable "policy" {
  type = string
  default = null
}
variable "alias_name" {
  type = string
  default = null
}
variable "tags" {
  type = map(string)
  default = {}
}
