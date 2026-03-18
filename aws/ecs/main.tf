resource "aws_ecs_cluster" "this" {
  name = var.cluster_name
  setting { name = "containerInsights"; value = var.container_insights ? "enabled" : "disabled" }
  tags = var.tags
}
resource "aws_iam_role" "task_execution" {
  count = var.service_name != null ? 1 : 0
  name  = "${var.cluster_name}-task-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
  tags = var.tags
}
resource "aws_iam_role_policy_attachment" "task_execution" {
  count      = var.service_name != null ? 1 : 0
  role       = aws_iam_role.task_execution[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_ecs_task_definition" "this" {
  count                    = var.service_name != null ? 1 : 0
  family                   = var.service_name
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  network_mode             = var.network_mode
  requires_compatibilities = [var.launch_type]
  execution_role_arn       = aws_iam_role.task_execution[0].arn
  container_definitions    = var.container_definitions
  tags                     = var.tags
}
resource "aws_ecs_service" "this" {
  count           = var.service_name != null ? 1 : 0
  name            = var.service_name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this[0].arn
  desired_count   = var.desired_count
  launch_type     = var.launch_type
  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = var.assign_public_ip
  }
  tags = var.tags
}
