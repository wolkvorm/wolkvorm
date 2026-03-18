variable "name" { type = string }
variable "project" { type = string }
variable "region" {
  type = string
  default = "europe-west1"
}
variable "database_version" {
  type = string
  default = "POSTGRES_15"
}
variable "tier" {
  type = string
  default = "db-g1-small"
}
variable "disk_size" {
  type = number
  default = 20
}
variable "disk_type" {
  type = string
  default = "PD_SSD"
}
variable "disk_autoresize" {
  type = bool
  default = true
}
variable "disk_autoresize_limit" {
  type = number
  default = 0
}
variable "availability_type" {
  type = string
  default = "ZONAL"
}
variable "backup_enabled" {
  type = bool
  default = true
}
variable "backup_start_time" {
  type = string
  default = "03:00"
}
variable "deletion_protection" {
  type = bool
  default = false
}
variable "db_name" {
  type = string
  default = null
}
variable "db_user" {
  type = string
  default = null
}
variable "db_password" {
  type = string
  default = null
  sensitive = true
}
variable "labels" {
  type = map(string)
  default = {}
}
