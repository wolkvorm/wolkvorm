output "id" { value = google_container_cluster.this.id }
output "name" { value = google_container_cluster.this.name }
output "endpoint" { value = google_container_cluster.this.endpoint; sensitive = true }
output "master_version" { value = google_container_cluster.this.master_version }
