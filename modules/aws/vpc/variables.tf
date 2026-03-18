variable "name" {
  description = "Name tag for VPC and related resources"
  type        = string
}
variable "cidr" {
  description = "IPv4 CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}
variable "azs" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}
variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
  default     = []
}
variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
  default     = []
}
variable "database_subnets" {
  description = "List of database subnet CIDR blocks"
  type        = list(string)
  default     = []
}
variable "elasticache_subnets" {
  description = "List of ElastiCache subnet CIDR blocks"
  type        = list(string)
  default     = []
}
variable "intra_subnets" {
  description = "List of intra subnet CIDR blocks (no internet)"
  type        = list(string)
  default     = []
}
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}
variable "single_nat_gateway" {
  description = "Use a single NAT Gateway for all AZs"
  type        = bool
  default     = true
}
variable "one_nat_gateway_per_az" {
  description = "Deploy one NAT Gateway per AZ"
  type        = bool
  default     = false
}
variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}
variable "enable_dns_support" {
  description = "Enable DNS support in the VPC"
  type        = bool
  default     = true
}
variable "enable_ipv6" {
  description = "Request an Amazon-provided IPv6 CIDR block"
  type        = bool
  default     = false
}
variable "enable_vpn_gateway" {
  description = "Create a VPN Gateway"
  type        = bool
  default     = false
}
variable "map_public_ip_on_launch" {
  description = "Auto-assign public IP in public subnets"
  type        = bool
  default     = false
}
variable "enable_flow_log" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = false
}
variable "instance_tenancy" {
  description = "Tenancy option for instances"
  type        = string
  default     = "default"
}
variable "create_database_subnet_group" {
  description = "Create a database subnet group"
  type        = bool
  default     = true
}
variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}
