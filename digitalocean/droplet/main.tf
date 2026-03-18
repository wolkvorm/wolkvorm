resource "digitalocean_droplet" "this" {
  name               = var.name
  region             = var.region
  size               = var.size
  image              = var.image
  ssh_keys           = var.ssh_keys
  backups            = var.backups
  monitoring         = var.monitoring
  ipv6               = var.ipv6
  private_networking = var.private_networking
  vpc_uuid           = var.vpc_uuid
  user_data          = var.user_data
  resize_disk        = var.resize_disk
  tags               = var.tags
}
