resource "huaweicloud_compute_instance" "this" {
  name               = var.name
  region             = var.region
  flavor_id          = var.flavor_id
  image_id           = var.image_id
  availability_zone  = var.availability_zone
  key_pair           = var.key_pair
  user_data          = var.user_data

  system_disk_type = var.system_disk_type
  system_disk_size = var.system_disk_size

  network {
    uuid              = var.network_id
    security_group_id = length(var.security_group_ids) > 0 ? var.security_group_ids[0] : null
  }

  tags = var.tags
}
