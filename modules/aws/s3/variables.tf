variable "bucket" {
  type = string
  default = null
}
variable "bucket_prefix" {
  type = string
  default = null
}
variable "force_destroy" {
  type = bool
  default = false
}
variable "versioning_enabled" {
  type = bool
  default = false
}
variable "server_side_encryption_configuration" {
  type = bool
  default = true
}
variable "acl" {
  type = string
  default = "private"
}
variable "block_public_acls" {
  type = bool
  default = true
}
variable "block_public_policy" {
  type = bool
  default = true
}
variable "ignore_public_acls" {
  type = bool
  default = true
}
variable "restrict_public_buckets" {
  type = bool
  default = true
}
variable "object_ownership" {
  type = string
  default = "BucketOwnerPreferred"
}
variable "lifecycle_rule_enabled" {
  type = bool
  default = false
}
variable "tags" {
  type = map(string)
  default = {}
}
