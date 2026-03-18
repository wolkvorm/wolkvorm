variable "name" { type = string }
variable "project" { type = string }
variable "location" { type = string; default = "EU" }
variable "storage_class" { type = string; default = "STANDARD" }
variable "versioning_enabled" { type = bool; default = false }
variable "force_destroy" { type = bool; default = false }
variable "uniform_bucket_level_access" { type = bool; default = true }
variable "public_access_prevention" { type = string; default = "enforced" }
variable "labels" { type = map(string); default = {} }
