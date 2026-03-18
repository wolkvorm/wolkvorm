variable "cluster_name" { type = string }
variable "addons" {
  type = list(object({ name = string, version = optional(string), resolve_conflicts_on_create = optional(string, "OVERWRITE"), resolve_conflicts_on_update = optional(string, "OVERWRITE") }))
  default = [
    { name = "vpc-cni" },
    { name = "coredns" },
    { name = "kube-proxy" },
    { name = "aws-ebs-csi-driver" }
  ]
}
variable "tags" {
  type = map(string)
  default = {}
}
