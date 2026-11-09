#!/usr/bin/env bash
# Installed root-owned as /usr/local/sbin/family-finance-deploy on the private runner.
# Usage: sudo family-finance-deploy CHECKOUT FULL_COMMIT_SHA
set -euo pipefail
checkout=${1:?checkout required}
sha=${2:?commit required}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ "$checkout" == /opt/actions-runner/_work/no-named/no-named ]] || exit 2
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$checkout"
[[ "$(git -C "$checkout" rev-parse HEAD)" == "$sha" ]] || exit 2
base=/opt/family-finance
release="main-${sha:0:12}"
next="$base/releases/$release"
previous=$(readlink -f "$base/current")
# Serialize manual and CI deployments on the server. Never interrupt a running rollout.
exec 9>"$base/deploy.lock"
flock -w 600 9
install -d -m 750 "$next"
git -C "$checkout" archive "$sha" frontend backend compose.yaml compose.https.yaml scripts/tls_config.py | tar -x -C "$next"
install -m 600 "$base/runtime/app.env" "$next/.env"
printf '\nAPP_VERSION=%s\n' "$release" >> "$next/.env"
if test -f "$base/tls/enabled"; then
  (cd "$next" && python3 scripts/tls_config.py)
  printf 'COMPOSE_FILE=compose.yaml:compose.https.yaml\n' >> "$next/.env"
fi
rollback() {
  echo 'Deployment failed; restoring the previous release.' >&2
  cd "$previous"
  docker compose up -d --wait --no-build --force-recreate
}
trap rollback ERR
cd "$next"
docker compose config --quiet
docker compose build
docker compose up -d --wait --force-recreate
curl --connect-timeout 5 --max-time 15 --fail --silent http://127.0.0.1/api/health | \
  python3 -c 'import json,sys; r=json.load(sys.stdin); assert r["status"]=="ok" and r["release"]==sys.argv[1]; print(json.dumps(r))' "$release"
python3 "$checkout/scripts/check_deployment.py" https://158.247.203.92/ "$release"
ln -sfn "$next" "$base/current"
trap - ERR
echo "Deployed $sha as $release"
