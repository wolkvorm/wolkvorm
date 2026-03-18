variable "cluster_id" { type = string }
variable "engine" {
  type = string
  default = "redis"
}
variable "engine_version" {
  type = string
  default = "7.0"
}
variable "node_type" {
  type = string
  default = "cache.t3.micro"
}
variable "num_cache_nodes" {
  type = number
  default = 1
}
variable "parameter_group_name" {
  type = string
  default = null
}
variable "port" {
  type = number
  default = 6379
}
variable "subnet_group_name" {
  type = string
  default = null
}
variable "security_group_ids" {
  type = list(string)
  default = []
}
variable "automatic_failover_enabled" {
  type = bool
  default = false
}
variable "multi_az_enabled" {
  type = bool
  default = false
}
variable "num_node_groups" {
  type = number
  default = 1
}
variable "replicas_per_node_group" {
  type = number
  default = 0
}
variable "at_rest_encryption_enabled" {
  type = bool
  default = true
}
variable "transit_encryption_enabled" {
  type = bool
  default = false
}
variable "apply_immediately" {
  type = bool
  default = false
}
variable "snapshot_retention_limit" {
  type = number
  default = 1
}
variable "tags" {
  type = map(string)
  default = {}
}
