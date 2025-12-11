# Docker Development Environment

This directory contains Docker configuration for local development of the Flux Print Shop Scheduling System.

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. (Optional) Edit .env with your preferred values

# 3. Start containers
docker compose up -d

# 4. Verify containers are healthy
docker compose ps
```

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `mariadb` | mariadb:10.11 | 3306 | Primary database |
| `redis` | redis:7-alpine | 6379 | Cache and session storage |

## Container Details

### MariaDB

- **Image:** `mariadb:10.11`
- **Container name:** `flux-mariadb`
- **Port:** 3306 (configurable via `MARIADB_PORT`)
- **Data persistence:** Named volume `flux-mariadb-data`
- **Health check:** Verifies database is accepting connections

**Connect via CLI:**
```bash
docker compose exec mariadb mysql -u${MARIADB_USER} -p${MARIADB_PASSWORD} ${MARIADB_DATABASE}
```

**Connect from host:**
```bash
mysql -h 127.0.0.1 -P 3306 -u flux_user -p flux_scheduler
```

### Redis

- **Image:** `redis:7-alpine`
- **Container name:** `flux-redis`
- **Port:** 6379 (configurable via `REDIS_PORT`)
- **Configuration:** In-memory only (no persistence for dev)
- **Memory limit:** 128MB with LRU eviction
- **Health check:** Redis `PING` command

**Connect via CLI:**
```bash
docker compose exec redis redis-cli
```

**Test connection:**
```bash
docker compose exec redis redis-cli ping
# Expected: PONG
```

## Common Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f mariadb

# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v

# Restart a service
docker compose restart mariadb

# Check service status
docker compose ps

# Execute command in container
docker compose exec mariadb mysql -u root -p
```

## Troubleshooting

### Container won't start

1. Check if ports are already in use:
   ```bash
   lsof -i :3306
   lsof -i :6379
   ```

2. Check container logs:
   ```bash
   docker compose logs mariadb
   docker compose logs redis
   ```

### MariaDB connection refused

1. Wait for health check to pass:
   ```bash
   docker compose ps  # Should show "healthy"
   ```

2. Verify credentials in `.env` match what you're using

3. Check if container is running:
   ```bash
   docker compose ps mariadb
   ```

### Data not persisting

1. Ensure you're using `docker compose down` NOT `docker compose down -v`
2. Check volume exists:
   ```bash
   docker volume ls | grep flux
   ```

### Reset everything

To completely reset the development environment:

```bash
# Stop containers and remove volumes
docker compose down -v

# Remove network (if needed)
docker network rm flux-network

# Start fresh
docker compose up -d
```

## Directory Structure

```
docker/
├── README.md              # This file
└── mariadb/
    └── init/
        └── 01-init.sql    # Database initialization script
```

## Environment Variables

See `.env.example` for all available configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `MARIADB_ROOT_PASSWORD` | — | Root password (required) |
| `MARIADB_DATABASE` | `flux_scheduler` | Database name |
| `MARIADB_USER` | `flux_user` | Application user |
| `MARIADB_PASSWORD` | — | Application user password |
| `MARIADB_PORT` | `3306` | Host port mapping |
| `REDIS_PORT` | `6379` | Host port mapping |

## Network

All services are connected via the `flux-network` bridge network. Services can communicate using their service names:

- MariaDB: `mariadb:3306`
- Redis: `redis:6379`

From PHP/Node.js containers (future):
```php
$dsn = 'mysql:host=mariadb;port=3306;dbname=flux_scheduler';
```

```javascript
const redis = new Redis({ host: 'redis', port: 6379 });
```
