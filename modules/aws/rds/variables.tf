variable "identifier" { type = string }
variable "engine" {
  type = string
  default = "mysql"
}
variable "engine_version" {
  type = string
  default = "8.0"
}
variable "instance_class" {
  type = string
  default = "db.t3.micro"
}
variable "allocated_storage" {
  type = number
  default = 20
}
variable "max_allocated_storage" {
  type = number
  default = 100
}
variable "storage_type" {
  type = string
  default = "gp3"
}
variable "storage_encrypted" {
  type = bool
  default = true
}
variable "db_name" {
  type = string
  default = null
}
variable "username" { type = string }
variable "password" {
  type = string
  sensitive = true
}
variable "port" {
  type = number
  default = null
}
variable "multi_az" {
  type = bool
  default = false
}
variable "publicly_accessible" {
  type = bool
  default = false
}
variable "db_subnet_group_name" {
  type = string
  default = null
}
variable "vpc_security_group_ids" {
  type = list(string)
  default = []
}
variable "backup_retention_period" {
  type = number
  default = 7
}
variable "backup_window" {
  type = string
  default = "03:00-06:00"
}
variable "maintenance_window" {
  type = string
  default = "Mon:00:00-Mon:03:00"
}
variable "auto_minor_version_upgrade" {
  type = bool
  default = true
}
variable "deletion_protection" {
  type = bool
  default = false
}
variable "skip_final_snapshot" {
  type = bool
  default = true
}
variable "apply_immediately" {
  type = bool
  default = false
}
variable "performance_insights_enabled" {
  type = bool
  default = false
}
variable "monitoring_interval" {
  type = number
  default = 0
}
variable "tags" {
  type = map(string)
  default = {}
}
