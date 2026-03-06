# Flux Print Shop Scheduling System — Install Guide

Complete setup guide for the development environment. Intended for automated execution by Claude Code or similar AI assistants.

## Prerequisites

| Tool | Minimum version | Check command |
|------|----------------|---------------|
| Docker Desktop | 28.x | `docker --version` |
| Docker Compose | v2.x | `docker compose version` |
| Node.js | 20.x (recommended: 22+) | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Git | 2.x | `git --version` |

## Architecture Overview

```
ewlin/                          # Monorepo root (pnpm workspace)
├── services/
│   ├── php-api/                # Symfony 7 REST API (git submodule → ewlin-php-api)
│   └── validation-service/     # Node.js validation HTTP service (git submodule → ewlin-validation-service)
├── packages/
│   ├── types/                  # @flux/types — shared TypeScript types (git submodule → ewlin-types)
│   └── validator/              # @flux/schedule-validator — validation logic (git submodule → ewlin-validator)
├── apps/
│   └── web/                    # React frontend (Vite + Tailwind v4)
├── docker/
│   ├── php/Dockerfile          # PHP 8.3 FPM Alpine
│   ├── nginx/default.conf      # Nginx reverse proxy
│   └── mariadb/init/01-init.sql # DB init script
└── docker-compose.yml          # All backend services
```

### Docker services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| php | flux-php | 9000 (internal) | PHP 8.3 FPM — Symfony API |
| nginx | flux-nginx | **8080** → 80 | Web server, proxies to PHP-FPM |
| mariadb | flux-mariadb | **3306** | MariaDB 10.11 database |
| redis | flux-redis | **6379** | Cache (Symfony messenger) |
| validation-service | flux-validation-service | **3001** | Node.js schedule validator |

### Databases

| Database | Purpose |
|----------|---------|
| `flux_scheduler` | Main development database |
| `flux_scheduler_test` | PHPUnit integration test database (auto-created by init script) |

The test database exists because Symfony's Doctrine config (`config/packages/doctrine.yaml`) appends `_test` suffix in the `test` environment via `dbname_suffix`.

## Step 1: Clone the repository

```bash
git clone --recurse-submodules git@github.com:ikadar/ewlin.git
cd ewlin
```

If already cloned without submodules:

```bash
git submodule update --init --recursive
```

### Git submodules

| Path | Remote repo |
|------|-------------|
| `services/php-api` | `git@github.com:ikadar/ewlin-php-api.git` |
| `packages/types` | `git@github.com:ikadar/ewlin-types.git` |
| `packages/validator` | `git@github.com:ikadar/ewlin-validator.git` |
| `services/validation-service` | `git@github.com:ikadar/ewlin-validation-service.git` |

## Step 2: Environment file

```bash
cp .env.example .env
```

The `.env` file at the monorepo root configures Docker services:

```env
MARIADB_ROOT_PASSWORD=flux_root_secret_change_me
MARIADB_DATABASE=flux_scheduler
MARIADB_USER=flux_user
MARIADB_PASSWORD=flux_password_change_me
MARIADB_PORT=3306
REDIS_PORT=6379
APP_ENV=development
```

**IMPORTANT:** The `APP_ENV` is `development` (not `dev`). This is a non-standard Symfony environment name. The PHP container receives this value and all bundle registrations must include `'development' => true`.

## Step 3: Start Docker services

```bash
docker compose up -d --build
```

Wait for all services to be healthy:

```bash
docker compose ps
```

Expected: all 6 services UP (mariadb, php, nginx, redis, validation-service, node).

The MariaDB init script (`docker/mariadb/init/01-init.sql`) runs automatically on first start and:
- Grants `flux_user` access to `flux_scheduler`
- Creates `flux_scheduler_test` database
- Grants `flux_user` access to `flux_scheduler_test`

**NOTE:** The init script only runs when the MariaDB data volume is empty (first start). If the volume already exists, you must create the test database manually:

```bash
docker compose exec -T mariadb mariadb -u root -pflux_root_secret_change_me -e "
  CREATE DATABASE IF NOT EXISTS flux_scheduler_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`flux_scheduler_test\`.* TO 'flux_user'@'%';
  FLUSH PRIVILEGES;
"
```

## Step 4: PHP API setup

### 4a. Install Composer dependencies

```bash
docker compose exec -T php composer install
```

### 4b. Run database migrations

```bash
docker compose exec -T php php bin/console doctrine:migrations:migrate --no-interaction
```

This applies all 39 migrations to the `flux_scheduler` database.

### 4c. Set up the test database schema

The test database uses `doctrine:schema:create` (NOT migrations), because integration tests expect a clean schema:

```bash
docker compose exec -T php php bin/console doctrine:schema:create --env=test
```

**IMPORTANT:** If the test DB schema already exists and needs updating, use:

```bash
docker compose exec -T php php bin/console doctrine:schema:drop --force --env=test
docker compose exec -T php php bin/console doctrine:schema:create --env=test
```

### 4d. Load fixture data

```bash
docker compose exec -T php php bin/console doctrine:fixtures:load --no-interaction
```

This loads all DataFixtures into `flux_scheduler`:
- 10 clients
- 9 station categories
- 10 station groups
- 14 stations
- 1 outsourced provider
- 13 JCF templates
- 9 jobs (with 25 elements and 56 tasks)
- 1 empty schedule

To reload fixtures at any time (purges all data first):

```bash
docker compose exec -T php php bin/console doctrine:fixtures:load --no-interaction
```

### 4e. Verify PHP API

```bash
# Health check
curl -s http://localhost:8080/health

# Swagger UI (open in browser)
# http://localhost:8080/api/doc

# API test
curl -s http://localhost:8080/api/v1/stations | head -c 200
```

## Step 5: Node.js packages setup

### 5a. Install all pnpm dependencies

From the monorepo root:

```bash
pnpm install
```

This installs dependencies for all workspace packages: `packages/types`, `packages/validator`, `services/validation-service`, `apps/web`, and any others in the pnpm workspace.

### 5b. Build TypeScript packages (dependency order)

```bash
pnpm --filter @flux/types build
pnpm --filter @flux/schedule-validator build
```

These must be built before the web app or validation-service can use them. The build order matters: `types` → `validator` (validator depends on types).

**NOTE:** The `validation-service` is built inside its Docker container (multi-stage Dockerfile), so you do not need to build it locally. But the workspace packages (`types`, `validator`) must be built locally because `apps/web` links to them directly.

## Step 6: React frontend setup

### 6a. Environment files

The web app has multiple env files:

| File | Purpose |
|------|---------|
| `apps/web/.env.development` | Default dev config |
| `apps/web/.env.development.local` | Local overrides (gitignored) |
| `apps/web/.env.local` | General local overrides (gitignored) |
| `apps/web/.env.production` | Production config |

For development with the real API backend:

```bash
cat > apps/web/.env.development.local << 'EOF'
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8080/api/v1
EOF
```

For development with mock data (no backend needed):

```bash
cat > apps/web/.env.development.local << 'EOF'
VITE_USE_MOCK=true
EOF
```

### 6b. Start the dev server

```bash
cd apps/web
pnpm dev
```

The Vite dev server starts at **http://localhost:5173**.

CORS is pre-configured in `docker/nginx/default.conf` to allow requests from `http://localhost:5173`.

### Alternative dev commands

```bash
pnpm dev:mock   # Force mock data mode (VITE_USE_MOCK=true)
pnpm dev:api    # Force real API mode (VITE_USE_MOCK=false)
```

## Verification

### PHP API checks

```bash
# PHPStan static analysis (level 8)
docker compose exec -T php vendor/bin/phpstan analyse --level=8 --memory-limit=512M

# Unit tests (1000 tests, no DB needed)
docker compose exec -T php vendor/bin/phpunit --testsuite=Unit

# Integration tests (309 tests, needs flux_scheduler_test DB)
docker compose exec -T php vendor/bin/phpunit --testsuite=Integration
```

### Frontend checks

```bash
cd apps/web

# TypeScript check
pnpm tsc -b --noEmit

# ESLint
pnpm lint

# Vitest unit tests
pnpm test

# Playwright E2E tests (ONLY with explicit user permission)
# npx playwright test
```

### Validation service check

```bash
curl -s http://localhost:3001/health
```

## Troubleshooting

### "Access denied for user 'flux_user' to database 'flux_scheduler_test'"

The MariaDB init script didn't run (volume already existed). Fix:

```bash
docker compose exec -T mariadb mariadb -u root -pflux_root_secret_change_me -e "
  CREATE DATABASE IF NOT EXISTS flux_scheduler_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON \`flux_scheduler_test\`.* TO 'flux_user'@'%';
  FLUSH PRIVILEGES;
"
```

### "doctrine:fixtures:load" command not found

DoctrineFixturesBundle is not installed or not registered for the current environment:

```bash
# Install
docker compose exec -T php composer require --dev doctrine/doctrine-fixtures-bundle

# Verify bundles.php includes 'development' => true:
# Doctrine\Bundle\FixturesBundle\DoctrineFixturesBundle::class => ['dev' => true, 'development' => true, 'test' => true],
```

### Integration test schema errors (abbreviation, is_outsourced_provider_group)

The test DB schema is out of date. Recreate it:

```bash
docker compose exec -T php php bin/console doctrine:schema:drop --force --env=test
docker compose exec -T php php bin/console doctrine:schema:create --env=test
```

### PHPStan memory error

Add `--memory-limit=512M`:

```bash
docker compose exec -T php vendor/bin/phpstan analyse --level=8 --memory-limit=512M
```

### Validation service not starting

The validation-service Docker image requires workspace packages to be available at build time. Rebuild:

```bash
docker compose up -d --build validation-service
```

### Fresh start (nuclear option)

Destroys all data and rebuilds everything:

```bash
docker compose down -v          # Remove containers AND volumes
docker compose up -d --build    # Rebuild and start
docker compose exec -T php composer install
docker compose exec -T php php bin/console doctrine:migrations:migrate --no-interaction
docker compose exec -T php php bin/console doctrine:schema:create --env=test
docker compose exec -T php php bin/console doctrine:fixtures:load --no-interaction
```

## Quick reference

| What | Command |
|------|---------|
| Start all services | `docker compose up -d` |
| Stop all services | `docker compose down` |
| View logs | `docker compose logs -f [service]` |
| PHP shell | `docker compose exec php bash` |
| MariaDB shell | `docker compose exec mariadb mariadb -u flux_user -pflux_password_change_me flux_scheduler` |
| Load fixtures | `docker compose exec -T php php bin/console doctrine:fixtures:load --no-interaction` |
| Run migrations | `docker compose exec -T php php bin/console doctrine:migrations:migrate --no-interaction` |
| PHPStan | `docker compose exec -T php vendor/bin/phpstan analyse --level=8 --memory-limit=512M` |
| PHP unit tests | `docker compose exec -T php vendor/bin/phpunit --testsuite=Unit` |
| PHP integration tests | `docker compose exec -T php vendor/bin/phpunit --testsuite=Integration` |
| Frontend dev server | `cd apps/web && pnpm dev` |
| Frontend tests | `cd apps/web && pnpm test` |
| Build TS packages | `pnpm --filter @flux/types build && pnpm --filter @flux/schedule-validator build` |
