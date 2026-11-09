terraform {
  required_version = ">= 1.7, < 2.0"
  backend "local" {}
  required_providers {
    vultr = {
      source  = "vultr/vultr"
      version = "~> 2.32"
    }
  }
}
# VULTR_API_KEY is read from the process environment, never a Terraform variable.
provider "vultr" {}

variable "region" {
  type    = string
  default = "icn"
}
variable "plan" {
  type    = string
  default = "vc2-1c-2gb"
}
variable "ssh_public_key_path" { type = string }
variable "admin_ipv4" {
  type        = string
  description = "SSH access is restricted to this IPv4 /32."
  validation {
    condition     = can(cidrhost("${var.admin_ipv4}/32", 0))
    error_message = "A valid single IPv4 address is required."
  }
}
resource "vultr_ssh_key" "deploy" {
  name    = "family-finance-deploy"
  ssh_key = trimspace(file(pathexpand(var.ssh_public_key_path)))
}
resource "vultr_firewall_group" "app" { description = "family-finance public HTTP/HTTPS, restricted SSH" }
resource "vultr_firewall_rule" "http" {
  firewall_group_id = vultr_firewall_group.app.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "80"
}
resource "vultr_firewall_rule" "https" {
  firewall_group_id = vultr_firewall_group.app.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "443"
}
resource "vultr_firewall_rule" "ssh" {
  firewall_group_id = vultr_firewall_group.app.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = var.admin_ipv4
  subnet_size       = 32
  port              = "22"
}
resource "vultr_instance" "app" {
  region            = var.region
  plan              = var.plan
  os_id             = 2284
  label             = "family-finance-simulator"
  hostname          = "family-finance"
  backups           = "disabled"
  enable_ipv6       = false
  activation_email  = false
  ssh_key_ids       = [vultr_ssh_key.deploy.id]
  firewall_group_id = vultr_firewall_group.app.id
  user_data         = file("${path.module}/cloud-init.yaml")
  depends_on        = [vultr_firewall_rule.http, vultr_firewall_rule.ssh]
  lifecycle { prevent_destroy = true }
}
output "public_url" { value = "https://${vultr_instance.app.main_ip}/" }
output "server_ipv4" { value = vultr_instance.app.main_ip }
