# ==========================================
# Domain, ACM Certificate & Route 53 Setup
# ==========================================

# Request an ACM Certificate if domain_name is provided and no existing certificate_arn is passed
resource "aws_acm_certificate" "cert" {
  count             = var.domain_name != "" && var.certificate_arn == "" ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "forgequality-acm-${var.environment}"
  }
}

# Automatically create DNS validation records in Route 53 if route53_zone_id is provided
resource "aws_route53_record" "cert_validation" {
  for_each = var.domain_name != "" && var.certificate_arn == "" && var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.cert[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Validate ACM Certificate via Route 53 DNS records
resource "aws_acm_certificate_validation" "cert" {
  count                   = var.domain_name != "" && var.certificate_arn == "" && var.route53_zone_id != "" ? 1 : 0
  certificate_arn         = aws_acm_certificate.cert[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Create Route 53 Alias Record pointing the domain to the ALB
resource "aws_route53_record" "app" {
  count   = var.domain_name != "" && var.route53_zone_id != "" ? 1 : 0
  zone_id = var.route53_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Resolved local values for certificate ARN and application URL
locals {
  certificate_arn = var.certificate_arn != "" ? var.certificate_arn : (
    length(aws_acm_certificate.cert) > 0 ? aws_acm_certificate.cert[0].arn : ""
  )
  has_https = local.certificate_arn != ""
  app_url = var.domain_name != "" ? (
    local.has_https ? "https://${var.domain_name}" : "http://${var.domain_name}"
  ) : (
    local.has_https ? "https://${aws_lb.main.dns_name}" : "http://${aws_lb.main.dns_name}"
  )
}

