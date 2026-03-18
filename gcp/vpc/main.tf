resource "google_compute_network" "this" {
  name                    = var.name
  project                 = var.project
  auto_create_subnetworks = var.auto_create_subnetworks
  routing_mode            = var.routing_mode
}
resource "google_compute_subnetwork" "this" {
  for_each                 = { for s in var.subnets : s.name => s }
  name                     = each.key
  project                  = var.project
  network                  = google_compute_network.this.id
  ip_cidr_range            = each.value.ip_cidr_range
  region                   = each.value.region
  private_ip_google_access = each.value.private_ip_google_access
}
