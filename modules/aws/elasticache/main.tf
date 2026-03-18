resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = var.cluster_id
  description                = "Managed by Wolkvorm"
  engine                     = var.engine
  engine_version             = var.engine_version
  node_type                  = var.node_type
  port                       = var.port
  subnet_group_name          = var.subnet_group_name
  security_group_ids         = var.security_group_ids
  automatic_failover_enabled = var.automatic_failover_enabled
  multi_az_enabled           = var.multi_az_enabled
  num_node_groups            = var.num_node_groups
  replicas_per_node_group    = var.replicas_per_node_group
  at_rest_encryption_enabled = var.at_rest_encryption_enabled
  transit_encryption_enabled = var.transit_encryption_enabled
  apply_immediately          = var.apply_immediately
  snapshot_retention_limit   = var.snapshot_retention_limit
  tags                       = var.tags
}
