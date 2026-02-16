#!/bin/bash
# Flux Scheduler - Deploy Push (run from local machine)
# Syncs code to server via rsync, then runs server-side deploy
#
# Configuration via environment variables:
#   DEPLOY_USER - SSH user (default: user)
#   DEPLOY_HOST - SSH host (default: server)

set -e

# Configuration
REMOTE_USER="${DEPLOY_USER:-user}"
REMOTE_HOST="${DEPLOY_HOST:-server}"
REMOTE_DIR="/home/ordo/ordo-replic-os"

echo "=========================================="
echo "Flux Scheduler - Deploy Push"
echo "=========================================="

# 1. Rsync project to server
echo ""
echo "[1/2] Syncing files to ${REMOTE_HOST}..."
rsync -avz --delete \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='services/validation-service/node_modules/' \
    --exclude='apps/web/dist/' \
    --exclude='.env.production' \
    --exclude='backups/' \
    ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

# 2. Run server-side deploy
echo ""
echo "[2/2] Running server deploy..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && ./scripts/deploy-server.sh"
