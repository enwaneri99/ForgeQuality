# Cryptographically random signing key for JWT
resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

# Initial administrator password (meets >= 12 chars requirement)
resource "random_password" "initial_admin_password" {
  length  = 16
  special = false
}

# AWS Secrets Manager Secret
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "forgequality/${var.environment}/app-secrets"
  description             = "Secure application secrets for ForgeQuality ECS tasks"
  recovery_window_in_days = 0

  tags = {
    Name = "forgequality-secrets-${var.environment}"
  }
}

# Secret Version storing the structured key-value payload
resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    DATABASE_URL           = "postgresql+psycopg://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
    SECRET_KEY             = random_password.jwt_secret.result
    INITIAL_ADMIN_PASSWORD = random_password.initial_admin_password.result
  })
}

