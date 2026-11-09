"""Build the TLS variant from the same audited nginx API/security configuration."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = (root / "frontend/nginx.conf").read_text()
if source.count("    listen 80;\n") != 1:
    raise SystemExit("Expected exactly one HTTP listener; refusing an ambiguous TLS config.")
(root / "frontend/nginx.https.conf").write_text(source.replace(
    "    listen 80;\n",
    "    listen 80;\n    listen 443 ssl;\n"
    "    ssl_certificate /etc/nginx/tls/fullchain.pem;\n"
    "    ssl_certificate_key /etc/nginx/tls/privkey.pem;\n"
    "    ssl_protocols TLSv1.2 TLSv1.3;\n"
    "    ssl_session_cache shared:TLS:1m;\n",
))
