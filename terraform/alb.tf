# Internet-facing Application Load Balancer
resource "aws_lb" "main" {
  name               = "forgequality-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "forgequality-alb-${var.environment}"
  }
}

# Target Group for Frontend (Port 80, Target Type: IP for Fargate)
resource "aws_lb_target_group" "frontend" {
  name                 = "forgequality-tg-fe-${var.environment}"
  port                 = 80
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  tags = {
    Name = "forgequality-tg-frontend-${var.environment}"
  }
}

# Target Group for Backend (Port 8000, Target Type: IP for Fargate)
resource "aws_lb_target_group" "backend" {
  name                 = "forgequality-tg-be-${var.environment}"
  port                 = 8000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "forgequality-tg-backend-${var.environment}"
  }
}

# ==========================================
# HTTP (Port 80) Listener Configurations
# ==========================================

# When HTTPS is active: Redirect all Port 80 traffic to HTTPS Port 443
resource "aws_lb_listener" "http_redirect" {
  count             = local.has_https ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# When HTTPS is NOT active: Direct forward to Frontend
resource "aws_lb_listener" "http_forward" {
  count             = local.has_https ? 0 : 1
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# HTTP API Rule (Active only when running in HTTP-only mode)
resource "aws_lb_listener_rule" "api_http" {
  count        = local.has_https ? 0 : 1
  listener_arn = aws_lb_listener.http_forward[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# ==========================================
# HTTPS (Port 443) Listener Configurations
# ==========================================

# HTTPS Listener (Active when an ACM Certificate is resolved)
resource "aws_lb_listener" "https" {
  count             = local.has_https ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# HTTPS API Rule: Route all /api/* directly to Backend
resource "aws_lb_listener_rule" "api_https" {
  count        = local.has_https ? 1 : 0
  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
