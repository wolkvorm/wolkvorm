variable "name" { type = string }
variable "min_size" {
  type = number
  default = 1
}
variable "max_size" {
  type = number
  default = 3
}
variable "desired_capacity" {
  type = number
  default = 1
}
variable "vpc_zone_identifier" { type = list(string) }
variable "launch_template_name" {
  type = string
  default = null
}
variable "image_id" {
  type = string
  default = null
}
variable "instance_type" {
  type = string
  default = "t3.micro"
}
variable "key_name" {
  type = string
  default = null
}
variable "security_groups" {
  type = list(string)
  default = []
}
variable "user_data" {
  type = string
  default = null
}
variable "health_check_type" {
  type = string
  default = "EC2"
}
variable "health_check_grace_period" {
  type = number
  default = 300
}
variable "default_cooldown" {
  type = number
  default = 300
}
variable "target_group_arns" {
  type = list(string)
  default = []
}
variable "protect_from_scale_in" {
  type = bool
  default = false
}
variable "tags" {
  type = map(string)
  default = {}
}
