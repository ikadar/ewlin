#!/usr/bin/env bash
set -euo pipefail

# Restore all repos to the state saved in a snapshot file.
# Usage: ./scripts/snapshot-restore.sh [snapshot-file]
# Default input: ./snapshot.json
#
# This does a hard checkout to the exact commit SHA in the snapshot.
# WARNING: uncommitted changes will be lost. Commit or stash first.

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="${1:-$MONOREPO_ROOT/snapshot.json}"

if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: Snapshot file not found: $INPUT"
  exit 1
fi

echo "Restoring from: $INPUT"
echo "Created: $(python3 -c "import json,sys; print(json.load(sys.stdin)['created'])" < "$INPUT")"
echo "Description: $(python3 -c "import json,sys; print(json.load(sys.stdin).get('description',''))" < "$INPUT")"
echo ""

# Parse repos from snapshot
repos=$(python3 -c "
import json, sys
snap = json.load(sys.stdin)
for name, info in snap['repos'].items():
    print(f\"{name}:{info['path']}:{info['branch']}:{info['commit']}\")
" < "$INPUT")

# First pass: check for uncommitted changes
has_dirty=0
while IFS=: read -r name path branch commit; do
  dir="$MONOREPO_ROOT/$path"
  if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then
    echo "WARNING: $name ($path) has uncommitted changes!"
    has_dirty=1
  fi
done <<< "$repos"

if [[ $has_dirty -eq 1 ]]; then
  echo ""
  read -p "Repos with uncommitted changes detected. Continue? (y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# Second pass: restore
while IFS=: read -r name path branch commit; do
  dir="$MONOREPO_ROOT/$path"
  echo "Restoring $name → $commit (branch: $branch)"
  git -C "$dir" checkout "$branch" 2>/dev/null || git -C "$dir" checkout -b "$branch" "$commit"
  git -C "$dir" reset --hard "$commit"
done <<< "$repos"

echo ""
echo "All repos restored to snapshot state."
