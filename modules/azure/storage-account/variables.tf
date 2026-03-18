variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" {
  type = string
  default = "West Europe"
}
variable "account_tier" {
  type = string
  default = "Standard"
}
variable "account_replication_type" {
  type = string
  default = "LRS"
}
variable "account_kind" {
  type = string
  default = "StorageV2"
}
variable "access_tier" {
  type = string
  default = "Hot"
}
variable "enable_https_traffic_only" {
  type = bool
  default = true
}
variable "min_tls_version" {
  type = string
  default = "TLS1_2"
}
variable "allow_nested_items_to_be_public" {
  type = bool
  default = false
}
variable "versioning_enabled" {
  type = bool
  default = false
}
variable "containers" {
  type = list(object({ name = string, access_type = optional(string, "private") }))
  default = []
}
variable "tags" {
  type = map(string)
  default = {}
}
