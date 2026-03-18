variable "function_name" { type = string }
variable "description" {
  type = string
  default = ""
}
variable "handler" {
  type = string
  default = "index.handler"
}
variable "runtime" {
  type = string
  default = "nodejs20.x"
}
variable "filename" {
  type = string
  default = null
}
variable "s3_bucket" {
  type = string
  default = null
}
variable "s3_key" {
  type = string
  default = null
}
variable "source_code_hash" {
  type = string
  default = null
}
variable "role_arn" {
  type = string
  default = null
}
variable "create_role" {
  type = bool
  default = true
}
variable "memory_size" {
  type = number
  default = 128
}
variable "timeout" {
  type = number
  default = 3
}
variable "reserved_concurrent_executions" {
  type = number
  default = -1
}
variable "environment_variables" { type = map(string); default = {} }
variable "vpc_subnet_ids" {
  type = list(string)
  default = []
}
variable "vpc_security_group_ids" {
  type = list(string)
  default = []
}
variable "tracing_mode" {
  type = string
  default = "PassThrough"
}
variable "architectures" {
  type = list(string)
  default = ["x86_64"]
}
variable "tags" { type = map(string); default = {} }
