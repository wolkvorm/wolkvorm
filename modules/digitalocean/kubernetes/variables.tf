variable "name" { type = string }
variable "region" {
  type = string
  default = "ams3"
}
variable "version_slug" {
  type = string
  default = null
}
variable "auto_upgrade" {
  type = bool
  default = true
}
variable "node_pool_name" {
  type = string
  default = "main"
}
variable "node_size" {
  type = string
  default = "s-2vcpu-2gb"
}
variable "node_count" {
  type = number
  default = 2
}
variable "min_nodes" {
  type = number
  default = 1
}
variable "max_nodes" {
  type = number
  default = 5
}
variable "auto_scale" {
  type = bool
  default = true
}
variable "tags" {
  type = list(string)
  default = []
}
