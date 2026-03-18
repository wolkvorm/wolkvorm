variable "name" { type = string }
variable "image_tag_mutability" {
  type = string
  default = "MUTABLE"
}
variable "scan_on_push" {
  type = bool
  default = true
}
variable "encryption_type" {
  type = string
  default = "AES256"
}
variable "kms_key" {
  type = string
  default = null
}
variable "lifecycle_policy" {
  type = string
  default = null
}
variable "repository_policy" {
  type = string
  default = null
}
variable "force_delete" {
  type = bool
  default = false
}
variable "tags" { type = map(string); default = {} }
