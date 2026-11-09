#!/usr/bin/env bash
# Run as root on the deployed server: bash scripts/enable_https.sh PUBLIC_IPV4
# Keys/ACME account remain outside Git and Terraform state. No email is submitted.
set -euo pipefail
server=${1:?public IPv4 required}
python3 -c 'import ipaddress,sys; ipaddress.IPv4Address(sys.argv[1])' "$server"
cd /opt/family-finance/current
install -d -m 755 /opt/family-finance/acme
install -d -m 700 /opt/family-finance/tls /opt/family-finance/tls/certs
if ! test -x /opt/family-finance/certbot/bin/certbot; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-venv
  python3 -m venv /opt/family-finance/certbot
  /opt/family-finance/certbot/bin/pip install --quiet certbot==5.9.0
fi
certbot=/opt/family-finance/certbot/bin/certbot
install -m 700 scripts/renew_certificate.sh /opt/family-finance/tls/deploy-certificate
if ! test -f /opt/family-finance/tls/enabled; then
  docker compose -f compose.yaml -f compose.acme.yaml up -d --wait frontend
fi
# Staging validation is tested before issuance; staging certs are never served.
"$certbot" certonly --dry-run --non-interactive --agree-tos --register-unsafely-without-email \
  --preferred-profile shortlived --webroot -w /opt/family-finance/acme --ip-address "$server"
"$certbot" certonly --non-interactive --agree-tos --register-unsafely-without-email \
  --preferred-profile shortlived --webroot -w /opt/family-finance/acme --ip-address "$server" \
  --deploy-hook /opt/family-finance/tls/deploy-certificate
# For idempotent reruns when no certificate renewal was due.
RENEWED_LINEAGE="/etc/letsencrypt/live/$server" /opt/family-finance/tls/deploy-certificate
python3 scripts/tls_config.py
if ! grep -q '^COMPOSE_FILE=' .env; then
  printf '\nCOMPOSE_FILE=compose.yaml:compose.https.yaml\n' >> .env
fi
docker compose up -d --wait frontend
docker compose exec -T frontend nginx -t
touch /opt/family-finance/tls/enabled
cat > /etc/systemd/system/family-finance-certbot.service <<'UNIT'
[Unit]
Description=Renew family finance short-lived IP certificate
After=network-online.target docker.service
[Service]
Type=oneshot
ExecStart=/opt/family-finance/certbot/bin/certbot renew --quiet
UNIT
cat > /etc/systemd/system/family-finance-certbot.timer <<'UNIT'
[Unit]
Description=Check short-lived IP certificate renewal twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=1800
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now family-finance-certbot.timer
"$certbot" renew --dry-run --run-deploy-hooks --no-random-sleep-on-renew
curl --connect-timeout 10 --max-time 30 --fail --silent --resolve "$server:443:127.0.0.1" "https://$server/api/health"
