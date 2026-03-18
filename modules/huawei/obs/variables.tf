variable "bucket" { type = string }
variable "region" {
  type = string
  default = "ap-southeast-1"
}
variable "acl" {
  type = string
  default = "private"
}
variable "storage_class" {
  type = string
  default = "STANDARD"
}
variable "versioning" {
  type = bool
  default = false
}
variable "encryption" {
  type = bool
  default = false
}
variable "force_destroy" {
  type = bool
  default = false
}
variable "tags" { type = map(string); default = {} }
