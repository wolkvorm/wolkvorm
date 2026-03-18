resource "google_storage_bucket" "this" {
  name                        = var.name
  project                     = var.project
  location                    = var.location
  storage_class               = var.storage_class
  force_destroy               = var.force_destroy
  uniform_bucket_level_access = var.uniform_bucket_level_access
  public_access_prevention    = var.public_access_prevention
  labels                      = var.labels

  dynamic "versioning" {
    for_each = var.versioning_enabled ? [1] : []
    content { enabled = true }
  }
}
