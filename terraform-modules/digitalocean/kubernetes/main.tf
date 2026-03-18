data "digitalocean_kubernetes_versions" "this" {
  version_prefix = var.version_slug
}
resource "digitalocean_kubernetes_cluster" "this" {
  name         = var.name
  region       = var.region
  version      = data.digitalocean_kubernetes_versions.this.latest_version
  auto_upgrade = var.auto_upgrade
  tags         = var.tags

  node_pool {
    name       = var.node_pool_name
    size       = var.node_size
    node_count = var.auto_scale ? null : var.node_count
    auto_scale = var.auto_scale
    min_nodes  = var.auto_scale ? var.min_nodes : null
    max_nodes  = var.auto_scale ? var.max_nodes : null
    tags       = var.tags
  }
}
