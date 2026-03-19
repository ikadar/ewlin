#!/bin/bash
# Flux Scheduler - Deploy Push (run from local machine)
# Syncs code to server via rsync, then runs server-side deploy
#
# Usage:
#   ./scripts/deploy-push.sh                      Deploy current state (auto-saves snapshot)
#   ./scripts/deploy-push.sh snapshot.json         Restore to snapshot first, then deploy
#   ./scripts/deploy-push.sh --dry-run             Show what would happen, no remote operations
#   ./scripts/deploy-push.sh --dry-run snap.json   Dry-run with snapshot restore
#
# Configuration via environment variables:
#   DEPLOY_USER - SSH user (default: user)
#   DEPLOY_HOST - SSH host (default: server)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse --dry-run flag
DRY_RUN=0
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=1
  else
    ARGS+=("$arg")
  fi
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

# Configuration
REMOTE_USER="${DEPLOY_USER:-ordo}"
REMOTE_HOST="${DEPLOY_HOST:-ordo.replic-os.com}"
REMOTE_DIR="/home/ordo/ordo-replic-os"

echo "=========================================="
echo "Flux Scheduler - Deploy Push"
[[ $DRY_RUN -eq 1 ]] && echo "  *** DRY RUN — no remote operations ***"
echo "=========================================="

# Snapshot handling
SNAPSHOT_DIR="$MONOREPO_ROOT/snapshots"
mkdir -p "$SNAPSHOT_DIR"

if [[ -n "$1" ]]; then
  # Restore mode: restore repos to snapshot state, then deploy
  SNAPSHOT_FILE="$1"
  if [[ ! -f "$SNAPSHOT_FILE" ]]; then
    echo "ERROR: Snapshot file not found: $SNAPSHOT_FILE"
    exit 1
  fi
  echo ""
  echo "[pre] Restoring repos from snapshot: $SNAPSHOT_FILE"
  "$SCRIPT_DIR/snapshot-restore.sh" "$SNAPSHOT_FILE"
  echo ""
else
  # Normal mode: save snapshot before deploy
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  SNAPSHOT_FILE="$SNAPSHOT_DIR/deploy-${TIMESTAMP}.json"
  echo ""
  echo "[pre] Saving pre-deploy snapshot → $SNAPSHOT_FILE"
  SNAPSHOT_DESC="pre-deploy $TIMESTAMP" "$SCRIPT_DIR/snapshot-save.sh" > "$SNAPSHOT_FILE"
  # Also update the convenience symlink
  ln -sf "$SNAPSHOT_FILE" "$SNAPSHOT_DIR/latest.json"
  echo "      Saved. To redeploy this state later:"
  echo "      ./scripts/deploy-push.sh $SNAPSHOT_FILE"
  echo ""
fi

# 1. Rsync project to server
echo ""
if [[ $DRY_RUN -eq 1 ]]; then
  echo "[1/3] Syncing files to ${REMOTE_HOST}... (dry-run, rsync --dry-run)"
  rsync -avz --dry-run --delete \
      --exclude='.git/' \
      --exclude='.claude/' \
      --exclude='.claude-marketplace/' \
      --exclude='.idea/' \
      --exclude='.github/' \
      --exclude='.env' \
      --exclude='.env.production' \
      --exclude='.DS_Store' \
      --exclude='node_modules/' \
      --exclude='services/validation-service/node_modules/' \
      --exclude='apps/web/dist/' \
      --exclude='services/php-api/var/' \
      --exclude='services/php-api/vendor/' \
      --exclude='apps/qa-api/' \
      --exclude='apps/qa-tracker/' \
      --exclude='apps/web/cypress/' \
      --exclude='apps/web/playwright/' \
      --exclude='apps/web/playwright-report/' \
      --exclude='apps/web/test-results/' \
      --exclude='apps/web/.scannerwork/' \
      --exclude='apps/web/scripts/' \
      --exclude='services/php-api/tests/' \
      --exclude='backups/' \
      --exclude='reference/' \
      --exclude='docs/' \
      --exclude='snapshots/' \
      --exclude='docker-compose.sonarqube.yml' \
      --exclude='CLAUDE.md' \
      --exclude='CHANGELOG.md' \
      --exclude='README.md' \
      --exclude='.gitignore' \
      --exclude='.gitmodules' \
      --exclude='.env.example' \
      --exclude='.env.local' \
      --exclude='compose.override.yaml' \
      ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
else
  echo "[1/3] Syncing files to ${REMOTE_HOST}..."
  rsync -avz --delete \
      --exclude='.git/' \
      --exclude='.claude/' \
      --exclude='.claude-marketplace/' \
      --exclude='.idea/' \
      --exclude='.github/' \
      --exclude='.env' \
      --exclude='.env.production' \
      --exclude='.DS_Store' \
      --exclude='node_modules/' \
      --exclude='services/validation-service/node_modules/' \
      --exclude='apps/web/dist/' \
      --exclude='services/php-api/var/' \
      --exclude='services/php-api/vendor/' \
      --exclude='apps/qa-api/' \
      --exclude='apps/qa-tracker/' \
      --exclude='apps/web/cypress/' \
      --exclude='apps/web/playwright/' \
      --exclude='apps/web/playwright-report/' \
      --exclude='apps/web/test-results/' \
      --exclude='apps/web/.scannerwork/' \
      --exclude='apps/web/scripts/' \
      --exclude='services/php-api/tests/' \
      --exclude='backups/' \
      --exclude='reference/' \
      --exclude='docs/' \
      --exclude='snapshots/' \
      --exclude='docker-compose.sonarqube.yml' \
      --exclude='CLAUDE.md' \
      --exclude='CHANGELOG.md' \
      --exclude='README.md' \
      --exclude='.gitignore' \
      --exclude='.gitmodules' \
      --exclude='.env.example' \
      --exclude='.env.local' \
      --exclude='compose.override.yaml' \
      ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
fi

# 2. Upload deploy snapshot to server
echo ""
echo "[2/3] Uploading deploy snapshot to server..."
SNAPSHOT_DESC="deployed $(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SCRIPT_DIR/snapshot-save.sh" > /tmp/deploy-snapshot.json
if [[ $DRY_RUN -eq 1 ]]; then
  echo "      (dry-run) Would upload:"
  cat /tmp/deploy-snapshot.json
else
  scp /tmp/deploy-snapshot.json "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/deploy-snapshot.json"
  echo "      → ${REMOTE_HOST}:${REMOTE_DIR}/deploy-snapshot.json"
fi
rm -f /tmp/deploy-snapshot.json

# 3. Run server-side deploy
echo ""
if [[ $DRY_RUN -eq 1 ]]; then
  echo "[3/3] Would run: ssh ${REMOTE_HOST} 'cd ${REMOTE_DIR} && ./scripts/deploy-server.sh'"
  echo ""
  echo "Dry run complete. No changes were made on the server."
else
  echo "[3/3] Running server deploy..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && ./scripts/deploy-server.sh"
fi
