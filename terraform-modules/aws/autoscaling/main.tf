resource "aws_launch_template" "this" {
  name          = coalesce(var.launch_template_name, "${var.name}-lt")
  image_id      = var.image_id
  instance_type = var.instance_type
  key_name      = var.key_name
  user_data     = var.user_data != null ? base64encode(var.user_data) : null
  dynamic "network_interfaces" {
    for_each = length(var.security_groups) > 0 ? [1] : []
    content { security_groups = var.security_groups }
  }
  tags = var.tags
}
resource "aws_autoscaling_group" "this" {
  name                      = var.name
  min_size                  = var.min_size
  max_size                  = var.max_size
  desired_capacity          = var.desired_capacity
  vpc_zone_identifier       = var.vpc_zone_identifier
  health_check_type         = var.health_check_type
  health_check_grace_period = var.health_check_grace_period
  default_cooldown          = var.default_cooldown
  target_group_arns         = var.target_group_arns
  protect_from_scale_in     = var.protect_from_scale_in
  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }
  dynamic "tag" {
    for_each = merge(var.tags, { Name = var.name })
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}
