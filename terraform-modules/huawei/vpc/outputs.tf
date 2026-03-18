output "id" { value = huaweicloud_vpc.this.id }
output "name" { value = huaweicloud_vpc.this.name }
output "cidr" { value = huaweicloud_vpc.this.cidr }
output "subnet_ids" { value = { for k, v in huaweicloud_vpc_subnet.this : k => v.id } }
