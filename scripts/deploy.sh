#!/bin/bash
# Flux Scheduler - Production Deployment Script
# Usage: ./scripts/deploy.sh

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Flux Scheduler - Production Deployment"
echo "=========================================="

# Check for .env.production
if [ ! -f ".env.production" ]; then
    echo "ERROR: .env.production not found!"
    echo "Copy .env.production.example to .env.production and configure it."
    exit 1
fi

# 1. Pull latest code
echo ""
echo "[1/6] Pulling latest code..."
git pull origin main
git submodule update --init --recursive

# 2. Build frontend
echo ""
echo "[2/6] Building frontend..."
cd apps/web
pnpm install --frozen-lockfile
pnpm build
cd "$PROJECT_DIR"

# 3. Pull/build Docker images
echo ""
echo "[3/6] Building Docker images..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# 4. Stop existing containers
echo ""
echo "[4/6] Stopping existing containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# 5. Start containers
echo ""
echo "[5/6] Starting containers..."
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.prod.yml up -d

# 6. Run database migrations
echo ""
echo "[6/6] Running database migrations..."
sleep 5  # Wait for DB to be ready
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T php \
    php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Check status: docker compose -f docker-compose.yml -f docker-compose.prod.yml ps"
echo "View logs:    docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
