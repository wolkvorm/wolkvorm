variable "region" {
  description = "AWS region to deploy test resources"
  type        = string
  default     = "eu-central-1"
}

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
  default     = "wolkvorm-test"
}
