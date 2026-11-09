#!/usr/bin/env bash
# Usage: scripts/deploy.sh IPv4 SSH_KEY APP_ENV_FILE RELEASE
set -euo pipefail
server=${1:?server IPv4 required}
identity=${2:?SSH private key path required}
app_env=${3:?outside-repository app env file required}
release=${4:?release identifier required}
[[ "$server" =~ ^[0-9.]+$ && "$release" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid deployment arguments' >&2; exit 1; }
[[ -f "$identity" && -f "$app_env" ]] || { echo 'Required private file missing' >&2; exit 1; }
root=$(cd "$(dirname "$0")/.." && pwd)
archive=$(mktemp /tmp/family-finance.XXXXXX.tar.gz)
trap 'rm -f "$archive"' EXIT
# Explicit source allowlist: no .env, state, .git, reports, or local dependencies.
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$archive" --exclude=node_modules --exclude=dist --exclude=.venv --exclude=__pycache__ --exclude=.pytest_cache --exclude='*.tsbuildinfo' --exclude='.env*' -C "$root" frontend backend compose.yaml
ssh -i "$identity" -o StrictHostKeyChecking=yes "root@$server" "cloud-init status --wait >/dev/null && install -d -m 750 /opt/family-finance/releases/$release"
scp -q -i "$identity" -o StrictHostKeyChecking=yes "$archive" "root@$server:/opt/family-finance/releases/$release/source.tar.gz"
# Copy secret separately; no echo, no archive, no Terraform state.
scp -q -i "$identity" -o StrictHostKeyChecking=yes "$app_env" "root@$server:/opt/family-finance/releases/$release/.env"
ssh -i "$identity" -o StrictHostKeyChecking=yes "root@$server" "cd /opt/family-finance/releases/$release && chmod 600 .env && printf '\nAPP_VERSION=%s\n' '$release' >> .env && tar -xzf source.tar.gz && rm source.tar.gz && docker compose build && docker compose up -d --wait --force-recreate && curl --fail --silent http://127.0.0.1/api/health && ln -sfn /opt/family-finance/releases/$release /opt/family-finance/current"
