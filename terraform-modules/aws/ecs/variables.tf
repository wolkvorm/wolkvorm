variable "cluster_name" { type = string }
variable "container_insights" { type = bool; default = false }
variable "service_name" { type = string; default = null }
variable "task_cpu" { type = number; default = 256 }
variable "task_memory" { type = number; default = 512 }
variable "container_definitions" { type = string; default = "[]" }
variable "desired_count" { type = number; default = 1 }
variable "launch_type" { type = string; default = "FARGATE" }
variable "network_mode" { type = string; default = "awsvpc" }
variable "assign_public_ip" { type = bool; default = false }
variable "subnet_ids" { type = list(string); default = [] }
variable "security_group_ids" { type = list(string); default = [] }
variable "tags" { type = map(string); default = {} }
