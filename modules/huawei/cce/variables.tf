variable "name" { type = string }
variable "region" {
  type = string
  default = "ap-southeast-1"
}
variable "flavor_id" {
  type = string
  default = "cce.s1.small"
}
variable "cluster_type" {
  type = string
  default = "VirtualMachine"
}
variable "cluster_version" {
  type = string
  default = "v1.31"
}
variable "vpc_id" { type = string }
variable "subnet_id" { type = string }
variable "container_network_type" {
  type = string
  default = "overlay_l2"
}
variable "container_network_cidr" {
  type = string
  default = "172.16.0.0/16"
}
variable "node_pool_name" {
  type = string
  default = "main"
}
variable "node_flavor" {
  type = string
  default = "s6.large.2"
}
variable "node_availability_zone" { type = string }
variable "node_os" {
  type = string
  default = "HuaweiCloud EulerOS 2.9"
}
variable "node_key_pair" {
  type = string
  default = null
}
variable "root_volume_type" {
  type = string
  default = "GPSSD"
}
variable "root_volume_size" {
  type = number
  default = 50
}
variable "data_volume_type" {
  type = string
  default = "GPSSD"
}
variable "data_volume_size" {
  type = number
  default = 100
}
variable "node_min_count" {
  type = number
  default = 1
}
variable "node_max_count" {
  type = number
  default = 3
}
variable "initial_node_count" {
  type = number
  default = 1
}
variable "tags" { type = map(string); default = {} }
