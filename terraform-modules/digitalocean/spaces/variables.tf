variable "name" { type = string }
variable "region" { type = string; default = "ams3" }
variable "acl" { type = string; default = "private" }
variable "versioning_enabled" { type = bool; default = false }
variable "force_destroy" { type = bool; default = false }
variable "cors_rules" {
  type = list(object({ allowed_headers = optional(list(string), ["*"]), allowed_methods = list(string), allowed_origins = list(string), max_age_seconds = optional(number, 3000) }))
  default = []
}
