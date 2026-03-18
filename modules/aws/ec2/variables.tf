variable "name" { type = string }
variable "instance_type" { type = string; default = "t3.micro" }
variable "ami" { type = string; default = "" }
variable "ami_ssm_parameter" { type = string; default = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" }
variable "subnet_id" { type = string }
variable "key_name" { type = string; default = null }
variable "vpc_security_group_ids" { type = list(string); default = [] }
variable "associate_public_ip_address" { type = bool; default = false }
variable "iam_instance_profile" { type = string; default = null }
variable "monitoring" { type = bool; default = false }
variable "user_data" { type = string; default = null }
variable "root_block_device_size" { type = number; default = 20 }
variable "root_block_device_type" { type = string; default = "gp3" }
variable "root_block_device_encrypted" { type = bool; default = true }
variable "ebs_optimized" { type = bool; default = true }
variable "disable_api_termination" { type = bool; default = false }
variable "disable_api_stop" { type = bool; default = false }
variable "availability_zone" { type = string; default = null }
variable "private_ip" { type = string; default = null }
variable "tenancy" { type = string; default = "default" }
variable "create_eip" { type = bool; default = false }
variable "source_dest_check" { type = bool; default = true }
variable "hibernation" { type = bool; default = false }
variable "tags" { type = map(string); default = {} }
