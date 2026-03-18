output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.this.id
}
output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.this.cidr_block
}
output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}
output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}
output "database_subnet_ids" {
  description = "List of IDs of database subnets"
  value       = aws_subnet.database[*].id
}
output "database_subnet_group_id" {
  description = "ID of database subnet group"
  value       = try(aws_db_subnet_group.this[0].id, null)
}
output "nat_public_ips" {
  description = "List of public Elastic IPs created for NAT Gateway"
  value       = aws_eip.nat[*].public_ip
}
