variable "name" { type = string }
variable "description" {
  type = string
  default = ""
}
variable "protocol_type" {
  type = string
  default = "HTTP"
}
variable "cors_allow_origins" {
  type = list(string)
  default = ["*"]
}
variable "cors_allow_methods" {
  type = list(string)
  default = ["*"]
}
variable "cors_allow_headers" {
  type = list(string)
  default = ["content-type", "authorization"]
}
variable "auto_deploy" {
  type = bool
  default = true
}
variable "stage_name" {
  type = string
  default = "$default"
}
variable "tags" {
  type = map(string)
  default = {}
}
