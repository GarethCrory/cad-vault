#!/usr/bin/env bash
set -e

BASE="http://localhost:4000"

P="$1"      # project number, e.g. P001
N="$2"      # project name, e.g. TestProject
T="$3"      # type prefix, e.g. A
NUM="$4"    # part number, e.g. 001

if [ -z "$P" ] || [ -z "$N" ] || [ -z "$T" ] || [ -z "$NUM" ]; then
  echo "usage: $0 <projectNumber> <projectName> <typePrefix> <partNumber>"
  exit 1
fi

echo "[1] health"
curl -s "$BASE/api/health" | python3 -m json.tool >/dev/null

echo "[2] history (get latest)"
LATEST=$(curl -s -X POST "$BASE/api/part/history" \
  -H "Content-Type: application/json" \
  -d "{\"projectNumber\":\"$P\",\"projectName\":\"$N\",\"typePrefix\":\"$T\",\"partNumber\":\"$NUM\"}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("latestRev",""))')
echo "latest: ${LATEST:-none}"

echo "[3] revise (auto-bump)"
echo "Smoke file $(date -u +%H%M%S)" > /tmp/smoke.step
curl -s -X POST "$BASE/api/file/revise" \
  -F "file=@/tmp/smoke.step;type=application/octet-stream" \
  -F "project={\"projectNumber\":\"$P\",\"projectName\":\"$N\"}" \
  -F "typePrefix=$T" \
  -F "partNumber=$NUM" \
  -F "description=Smoke Test Part" \
  -F "notes=smoke" | python3 -m json.tool

echo "[4] scan project"
curl -s -X POST "$BASE/api/project/scan" \
  -H "Content-Type: application/json" \
  -d "{\"projectNumber\":\"$P\",\"projectName\":\"$N\"}" | python3 -m json.tool >/dev/null

TAG=$(date +%Y-%m-%d)
echo "[5] release $TAG"
curl -s -X POST "$BASE/api/release/generate" \
  -H "Content-Type: application/json" \
  -d "{\"projectNumber\":\"$P\",\"projectName\":\"$N\",\"tag\":\"$TAG\"}" | python3 -m json.tool
