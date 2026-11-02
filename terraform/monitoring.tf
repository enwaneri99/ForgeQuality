# ==========================================
# CloudWatch Metrics, Alarms & Observability
# ==========================================

# Alarm: Backend Unhealthy Hosts
resource "aws_cloudwatch_metric_alarm" "backend_unhealthy_hosts" {
  alarm_name          = "forgequality-backend-unhealthy-hosts-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Monitors if any backend ECS Fargate task fails its health check probe"

  dimensions = {
    TargetGroup  = aws_lb_target_group.backend.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "forgequality-backend-health-alarm-${var.environment}"
  }
}

# Alarm: Frontend Unhealthy Hosts
resource "aws_cloudwatch_metric_alarm" "frontend_unhealthy_hosts" {
  alarm_name          = "forgequality-frontend-unhealthy-hosts-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Monitors if any frontend ECS Fargate task fails its health check probe"

  dimensions = {
    TargetGroup  = aws_lb_target_group.frontend.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "forgequality-frontend-health-alarm-${var.environment}"
  }
}

# Alarm: ALB 5XX Internal Server Error Spikes
resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "forgequality-alb-5xx-errors-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Triggers when application targets return more than 5 5XX errors within 1 minute"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name = "forgequality-alb-5xx-alarm-${var.environment}"
  }
}

# Alarm: Backend High CPU Utilization (> 85%)
resource "aws_cloudwatch_metric_alarm" "backend_high_cpu" {
  alarm_name          = "forgequality-backend-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 120
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Triggers if backend ECS service CPU utilization exceeds 85% for 4 minutes"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = {
    Name = "forgequality-backend-cpu-alarm-${var.environment}"
  }
}

# Alarm: Backend High Memory Utilization (> 85%)
resource "aws_cloudwatch_metric_alarm" "backend_high_memory" {
  alarm_name          = "forgequality-backend-high-memory-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 120
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Triggers if backend ECS service Memory utilization exceeds 85% for 4 minutes"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.backend.name
  }

  tags = {
    Name = "forgequality-backend-memory-alarm-${var.environment}"
  }
}

