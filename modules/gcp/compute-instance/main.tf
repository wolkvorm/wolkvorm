resource "google_compute_instance" "this" {
  name         = var.name
  project      = var.project
  zone         = var.zone
  machine_type = var.machine_type
  tags         = var.tags
  labels       = var.labels
  metadata     = var.metadata
  metadata_startup_script = var.metadata_startup_script

  boot_disk {
    initialize_params {
      image = var.boot_disk_image
      size  = var.boot_disk_size
      type  = var.boot_disk_type
    }
  }

  network_interface {
    network    = var.network
    subnetwork = var.subnetwork
    dynamic "access_config" {
      for_each = var.external_ip ? [1] : []
      content {}
    }
  }

  dynamic "service_account" {
    for_each = var.service_account_email != null ? [1] : []
    content {
      email  = var.service_account_email
      scopes = var.service_account_scopes
    }
  }
}
