output "addons" { value = { for k, v in aws_eks_addon.this : k => v.arn } }
