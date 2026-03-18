resource "huaweicloud_vpc" "this" {
  name        = var.name
  region      = var.region
  cidr        = var.cidr
  description = var.description
  tags        = var.tags
}
resource "huaweicloud_vpc_subnet" "this" {
  for_each   = { for s in var.subnets : s.name => s }
  region     = var.region
  name       = each.key
  vpc_id     = huaweicloud_vpc.this.id
  cidr       = each.value.cidr
  gateway_ip = each.value.gateway_ip
  tags       = var.tags
}
