resource "google_container_cluster" "this" {
  name               = var.name
  project            = var.project
  location           = var.location
  network            = var.network
  subnetwork         = var.subnetwork
  min_master_version = var.kubernetes_version
  remove_default_node_pool = var.remove_default_node_pool
  initial_node_count = var.initial_node_count
  resource_labels    = var.labels

  dynamic "private_cluster_config" {
    for_each = var.enable_private_nodes ? [1] : []
    content {
      enable_private_nodes    = true
      enable_private_endpoint = false
      master_ipv4_cidr_block  = var.master_ipv4_cidr_block
    }
  }
}
resource "google_container_node_pool" "main" {
  name       = var.node_pool_name
  project    = var.project
  location   = var.location
  cluster    = google_container_cluster.this.name
  node_count = var.enable_autoscaling ? null : var.node_count

  dynamic "autoscaling" {
    for_each = var.enable_autoscaling ? [1] : []
    content {
      min_node_count = var.min_node_count
      max_node_count = var.max_node_count
    }
  }

  node_config {
    preemptible  = var.preemptible
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = var.disk_type
    labels       = var.labels
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }
}
