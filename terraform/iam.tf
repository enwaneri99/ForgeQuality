# ECS Task Execution Role (Used by the ECS Agent to pull images, write logs, fetch secrets)
resource "aws_iam_role" "ecs_execution_role" {
  name = "forgequality-ecs-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "forgequality-ecs-execution-role-${var.environment}"
  }
}

# Standard execution policy: ECR pulling + CloudWatch logging
resource "aws_iam_role_policy_attachment" "ecs_execution_standard" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Policy allowing the ECS Agent to pull application secrets from Secrets Manager
resource "aws_iam_policy" "ecs_secrets_access" {
  name        = "forgequality-ecs-secrets-policy-${var.environment}"
  description = "Allows ECS execution role to access ForgeQuality Secrets Manager secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.app_secrets.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_secrets_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_secrets_access.arn
}

# ECS Task Role (Used by the application code running inside the container)
resource "aws_iam_role" "ecs_task_role" {
  name = "forgequality-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "forgequality-ecs-task-role-${var.environment}"
  }
}

