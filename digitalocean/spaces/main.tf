resource "digitalocean_spaces_bucket" "this" {
  name          = var.name
  region        = var.region
  acl           = var.acl
  force_destroy = var.force_destroy

  dynamic "versioning" {
    for_each = var.versioning_enabled ? [1] : []
    content { enabled = true }
  }

  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      max_age_seconds = cors_rule.value.max_age_seconds
    }
  }
}
