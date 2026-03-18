variable "name" { type = string }
variable "description" {
  type = string
  default = "Managed by Wolkvorm"
}
variable "vpc_id" { type = string }
variable "ingress_rules" {
  type = list(object({ from_port = number, to_port = number, protocol = string, cidr_blocks = list(string), description = optional(string) }))
  default = []
}
variable "egress_rules" {
  type = list(object({ from_port = number, to_port = number, protocol = string, cidr_blocks = list(string), description = optional(string) }))
  default = [{ from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }]
}
variable "tags" {
  type = map(string)
  default = {}
}
