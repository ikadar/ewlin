#!/usr/bin/env bash
set -euo pipefail

# Save the current state of all repos as a snapshot.
# Usage: ./scripts/snapshot-save.sh [snapshot-file]
# Default output: ./snapshot.json

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="${1:-$MONOREPO_ROOT/snapshot.json}"

repos=(
  "ewlin:."
  "ewlin-php-api:services/php-api"
  "ewlin-types:packages/types"
  "ewlin-validator:packages/validator"
  "ewlin-validation-service:services/validation-service"
)

echo "{"
echo "  \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
echo "  \"description\": \"${SNAPSHOT_DESC:-prod snapshot}\","
echo "  \"repos\": {"

last_idx=$(( ${#repos[@]} - 1 ))
for i in "${!repos[@]}"; do
  IFS=: read -r name path <<< "${repos[$i]}"
  dir="$MONOREPO_ROOT/$path"
  branch=$(git -C "$dir" branch --show-current)
  commit=$(git -C "$dir" rev-parse HEAD)
  short=$(git -C "$dir" log --oneline -1)
  comma=","
  [[ $i -eq $last_idx ]] && comma=""
  echo "    \"$name\": {"
  echo "      \"path\": \"$path\","
  echo "      \"branch\": \"$branch\","
  echo "      \"commit\": \"$commit\","
  echo "      \"short\": \"$short\""
  echo "    }$comma"
done

echo "  }"
echo "}"
