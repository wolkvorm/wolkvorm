variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  type        = string
  default     = ""
}

variable "cluster_version" {
  description = "Kubernetes version of the cluster"
  type        = string
  default     = ""
}

variable "oidc_provider_arn" {
  description = "ARN of the OIDC provider for the cluster"
  type        = string
  default     = ""
}

variable "enable_aws_load_balancer_controller" {
  description = "Enable AWS Load Balancer Controller addon"
  type        = bool
  default     = false
}

variable "aws_load_balancer_controller" {
  description = "Configuration for AWS Load Balancer Controller"
  type        = any
  default     = {}
}

variable "enable_aws_ebs_csi_driver" {
  description = "Enable AWS EBS CSI Driver addon"
  type        = bool
  default     = true
}

variable "enable_aws_efs_csi_driver" {
  description = "Enable AWS EFS CSI Driver addon"
  type        = bool
  default     = false
}

variable "enable_metrics_server" {
  description = "Enable Metrics Server addon"
  type        = bool
  default     = true
}

variable "enable_cluster_autoscaler" {
  description = "Enable Cluster Autoscaler addon"
  type        = bool
  default     = false
}

variable "enable_karpenter" {
  description = "Enable Karpenter node provisioner"
  type        = bool
  default     = false
}

variable "karpenter" {
  description = "Configuration for Karpenter"
  type        = any
  default     = {}
}

variable "karpenter_node" {
  description = "Configuration for Karpenter node IAM role"
  type        = any
  default     = {}
}

variable "enable_external_dns" {
  description = "Enable ExternalDNS addon"
  type        = bool
  default     = false
}

variable "enable_cert_manager" {
  description = "Enable cert-manager addon"
  type        = bool
  default     = false
}

variable "enable_aws_cloudwatch_metrics" {
  description = "Enable AWS CloudWatch metrics collection"
  type        = bool
  default     = false
}

variable "enable_aws_for_fluentbit" {
  description = "Enable AWS for FluentBit log forwarding"
  type        = bool
  default     = false
}

variable "enable_ingress_nginx" {
  description = "Enable ingress-nginx controller"
  type        = bool
  default     = false
}

variable "enable_kube_prometheus_stack" {
  description = "Enable kube-prometheus-stack monitoring"
  type        = bool
  default     = false
}

variable "enable_argocd" {
  description = "Enable ArgoCD GitOps tool"
  type        = bool
  default     = false
}

variable "enable_velero" {
  description = "Enable Velero backup solution"
  type        = bool
  default     = false
}

variable "enable_csi_secrets_store_provider_aws" {
  description = "Enable AWS CSI Secrets Store Provider"
  type        = bool
  default     = false
}

variable "enable_external_secrets" {
  description = "Enable External Secrets Operator"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
