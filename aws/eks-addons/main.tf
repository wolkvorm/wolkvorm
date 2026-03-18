resource "aws_eks_addon" "this" {
  for_each                    = { for addon in var.addons : addon.name => addon }
  cluster_name                = var.cluster_name
  addon_name                  = each.key
  addon_version               = try(each.value.version, null)
  resolve_conflicts_on_create = try(each.value.resolve_conflicts_on_create, "OVERWRITE")
  resolve_conflicts_on_update = try(each.value.resolve_conflicts_on_update, "OVERWRITE")
  tags                        = var.tags
}
