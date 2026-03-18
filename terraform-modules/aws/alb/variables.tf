variable "name" { type = string }
variable "internal" { type = bool; default = false }
variable "load_balancer_type" { type = string; default = "application" }
variable "subnets" { type = list(string) }
variable "security_groups" { type = list(string); default = [] }
variable "enable_deletion_protection" { type = bool; default = false }
variable "enable_http2" { type = bool; default = true }
variable "idle_timeout" { type = number; default = 60 }
variable "target_group_port" { type = number; default = 80 }
variable "target_group_protocol" { type = string; default = "HTTP" }
variable "target_type" { type = string; default = "ip" }
variable "vpc_id" { type = string }
variable "health_check_path" { type = string; default = "/" }
variable "health_check_interval" { type = number; default = 30 }
variable "listener_port" { type = number; default = 80 }
variable "listener_protocol" { type = string; default = "HTTP" }
variable "tags" { type = map(string); default = {} }
