variable "cluster_name" { type = string }
variable "cluster_version" {
  type = string
  default = "1.31"
}
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "cluster_endpoint_public_access" {
  type = bool
  default = true
}
variable "cluster_endpoint_private_access" {
  type = bool
  default = true
}
variable "cluster_endpoint_public_access_cidrs" {
  type = list(string)
  default = ["0.0.0.0/0"]
}
variable "node_group_name" {
  type = string
  default = "main"
}
variable "node_instance_types" {
  type = list(string)
  default = ["t3.medium"]
}
variable "node_min_size" {
  type = number
  default = 1
}
variable "node_max_size" {
  type = number
  default = 3
}
variable "node_desired_size" {
  type = number
  default = 2
}
variable "node_disk_size" {
  type = number
  default = 20
}
variable "node_capacity_type" {
  type = string
  default = "ON_DEMAND"
}
variable "enable_cluster_creator_admin_permissions" {
  type = bool
  default = true
}
variable "tags" {
  type = map(string)
  default = {}
}
