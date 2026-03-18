resource "huaweicloud_obs_bucket" "this" {
  bucket        = var.bucket
  region        = var.region
  acl           = var.acl
  storage_class = var.storage_class
  versioning    = var.versioning
  encryption    = var.encryption
  force_destroy = var.force_destroy
  tags          = var.tags
}
