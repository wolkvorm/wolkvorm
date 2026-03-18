variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" {
  type = string
  default = "West Europe"
}
variable "address_space" {
  type = list(string)
  default = ["10.0.0.0/16"]
}
variable "dns_servers" {
  type = list(string)
  default = []
}
variable "subnets" {
  type = list(object({ name = string, address_prefixes = list(string) }))
  default = []
}
variable "tags" {
  type = map(string)
  default = {}
}
