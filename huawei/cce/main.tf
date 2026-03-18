resource "huaweicloud_cce_cluster" "this" {
  name                   = var.name
  region                 = var.region
  flavor_id              = var.flavor_id
  cluster_type           = var.cluster_type
  cluster_version        = var.cluster_version
  vpc_id                 = var.vpc_id
  subnet_id              = var.subnet_id
  container_network_type = var.container_network_type
  container_network_cidr = var.container_network_cidr
  tags                   = var.tags
}
resource "huaweicloud_cce_node_pool" "main" {
  cluster_id             = huaweicloud_cce_cluster.this.id
  region                 = var.region
  name                   = var.node_pool_name
  flavor_id              = var.node_flavor
  availability_zone      = var.node_availability_zone
  os                     = var.node_os
  key_pair               = var.node_key_pair
  initial_node_count     = var.initial_node_count
  min_node_count         = var.node_min_count
  max_node_count         = var.node_max_count
  scall_enable           = true

  root_volume {
    volumetype = var.root_volume_type
    size       = var.root_volume_size
  }
  data_volumes {
    volumetype = var.data_volume_type
    size       = var.data_volume_size
  }
}
