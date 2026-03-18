variable "key_name" { type = string }
variable "public_key" { type = string; default = null }
variable "create_private_key" { type = bool; default = false }
variable "private_key_algorithm" { type = string; default = "RSA" }
variable "private_key_rsa_bits" { type = number; default = 4096 }
variable "tags" { type = map(string); default = {} }
