output "id" { value = google_compute_network.this.id }
output "name" { value = google_compute_network.this.name }
output "self_link" { value = google_compute_network.this.self_link }
output "subnet_ids" { value = { for k, v in google_compute_subnetwork.this : k => v.id } }
