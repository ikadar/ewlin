# Flux Print Shop Scheduling System

A scheduling system for print shop production management, enabling efficient task assignment, conflict detection, and deadline tracking.

## Project Status

**Current Version:** v0.0.1 (Development Environment)

See [Release Roadmap](docs/roadmap/release-roadmap.md) for planned features.

## Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose 2.20+

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd flux-scheduler

# 2. Copy environment template
cp .env.example .env

# 3. Start development environment
docker compose up -d

# 4. Verify services are running
docker compose ps
```

All services should show as "healthy":

```
NAME           STATUS                   PORTS
flux-mariadb   running (healthy)        0.0.0.0:3306->3306/tcp
flux-redis     running (healthy)        0.0.0.0:6379->6379/tcp
```

### Verify Connectivity

```bash
# Test MariaDB
docker compose exec mariadb mysql -uflux_user -pflux_password_change_me -e "SELECT 1"

# Test Redis
docker compose exec redis redis-cli ping
# Expected: PONG
```

## Architecture

| Component | Technology | Status |
|-----------|------------|--------|
| Database | MariaDB 10.11+ | ✅ Ready |
| Cache | Redis 7+ | ✅ Ready |
| Backend (PHP) | Symfony 7 | 🔜 Planned |
| Backend (Node.js) | Express/Fastify | 🔜 Planned |
| Frontend | React 19 + TypeScript | 🔜 Planned |

## Project Structure

```
flux-scheduler/
├── apps/
│   └── web/                 # React frontend (future)
├── docker/
│   ├── README.md            # Docker documentation
│   └── mariadb/
│       └── init/            # Database init scripts
├── docs/
│   ├── architecture/        # ADRs, service boundaries
│   ├── domain-model/        # Domain vocabulary, rules
│   ├── releases/            # Release planning documents
│   ├── requirements/        # User stories, acceptance criteria
│   ├── review/              # Documentation reviews
│   └── roadmap/             # Release roadmap
├── packages/                # Shared packages (future)
├── services/                # Backend services (future)
├── docker-compose.yml       # Development environment
├── .env.example             # Environment template
└── CHANGELOG.md             # Version history
```

## Documentation

- [Release Roadmap](docs/roadmap/release-roadmap.md) - Development plan
- [Domain Model](docs/domain-model/domain-model.md) - Core domain concepts
- [Architecture Decisions](docs/architecture/decision-records.md) - ADRs
- [Git Release Strategy](docs/architecture/git-release-strategy.md) - Versioning and branching
- [Docker Setup](docker/README.md) - Container configuration

## Development

### Common Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Reset database (WARNING: deletes data)
docker compose down -v && docker compose up -d
```

### Ports

| Service | Port |
|---------|------|
| MariaDB | 3306 |
| Redis | 6379 |

## Contributing

See [Git Release Strategy](docs/architecture/git-release-strategy.md) for branching and versioning conventions.

## License

Proprietary - All rights reserved.
