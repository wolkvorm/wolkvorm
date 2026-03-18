variable "name" { type = string }
variable "region" { type = string; default = "ap-southeast-1" }
variable "flavor_id" { type = string; default = "s6.large.2" }
variable "image_id" { type = string }
variable "availability_zone" { type = string }
variable "vpc_id" { type = string }
variable "network_id" { type = string }
variable "security_group_ids" { type = list(string); default = [] }
variable "key_pair" { type = string; default = null }
variable "system_disk_type" { type = string; default = "GPSSD" }
variable "system_disk_size" { type = number; default = 40 }
variable "user_data" { type = string; default = null }
variable "tags" { type = map(string); default = {} }
