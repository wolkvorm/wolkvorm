variable "name" { type = string }
variable "project" { type = string }
variable "location" { type = string }
variable "network" { type = string }
variable "subnetwork" { type = string }
variable "kubernetes_version" { type = string; default = null }
variable "remove_default_node_pool" { type = bool; default = true }
variable "initial_node_count" { type = number; default = 1 }
variable "node_pool_name" { type = string; default = "main" }
variable "node_count" { type = number; default = 1 }
variable "min_node_count" { type = number; default = 1 }
variable "max_node_count" { type = number; default = 3 }
variable "enable_autoscaling" { type = bool; default = true }
variable "machine_type" { type = string; default = "e2-standard-2" }
variable "disk_size_gb" { type = number; default = 50 }
variable "disk_type" { type = string; default = "pd-standard" }
variable "preemptible" { type = bool; default = false }
variable "enable_private_nodes" { type = bool; default = false }
variable "master_ipv4_cidr_block" { type = string; default = "172.16.0.0/28" }
variable "labels" { type = map(string); default = {} }
