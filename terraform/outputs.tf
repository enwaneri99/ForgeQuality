output "application_url" {
  description = "The public URL to access the deployed ForgeQuality platform"
  value       = local.app_url
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS Name"
  value       = aws_lb.main.dns_name
}

output "https_enabled" {
  description = "Indicates whether TLS/HTTPS on port 443 is active"
  value       = local.has_https
}

output "certificate_arn" {
  description = "The ACM SSL/TLS certificate ARN in use"
  value       = local.certificate_arn
}

output "ecs_cluster_name" {
  description = "Name of the Amazon ECS Cluster"
  value       = aws_ecs_cluster.main.name
}

output "backend_service_name" {
  description = "Name of the Backend ECS Fargate Service"
  value       = aws_ecs_service.backend.name
}

output "frontend_service_name" {
  description = "Name of the Frontend ECS Fargate Service"
  value       = aws_ecs_service.frontend.name
}

output "rds_endpoint" {
  description = "Private endpoint of the PostgreSQL RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "secrets_manager_name" {
  description = "AWS Secrets Manager secret name"
  value       = aws_secretsmanager_secret.app_secrets.name
}

output "backend_log_group" {
  description = "CloudWatch log group for backend tasks"
  value       = aws_cloudwatch_log_group.backend.name
}

output "frontend_log_group" {
  description = "CloudWatch log group for frontend tasks"
  value       = aws_cloudwatch_log_group.frontend.name
}
