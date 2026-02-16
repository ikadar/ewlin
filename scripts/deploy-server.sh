#!/bin/bash
# Flux Scheduler - Server Deploy (run on the production server)
# Builds frontend, starts containers, installs dependencies, runs migrations
#
# Prerequisites:
#   - User must be in docker group (run docker without sudo)
#   - User must have sudo access for: systemctl reload apache2

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Docker compose shorthand (--env-file needed for all commands to resolve variables)
DC="docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml"

echo "=========================================="
echo "Flux Scheduler - Server Deploy"
echo "=========================================="

# Check for .env.production
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production not found!"
    echo "Copy .env.production.example to .env.production and configure it."
    exit 1
fi

# 1. Build frontend in Docker (no Node.js needed on host)
echo ""
echo "[1/6] Building frontend (Docker multi-stage)..."
docker build -f docker/frontend/Dockerfile -t flux-frontend-build .
docker rm -f flux-frontend-tmp 2>/dev/null || true
docker create --name flux-frontend-tmp flux-frontend-build
mkdir -p apps/web/dist
docker cp flux-frontend-tmp:/app/apps/web/dist/. apps/web/dist/
docker rm flux-frontend-tmp

# 2. Build Docker images (php, validation-service)
echo ""
echo "[2/6] Building Docker images..."
$DC build

# 3. Stop existing containers
echo ""
echo "[3/6] Stopping existing containers..."
$DC down

# 4. Start containers and wait for health checks
echo ""
echo "[4/6] Starting containers (waiting for healthy status)..."
$DC up -d --wait

# 5. Install PHP dependencies + run migrations + cache warmup
# Note: PHP container runs as user 1001 (matching host ordo user) via docker-compose.prod.yml
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
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Check status: $DC ps"
echo "Check health: curl http://localhost/api/v1/schedule/snapshot"
