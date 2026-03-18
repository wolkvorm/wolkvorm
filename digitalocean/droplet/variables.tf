variable "name" { type = string }
variable "region" { type = string; default = "ams3" }
variable "size" { type = string; default = "s-1vcpu-1gb" }
variable "image" { type = string; default = "ubuntu-22-04-x64" }
variable "ssh_keys" { type = list(string); default = [] }
variable "backups" { type = bool; default = false }
variable "monitoring" { type = bool; default = true }
variable "ipv6" { type = bool; default = false }
variable "private_networking" { type = bool; default = false }
variable "vpc_uuid" { type = string; default = null }
variable "user_data" { type = string; default = null }
variable "resize_disk" { type = bool; default = true }
variable "tags" { type = list(string); default = [] }
