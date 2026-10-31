#!/usr/bin/env bash
# Integrationstest des fertigen Images – so wie es auf ZimaOS läuft:
# Bind-Mount eines root-eigenen Ordners, read-only, nur CHOWN/SETUID/SETGID.
set -euo pipefail
IMAGE="${1:?Image angeben}"
NAME=sqlw-e2e
DATA="$(mktemp -d)"
sudo chown root:root "$DATA"
cleanup() { docker logs "$NAME" 2>&1 | tail -20 || true; docker rm -f "$NAME" >/dev/null 2>&1 || true; sudo rm -rf "$DATA"; }
trap cleanup EXIT

docker run -d --name "$NAME" -p 18095:8080 \
  --cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID \
  --security-opt no-new-privileges:true --read-only --tmpfs /tmp \
  -v "$DATA":/data "$IMAGE" >/dev/null

for i in $(seq 1 30); do
  curl -fs http://127.0.0.1:18095/api/health >/dev/null && break
  sleep 1
done
curl -fs http://127.0.0.1:18095/api/health | tee /dev/stderr | grep -q '"storage":"server"'
curl -fs http://127.0.0.1:18095/ | grep -q 'SQL'
curl -fs -o /dev/null http://127.0.0.1:18095/vendor/sql-wasm.wasm

# Lernstand speichern und nach Neustart wieder lesen
curl -fs -X PUT -H 'Content-Type: application/json' -d '{"updatedAt":1,"xp":7,"tasks":{}}' http://127.0.0.1:18095/api/state/ci >/dev/null
docker restart "$NAME" >/dev/null
for i in $(seq 1 30); do curl -fs http://127.0.0.1:18095/api/health >/dev/null && break; sleep 1; done
curl -fs http://127.0.0.1:18095/api/state/ci | grep -q '"xp":7'

# Prozess läuft ohne root und ohne Capabilities, Daten gehören UID 1000
uid=$(docker top "$NAME" -eo pid,uid,comm | awk '$3=="node"{print $2}' | head -1)
[ "$uid" = "1000" ] || { echo "Prozess läuft als UID $uid statt 1000"; exit 1; }
capeff=$(docker exec "$NAME" sh -c 'grep CapEff /proc/1/status' | awk '{print $2}')
[ "$capeff" = "0000000000000000" ] || { echo "Prozess hat noch Capabilities: $capeff"; exit 1; }
[ "$(sudo stat -c %u "$DATA/profil-ci.json")" = "1000" ] || { echo "Datei gehört nicht UID 1000"; exit 1; }
echo "Container-Test bestanden"
