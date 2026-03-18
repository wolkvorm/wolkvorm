variable "name" { type = string }
variable "resource_group_name" { type = string }
variable "location" {
  type = string
  default = "West Europe"
}
variable "size" {
  type = string
  default = "Standard_B2s"
}
variable "admin_username" {
  type = string
  default = "adminuser"
}
variable "admin_password" {
  type = string
  default = null
  sensitive = true
}
variable "admin_ssh_public_key" {
  type = string
  default = null
}
variable "subnet_id" { type = string }
variable "os_disk_caching" {
  type = string
  default = "ReadWrite"
}
variable "os_disk_storage_account_type" {
  type = string
  default = "Premium_LRS"
}
variable "os_disk_size_gb" {
  type = number
  default = 30
}
variable "source_image_publisher" {
  type = string
  default = "Canonical"
}
variable "source_image_offer" {
  type = string
  default = "0001-com-ubuntu-server-jammy"
}
variable "source_image_sku" {
  type = string
  default = "22_04-lts"
}
variable "source_image_version" {
  type = string
  default = "latest"
}
variable "public_ip_enabled" {
  type = bool
  default = false
}
variable "tags" {
  type = map(string)
  default = {}
}
