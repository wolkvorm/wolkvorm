variable "name" { type = string }
variable "project" { type = string }
variable "auto_create_subnetworks" {
  type = bool
  default = false
}
variable "routing_mode" {
  type = string
  default = "REGIONAL"
}
variable "subnets" {
  type = list(object({ name = string, ip_cidr_range = string, region = string, private_ip_google_access = optional(bool, true) }))
  default = []
}
