output "id" { value = digitalocean_kubernetes_cluster.this.id }
output "name" { value = digitalocean_kubernetes_cluster.this.name }
output "endpoint" { value = digitalocean_kubernetes_cluster.this.endpoint; sensitive = true }
output "kube_config" { value = digitalocean_kubernetes_cluster.this.kube_config[0].raw_config; sensitive = true }
output "cluster_urn" { value = digitalocean_kubernetes_cluster.this.urn }
