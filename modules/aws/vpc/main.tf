resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support
  instance_tenancy     = var.instance_tenancy
  assign_generated_ipv6_cidr_block = var.enable_ipv6

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_internet_gateway" "this" {
  count  = length(var.public_subnets) > 0 ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-igw" })
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = length(var.azs) > count.index ? var.azs[count.index] : null
  map_public_ip_on_launch = var.map_public_ip_on_launch
  tags = merge(var.tags, { Name = "${var.name}-public-${count.index + 1}" })
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = length(var.azs) > count.index ? var.azs[count.index] : null
  tags = merge(var.tags, { Name = "${var.name}-private-${count.index + 1}" })
}

resource "aws_subnet" "database" {
  count             = length(var.database_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.database_subnets[count.index]
  availability_zone = length(var.azs) > count.index ? var.azs[count.index] : null
  tags = merge(var.tags, { Name = "${var.name}-db-${count.index + 1}" })
}

resource "aws_subnet" "elasticache" {
  count             = length(var.elasticache_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.elasticache_subnets[count.index]
  availability_zone = length(var.azs) > count.index ? var.azs[count.index] : null
  tags = merge(var.tags, { Name = "${var.name}-elasticache-${count.index + 1}" })
}

resource "aws_subnet" "intra" {
  count             = length(var.intra_subnets)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.intra_subnets[count.index]
  availability_zone = length(var.azs) > count.index ? var.azs[count.index] : null
  tags = merge(var.tags, { Name = "${var.name}-intra-${count.index + 1}" })
}

resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.azs)) : 0
  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.name}-nat-${count.index + 1}" })
}

resource "aws_nat_gateway" "this" {
  count         = var.enable_nat_gateway && length(var.public_subnets) > 0 ? (var.single_nat_gateway ? 1 : length(var.azs)) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags = merge(var.tags, { Name = "${var.name}-nat-${count.index + 1}" })
  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  count  = length(var.public_subnets) > 0 ? 1 : 0
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this[0].id
  }
  tags = merge(var.tags, { Name = "${var.name}-public" })
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnets)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table" "private" {
  count  = length(var.private_subnets) > 0 ? 1 : 0
  vpc_id = aws_vpc.this.id
  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.this[0].id
    }
  }
  tags = merge(var.tags, { Name = "${var.name}-private" })
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnets)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_db_subnet_group" "this" {
  count      = var.create_database_subnet_group && length(var.database_subnets) > 0 ? 1 : 0
  name       = "${var.name}-db"
  subnet_ids = aws_subnet.database[*].id
  tags       = merge(var.tags, { Name = "${var.name}-db" })
}

resource "aws_elasticache_subnet_group" "this" {
  count      = length(var.elasticache_subnets) > 0 ? 1 : 0
  name       = "${var.name}-elasticache"
  subnet_ids = aws_subnet.elasticache[*].id
  tags       = merge(var.tags, { Name = "${var.name}-elasticache" })
}

resource "aws_vpn_gateway" "this" {
  count  = var.enable_vpn_gateway ? 1 : 0
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-vgw" })
}
