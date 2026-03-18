resource "aws_route53_zone" "this" {
  name    = var.zone_name
  dynamic "vpc" {
    for_each = var.private_zone && var.vpc_id != null ? [1] : []
    content { vpc_id = var.vpc_id }
  }
  tags = var.tags
}
resource "aws_route53_record" "this" {
  count   = length(var.records)
  zone_id = aws_route53_zone.this.zone_id
  name    = var.records[count.index].name
  type    = var.records[count.index].type
  ttl     = var.records[count.index].alias == null ? var.records[count.index].ttl : null
  records = var.records[count.index].alias == null ? var.records[count.index].records : null
  dynamic "alias" {
    for_each = var.records[count.index].alias != null ? [var.records[count.index].alias] : []
    content {
      name                   = alias.value.name
      zone_id                = alias.value.zone_id
      evaluate_target_health = alias.value.evaluate_target_health
    }
  }
}
