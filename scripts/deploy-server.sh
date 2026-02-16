#!/bin/bash
# Flux Scheduler - Server Deploy (run on the production server)
# Builds frontend, starts containers, installs dependencies, runs migrations

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
echo "[1/7] Building frontend (Docker multi-stage)..."
docker build -f docker/frontend/Dockerfile -t flux-frontend-build .
docker rm -f flux-frontend-tmp 2>/dev/null || true
docker create --name flux-frontend-tmp flux-frontend-build
docker cp flux-frontend-tmp:/app/apps/web/dist/. apps/web/dist/
docker rm flux-frontend-tmp

# 2. Build Docker images (php, validation-service)
echo ""
echo "[2/7] Building Docker images..."
$DC build

# 3. Stop existing containers
echo ""
echo "[3/7] Stopping existing containers..."
$DC down

# 4. Start containers
echo ""
echo "[4/7] Starting containers..."
$DC up -d

# 5. Fix file permissions (rsync UID may differ from container's appuser:1000)
echo ""
echo "[5/7] Fixing permissions..."
$DC exec -T --user root php chown -R appuser:appuser /var/www/html/var /var/www/html/vendor 2>/dev/null || true

# 6. Install PHP dependencies + run migrations + cache warmup
echo ""
echo "[6/7] Installing dependencies, running migrations, warming cache..."
sleep 5  # Wait for DB to be ready
$DC exec -T php composer install --no-dev --optimize-autoloader
$DC exec -T php php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
$DC exec -T php php bin/console cache:clear --env=prod --no-warmup
$DC exec -T php php bin/console cache:warmup --env=prod

# 7. Reload Apache
echo ""
echo "[7/7] Reloading Apache..."
sudo systemctl reload apache2

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Check status: $DC ps"
echo "Check health: curl http://localhost/api/v1/schedule/snapshot"
