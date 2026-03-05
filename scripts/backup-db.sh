#!/bin/bash
# Flux Scheduler - Database Backup Script
# Usage: ./scripts/backup-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Load environment
source "$PROJECT_DIR/.env.production"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T mariadb \
    mysqldump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" \
    | gzip > "$BACKUP_DIR/flux_${DATE}.sql.gz"

echo "Backup saved to: $BACKUP_DIR/flux_${DATE}.sql.gz"

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/flux_*.sql.gz | tail -n +8 | xargs -r rm

echo "Done!"
