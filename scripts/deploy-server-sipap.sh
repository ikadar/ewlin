#!/bin/bash
# Flux Scheduler - Server Deploy for SIPAP instance (run on the production server)
# Builds frontend, starts containers, installs dependencies, runs migrations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

INSTANCE="sipap"
DC="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod-sipap.yml"

echo "=========================================="
echo "Flux Scheduler - Server Deploy [SIPAP]"
echo "=========================================="

if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production not found!"
    exit 1
fi

# 1. Build frontend
echo ""
echo "[1/6] Building frontend (Docker multi-stage)..."
docker build -f docker/frontend/Dockerfile -t ${INSTANCE}-frontend-build .
docker rm -f ${INSTANCE}-frontend-tmp 2>/dev/null || true
docker create --name ${INSTANCE}-frontend-tmp ${INSTANCE}-frontend-build
mkdir -p apps/web/dist
docker cp ${INSTANCE}-frontend-tmp:/app/apps/web/dist/. apps/web/dist/
docker rm ${INSTANCE}-frontend-tmp

# 2. Build Docker images
echo ""
echo "[2/6] Building Docker images..."
$DC build

# 3. Stop existing containers
echo ""
echo "[3/6] Stopping existing containers..."
$DC down

# 4. Start containers
echo ""
echo "[4/6] Starting containers (waiting for healthy status)..."
$DC up -d --wait

# 5. Install dependencies + migrations + cache
echo ""
echo "[5/6] Installing dependencies, running migrations, warming cache..."
$DC exec -T php composer install --no-dev --optimize-autoloader
$DC exec -T php php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
$DC exec -T php php bin/console cache:clear --env=prod --no-warmup
$DC exec -T php php bin/console cache:warmup --env=prod

# 6. Reload Apache
echo ""
echo "[6/6] Reloading Apache..."
sudo systemctl reload apache2

echo ""
echo "=========================================="
echo "SIPAP deployment complete!"
echo "=========================================="
echo ""
echo "Check status: $DC ps"
echo "Check health: curl http://localhost:9002/api/v1/schedule/snapshot"
