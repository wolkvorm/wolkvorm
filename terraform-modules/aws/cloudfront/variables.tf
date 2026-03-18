variable "comment" { type = string; default = "" }
variable "origin_domain_name" { type = string }
variable "origin_id" { type = string; default = "primary" }
variable "origin_path" { type = string; default = null }
variable "s3_origin_config_oai" { type = string; default = null }
variable "enabled" { type = bool; default = true }
variable "is_ipv6_enabled" { type = bool; default = true }
variable "price_class" { type = string; default = "PriceClass_100" }
variable "default_root_object" { type = string; default = "index.html" }
variable "viewer_protocol_policy" { type = string; default = "redirect-to-https" }
variable "allowed_methods" { type = list(string); default = ["GET", "HEAD"] }
variable "cached_methods" { type = list(string); default = ["GET", "HEAD"] }
variable "aliases" { type = list(string); default = [] }
variable "acm_certificate_arn" { type = string; default = null }
variable "minimum_protocol_version" { type = string; default = "TLSv1.2_2021" }
variable "geo_restriction_type" { type = string; default = "none" }
variable "tags" { type = map(string); default = {} }
