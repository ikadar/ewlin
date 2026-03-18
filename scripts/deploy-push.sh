#!/bin/bash
# Flux Scheduler - Deploy Push (run from local machine)
# Syncs code to server via rsync, then runs server-side deploy
#
# Configuration via environment variables:
#   DEPLOY_USER - SSH user (default: user)
#   DEPLOY_HOST - SSH host (default: server)

set -e

# Configuration
REMOTE_USER="${DEPLOY_USER:-ordo}"
REMOTE_HOST="${DEPLOY_HOST:-ordo.replic-os.com}"
REMOTE_DIR="/home/ordo/ordo-replic-os"

echo "=========================================="
echo "Flux Scheduler - Deploy Push"
echo "=========================================="

# 1. Rsync project to server
echo ""
echo "[1/2] Syncing files to ${REMOTE_HOST}..."
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

# 2. Run server-side deploy
echo ""
echo "[2/2] Running server deploy..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && ./scripts/deploy-server.sh"
