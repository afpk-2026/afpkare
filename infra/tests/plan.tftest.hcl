mock_provider "vultr" {}
variables {
  ssh_public_key_path = "tests/deploy.pub"
  admin_ipv4          = "192.0.2.1"
}
run "isolated_single_server" {
  command = plan
  assert {
    condition     = vultr_instance.app.plan == "vc2-1c-2gb" && vultr_instance.app.region == "icn"
    error_message = "Default server must be the reviewed Seoul 2GB plan."
  }
  assert {
    condition     = vultr_firewall_rule.ssh.subnet_size == 32 && vultr_firewall_rule.ssh.port == "22" && vultr_firewall_rule.http.port == "80" && vultr_firewall_rule.https.port == "443"
    error_message = "Only public HTTP/HTTPS and single-IP SSH may be exposed."
  }
  assert {
    condition     = vultr_instance.app.backups == "disabled" && vultr_instance.app.enable_ipv6 == false
    error_message = "Do not silently add paid options or IPv6 exposure."
  }
}
