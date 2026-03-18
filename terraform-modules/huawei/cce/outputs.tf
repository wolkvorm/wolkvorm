output "id" { value = huaweicloud_cce_cluster.this.id }
output "name" { value = huaweicloud_cce_cluster.this.name }
output "status" { value = huaweicloud_cce_cluster.this.status }
output "certificate_clusters" { value = huaweicloud_cce_cluster.this.certificate_clusters; sensitive = true }
