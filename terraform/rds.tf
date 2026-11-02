# Random URL-safe password for PostgreSQL
resource "random_password" "db_password" {
  length  = 24
  special = false
}

# Subnet Group for RDS in isolated database subnets
resource "aws_db_subnet_group" "rds" {
  name        = "forgequality-db-subnet-group-${var.environment}"
  description = "Database subnet group for ForgeQuality PostgreSQL"
  subnet_ids  = aws_subnet.database[*].id

  tags = {
    Name = "forgequality-db-subnet-group-${var.environment}"
  }
}

# Amazon RDS PostgreSQL 16 Instance
resource "aws_db_instance" "postgres" {
  identifier             = "forgequality-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  max_allocated_storage  = 100
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false # Set to true for production multi-AZ failover
  publicly_accessible = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:30-Sun:05:30"
  auto_minor_version_upgrade = true

  skip_final_snapshot = true
  deletion_protection = false

  tags = {
    Name = "forgequality-postgres-${var.environment}"
  }
}

