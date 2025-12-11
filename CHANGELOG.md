# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Project documentation structure
- Domain model definitions (Station, Job, Task, Assignment)
- Architecture decision records (ADR-001 through ADR-012)
- Release roadmap with milestones M0-M4
- API interface drafts
- Business rules and workflow definitions
- Task DSL specification
- Git release strategy

### Documentation
- Domain vocabulary and business rules
- Sequence diagrams for key flows
- Interface contracts
- Service boundaries
- Scheduling UI design specification

---

## [0.0.2] - 2025-12-11

### Added
- Symfony 7 project in `services/api/`
- PHP 8.3 FPM Docker container with extensions (pdo_mysql, redis, intl, opcache, mbstring, zip)
- Nginx web server container with Symfony configuration
- Doctrine ORM 3.x configured for MariaDB
- Health check endpoints:
  - `GET /health` - Basic health check
  - `GET /health/details` - Detailed service status (PHP, database)
- PHP-FPM health check integration

### Changed
- Updated `docker-compose.yml` with PHP and Nginx services
- Updated `.env.example` with Symfony configuration variables

### Documentation
- Updated `docker/README.md` with PHP and Nginx service documentation

---

## [0.0.1] - 2025-12-11

### Added
- Docker Compose configuration for local development
- MariaDB 10.11+ container with health checks and persistent volume
- Redis 7+ container with health checks and LRU eviction
- Shared Docker network (`flux-network`) for service communication
- Environment variable templates (`.env.example`)
- Docker setup documentation (`docker/README.md`)
- Project README with quick start guide

---

<!-- Release links will be added as releases are created -->
[Unreleased]: https://github.com/org/flux-scheduler/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/org/flux-scheduler/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/org/flux-scheduler/releases/tag/v0.0.1
