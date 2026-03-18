variable "name" { type = string }
variable "description" {
  type = string
  default = ""
}
variable "assume_role_policy_service" {
  type = string
  default = "ec2.amazonaws.com"
}
variable "assume_role_policy" {
  type = string
  default = null
}
variable "managed_policy_arns" {
  type = list(string)
  default = []
}
variable "inline_policy_name" {
  type = string
  default = null
}
variable "inline_policy_json" {
  type = string
  default = null
}
variable "max_session_duration" {
  type = number
  default = 3600
}
variable "force_detach_policies" {
  type = bool
  default = false
}
variable "tags" {
  type = map(string)
  default = {}
}
