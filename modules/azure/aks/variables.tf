variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" {
  type = string
  default = "West Europe"
}
variable "kubernetes_version" {
  type = string
  default = null
}
variable "dns_prefix" { type = string }
variable "default_node_pool_name" {
  type = string
  default = "default"
}
variable "default_node_pool_vm_size" {
  type = string
  default = "Standard_D2s_v3"
}
variable "default_node_pool_min_count" {
  type = number
  default = 1
}
variable "default_node_pool_max_count" {
  type = number
  default = 3
}
variable "default_node_pool_node_count" {
  type = number
  default = 1
}
variable "default_node_pool_enable_auto_scaling" {
  type = bool
  default = true
}
variable "default_node_pool_os_disk_size_gb" {
  type = number
  default = 50
}
variable "default_node_pool_subnet_id" {
  type = string
  default = null
}
variable "network_plugin" {
  type = string
  default = "kubenet"
}
variable "network_policy" {
  type = string
  default = null
}
variable "service_cidr" {
  type = string
  default = "10.100.0.0/16"
}
variable "dns_service_ip" {
  type = string
  default = "10.100.0.10"
}
variable "sku_tier" {
  type = string
  default = "Free"
}
variable "private_cluster_enabled" {
  type = bool
  default = false
}
variable "tags" {
  type = map(string)
  default = {}
}
