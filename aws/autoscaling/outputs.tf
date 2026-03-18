output "autoscaling_group_id" { value = aws_autoscaling_group.this.id }
output "autoscaling_group_arn" { value = aws_autoscaling_group.this.arn }
output "autoscaling_group_name" { value = aws_autoscaling_group.this.name }
output "launch_template_id" { value = aws_launch_template.this.id }
output "launch_template_arn" { value = aws_launch_template.this.arn }
