data "aws_ssm_parameter" "ami" {
  count = var.ami == "" ? 1 : 0
  name  = var.ami_ssm_parameter
}

locals {
  ami_id = var.ami != "" ? var.ami : data.aws_ssm_parameter.ami[0].value
}

resource "aws_instance" "this" {
  ami                         = local.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  key_name                    = var.key_name
  vpc_security_group_ids      = var.vpc_security_group_ids
  associate_public_ip_address = var.associate_public_ip_address
  iam_instance_profile        = var.iam_instance_profile
  monitoring                  = var.monitoring
  user_data                   = var.user_data
  ebs_optimized               = var.ebs_optimized
  disable_api_termination     = var.disable_api_termination
  disable_api_stop            = var.disable_api_stop
  availability_zone           = var.availability_zone
  private_ip                  = var.private_ip
  tenancy                     = var.tenancy
  source_dest_check           = var.source_dest_check
  hibernation                 = var.hibernation

  root_block_device {
    volume_size = var.root_block_device_size
    volume_type = var.root_block_device_type
    encrypted   = var.root_block_device_encrypted
  }

  tags = merge(var.tags, { Name = var.name })
}

resource "aws_eip" "this" {
  count    = var.create_eip ? 1 : 0
  instance = aws_instance.this.id
  domain   = "vpc"
  tags     = merge(var.tags, { Name = var.name })
}
