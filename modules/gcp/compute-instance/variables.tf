variable "name" { type = string }
variable "project" { type = string }
variable "zone" { type = string }
variable "machine_type" {
  type = string
  default = "e2-medium"
}
variable "boot_disk_image" {
  type = string
  default = "debian-cloud/debian-12"
}
variable "boot_disk_size" {
  type = number
  default = 20
}
variable "boot_disk_type" {
  type = string
  default = "pd-balanced"
}
variable "network" {
  type = string
  default = "default"
}
variable "subnetwork" {
  type = string
  default = null
}
variable "external_ip" {
  type = bool
  default = true
}
variable "tags" {
  type = list(string)
  default = []
}
variable "metadata" { type = map(string); default = {} }
variable "metadata_startup_script" {
  type = string
  default = null
}
variable "service_account_email" {
  type = string
  default = null
}
variable "service_account_scopes" {
  type = list(string)
  default = ["cloud-platform"]
}
variable "labels" { type = map(string); default = {} }
