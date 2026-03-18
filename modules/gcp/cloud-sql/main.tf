resource "google_sql_database_instance" "this" {
  name             = var.name
  project          = var.project
  region           = var.region
  database_version = var.database_version
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    disk_size         = var.disk_size
    disk_type         = var.disk_type
    disk_autoresize   = var.disk_autoresize
    disk_autoresize_limit = var.disk_autoresize_limit
    availability_type = var.availability_type
    user_labels       = var.labels

    backup_configuration {
      enabled    = var.backup_enabled
      start_time = var.backup_start_time
    }
  }
}
resource "google_sql_database" "this" {
  count    = var.db_name != null ? 1 : 0
  name     = var.db_name
  project  = var.project
  instance = google_sql_database_instance.this.name
}
resource "google_sql_user" "this" {
  count    = var.db_user != null ? 1 : 0
  name     = var.db_user
  project  = var.project
  instance = google_sql_database_instance.this.name
  password = var.db_password
}
