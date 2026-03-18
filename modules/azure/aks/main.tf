resource "azurerm_kubernetes_cluster" "this" {
  name                    = var.name
  resource_group_name     = var.resource_group_name
  location                = var.location
  kubernetes_version      = var.kubernetes_version
  dns_prefix              = var.dns_prefix
  sku_tier                = var.sku_tier
  private_cluster_enabled = var.private_cluster_enabled

  default_node_pool {
    name                 = var.default_node_pool_name
    vm_size              = var.default_node_pool_vm_size
    min_count            = var.default_node_pool_enable_auto_scaling ? var.default_node_pool_min_count : null
    max_count            = var.default_node_pool_enable_auto_scaling ? var.default_node_pool_max_count : null
    node_count           = var.default_node_pool_node_count
    enable_auto_scaling  = var.default_node_pool_enable_auto_scaling
    os_disk_size_gb      = var.default_node_pool_os_disk_size_gb
    vnet_subnet_id       = var.default_node_pool_subnet_id
  }

  identity { type = "SystemAssigned" }

  network_profile {
    network_plugin = var.network_plugin
    network_policy = var.network_policy
    service_cidr   = var.service_cidr
    dns_service_ip = var.dns_service_ip
  }

  tags = var.tags
}
