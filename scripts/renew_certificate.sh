#!/usr/bin/env bash
# Certbot deploy hook, installed root-owned outside the application releases.
set -euo pipefail
lineage=${RENEWED_LINEAGE:?Certbot certificate lineage required}
certs=/opt/family-finance/tls/certs
install -m 644 "$lineage/fullchain.pem" "$certs/fullchain.pem.next"
install -m 600 "$lineage/privkey.pem" "$certs/privkey.pem.next"
# Move within the mounted directory, so nginx sees replacements after renewal.
mv "$certs/fullchain.pem.next" "$certs/fullchain.pem"
mv "$certs/privkey.pem.next" "$certs/privkey.pem"
if test -f /opt/family-finance/tls/enabled; then
  cd /opt/family-finance/current
  docker compose exec -T frontend nginx -t
  docker compose exec -T frontend nginx -s reload
fi
