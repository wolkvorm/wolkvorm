variable "domain_name" { type = string }
variable "subject_alternative_names" { type = list(string); default = [] }
variable "validation_method" { type = string; default = "DNS" }
variable "wait_for_validation" { type = bool; default = true }
variable "tags" { type = map(string); default = {} }
