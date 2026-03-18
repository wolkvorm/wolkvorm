output "id" { value = azurerm_kubernetes_cluster.this.id }
output "name" { value = azurerm_kubernetes_cluster.this.name }
output "kube_config_raw" { value = azurerm_kubernetes_cluster.this.kube_config_raw; sensitive = true }
output "host" { value = azurerm_kubernetes_cluster.this.kube_config[0].host; sensitive = true }
output "client_certificate" { value = azurerm_kubernetes_cluster.this.kube_config[0].client_certificate; sensitive = true }
output "principal_id" { value = azurerm_kubernetes_cluster.this.identity[0].principal_id }
