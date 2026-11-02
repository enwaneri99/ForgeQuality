# Security Group for Application Load Balancer
resource "aws_security_group" "alb" {
  name        = "forgequality-alb-sg-${var.environment}"
  description = "Controls public inbound traffic to the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow inbound HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow inbound HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic to VPC tasks"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "forgequality-alb-sg-${var.environment}"
  }
}

# Security Group for ECS Frontend Service
resource "aws_security_group" "ecs_frontend" {
  name        = "forgequality-frontend-sg-${var.environment}"
  description = "Allows ingress from ALB to Frontend Nginx"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow port 80 strictly from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow outbound to NAT / backend"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "forgequality-frontend-ecs-sg-${var.environment}"
  }
}

# Security Group for ECS Backend Service
resource "aws_security_group" "ecs_backend" {
  name        = "forgequality-backend-sg-${var.environment}"
  description = "Allows ingress from ALB and Frontend to FastAPI backend"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow port 8000 from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Allow port 8000 from Frontend container"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_frontend.id]
  }

  egress {
    description = "Allow outbound to RDS, ECR, CloudWatch, Secrets Manager"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "forgequality-backend-ecs-sg-${var.environment}"
  }
}

# Security Group for RDS PostgreSQL Database
resource "aws_security_group" "rds" {
  name        = "forgequality-rds-sg-${var.environment}"
  description = "Allows PostgreSQL traffic exclusively from ECS backend tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow PostgreSQL port 5432 strictly from backend ECS security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_backend.id]
  }

  egress {
    description = "No outbound traffic allowed from database"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  tags = {
    Name = "forgequality-rds-sg-${var.environment}"
  }
}

