resource "aws_cloudfront_distribution" "this" {
  comment             = var.comment
  enabled             = var.enabled
  is_ipv6_enabled     = var.is_ipv6_enabled
  price_class         = var.price_class
  default_root_object = var.default_root_object
  aliases             = var.aliases
  origin {
    domain_name = var.origin_domain_name
    origin_id   = var.origin_id
    origin_path = var.origin_path
    dynamic "s3_origin_config" {
      for_each = var.s3_origin_config_oai != null ? [1] : []
      content { origin_access_identity = var.s3_origin_config_oai }
    }
    dynamic "custom_origin_config" {
      for_each = var.s3_origin_config_oai == null ? [1] : []
      content {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }
  default_cache_behavior {
    target_origin_id       = var.origin_id
    viewer_protocol_policy = var.viewer_protocol_policy
    allowed_methods        = var.allowed_methods
    cached_methods         = var.cached_methods
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }
  restrictions {
    geo_restriction { restriction_type = var.geo_restriction_type }
  }
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version = var.acm_certificate_arn != null ? var.minimum_protocol_version : null
    cloudfront_default_certificate = var.acm_certificate_arn == null
  }
  tags = var.tags
}
