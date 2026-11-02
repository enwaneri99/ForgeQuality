# CloudWatch Log Groups with 30-day Retention
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/forgequality-backend-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "forgequality-backend-logs-${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/forgequality-frontend-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "forgequality-frontend-logs-${var.environment}"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "forgequality-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "forgequality-cluster-${var.environment}"
  }
}

# ECS Cluster Capacity Providers (Fargate & Fargate Spot)
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# Backend ECS Task Definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "forgequality-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.backend_cpu)
  memory                   = tostring(var.backend_memory)
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.backend_image
      essential = true

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::"
        },
        {
          name      = "SECRET_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SECRET_KEY::"
        },
        {
          name      = "INITIAL_ADMIN_PASSWORD"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:INITIAL_ADMIN_PASSWORD::"
        }
      ]

      environment = [
        {
          name  = "INITIAL_ADMIN_USERNAME"
          value = var.initial_admin_username
        },
        {
          name  = "CORS_ORIGINS"
          value = "${local.app_url},http://localhost:5173,http://localhost:8080"
        },
        {
          name  = "FRONTEND_URL"
          value = local.app_url
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])

  tags = {
    Name = "forgequality-backend-taskdef-${var.environment}"
  }
}

# Frontend ECS Task Definition
resource "aws_ecs_task_definition" "frontend" {
  family                   = "forgequality-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.frontend_cpu)
  memory                   = tostring(var.frontend_memory)
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = var.frontend_image
      essential = true

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])

  tags = {
    Name = "forgequality-frontend-taskdef-${var.environment}"
  }
}

# Backend ECS Service with Zero-Downtime Rolling Deployments and Circuit Breakers
resource "aws_ecs_service" "backend" {
  name                   = "forgequality-backend-svc-${var.environment}"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.backend.arn
  launch_type            = "FARGATE"
  desired_count          = var.backend_desired_count
  enable_execute_command = true

  # Grace period allows Alembic migrations to run on startup before checking health
  health_check_grace_period_seconds = 60

  # Rolling updates: keep 100% running tasks while launching up to 200%
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Automatic rollback if deployment fails health checks
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  depends_on = [
    aws_db_instance.postgres
  ]

  tags = {
    Name = "forgequality-backend-service-${var.environment}"
  }
}

# Frontend ECS Service with Zero-Downtime Rolling Deployments
resource "aws_ecs_service" "frontend" {
  name                   = "forgequality-frontend-svc-${var.environment}"
  cluster                = aws_ecs_cluster.main.id
  task_definition        = aws_ecs_task_definition.frontend.arn
  launch_type            = "FARGATE"
  desired_count          = var.frontend_desired_count
  enable_execute_command = true

  health_check_grace_period_seconds  = 30
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_frontend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  tags = {
    Name = "forgequality-frontend-service-${var.environment}"
  }
}
