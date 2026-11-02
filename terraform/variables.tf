variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "domain_name" {
  description = "Custom domain name (e.g. quality.example.com); optional. If empty, uses ALB DNS name."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN of an existing ACM SSL/TLS certificate; optional. If provided, enables HTTPS on port 443."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for domain DNS validation and Alias record; optional."
  type        = string
  default     = ""
}

variable "backend_image" {
  description = "Full ECR image URI for backend (e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com/forgequality-backend:1.0.0)"
  type        = string
}

variable "frontend_image" {
  description = "Full ECR image URI for frontend (e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com/forgequality-frontend:1.0.0)"
  type        = string
}

variable "backend_cpu" {
  description = "Fargate vCPU units for backend (256, 512, 1024, 2048)"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Fargate Memory (MB) for backend (512, 1024, 2048, 4096)"
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "Fargate vCPU units for frontend (256, 512)"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Fargate Memory (MB) for frontend (512, 1024)"
  type        = number
  default     = 512
}

variable "backend_desired_count" {
  description = "Number of backend task replicas for high availability"
  type        = number
  default     = 2
}

variable "frontend_desired_count" {
  description = "Number of frontend task replicas for high availability"
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB for RDS PostgreSQL"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "PostgreSQL initial database name"
  type        = string
  default     = "quality"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "quality_admin"
}

variable "initial_admin_username" {
  description = "Bootstrap administrator username"
  type        = string
  default     = "plant-admin"
}
