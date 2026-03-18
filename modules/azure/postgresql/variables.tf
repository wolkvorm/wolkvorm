variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" {
  type = string
  default = "West Europe"
}
variable "sku_name" {
  type = string
  default = "B_Standard_B2ms"
}
variable "postgres_version" {
  type = string
  default = "16"
}
variable "storage_mb" {
  type = number
  default = 32768
}
variable "storage_tier" {
  type = string
  default = "P4"
}
variable "backup_retention_days" {
  type = number
  default = 7
}
variable "geo_redundant_backup_enabled" {
  type = bool
  default = false
}
variable "administrator_login" {
  type = string
  default = "psqladmin"
}
variable "administrator_password" {
  type = string
  sensitive = true
}
variable "zone" {
  type = string
  default = "1"
}
variable "delegated_subnet_id" {
  type = string
  default = null
}
variable "private_dns_zone_id" {
  type = string
  default = null
}
variable "tags" { type = map(string); default = {} }
