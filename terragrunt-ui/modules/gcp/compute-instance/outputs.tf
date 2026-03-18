output "id" { value = google_compute_instance.this.id }
output "name" { value = google_compute_instance.this.name }
output "self_link" { value = google_compute_instance.this.self_link }
output "internal_ip" { value = google_compute_instance.this.network_interface[0].network_ip }
output "external_ip" { value = try(google_compute_instance.this.network_interface[0].access_config[0].nat_ip, null) }
