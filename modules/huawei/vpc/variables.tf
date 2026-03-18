variable "name" { type = string }
variable "region" {
  type = string
  default = "ap-southeast-1"
}
variable "cidr" {
  type = string
  default = "10.0.0.0/16"
}
variable "description" {
  type = string
  default = ""
}
variable "subnets" {
  type = list(object({ name = string, cidr = string, gateway_ip = string }))
  default = []
}
variable "tags" {
  type = map(string)
  default = {}
}
