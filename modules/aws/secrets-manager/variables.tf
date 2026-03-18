variable "name" { type = string }
variable "description" {
  type = string
  default = ""
}
variable "secret_string" {
  type = string
  default = null
  sensitive = true
}
variable "secret_binary" {
  type = string
  default = null
  sensitive = true
}
variable "kms_key_id" {
  type = string
  default = null
}
variable "recovery_window_in_days" {
  type = number
  default = 30
}
variable "rotation_lambda_arn" {
  type = string
  default = null
}
variable "rotation_days" {
  type = number
  default = 30
}
variable "tags" { type = map(string); default = {} }
