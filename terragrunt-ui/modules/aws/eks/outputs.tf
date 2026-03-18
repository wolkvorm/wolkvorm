output "cluster_id" { value = aws_eks_cluster.this.id }
output "cluster_name" { value = aws_eks_cluster.this.name }
output "cluster_endpoint" { value = aws_eks_cluster.this.endpoint }
output "cluster_certificate_authority_data" { value = aws_eks_cluster.this.certificate_authority[0].data }
output "cluster_arn" { value = aws_eks_cluster.this.arn }
output "node_group_arn" { value = aws_eks_node_group.main.arn }
