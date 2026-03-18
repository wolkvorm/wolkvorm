resource "aws_db_instance" "this" {
  identifier                  = var.identifier
  engine                      = var.engine
  engine_version              = var.engine_version
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = var.max_allocated_storage
  storage_type                = var.storage_type
  storage_encrypted           = var.storage_encrypted
  db_name                     = var.db_name
  username                    = var.username
  password                    = var.password
  port                        = var.port
  multi_az                    = var.multi_az
  publicly_accessible         = var.publicly_accessible
  db_subnet_group_name        = var.db_subnet_group_name
  vpc_security_group_ids      = var.vpc_security_group_ids
  backup_retention_period     = var.backup_retention_period
  backup_window               = var.backup_window
  maintenance_window          = var.maintenance_window
  auto_minor_version_upgrade  = var.auto_minor_version_upgrade
  deletion_protection         = var.deletion_protection
  skip_final_snapshot         = var.skip_final_snapshot
  apply_immediately           = var.apply_immediately
  performance_insights_enabled = var.performance_insights_enabled
  monitoring_interval         = var.monitoring_interval
  tags                        = var.tags
}
