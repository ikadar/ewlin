# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.0.8] - 2025-12-12

### Changed
- **BREAKING**: Converted from monorepo to host application with git submodules
- Directory structure changes:
  - `services/api` → `services/php-api` (submodule)
  - `services/node/packages/types` → `packages/types` (submodule)
  - `services/node/packages/validator` → `packages/validator` (submodule)
- Removed `services/node` directory (packages moved to root `packages/`)

### Added
- Git submodules for independent package development:
  - `ewlin-php-api` - PHP/Symfony backend
  - `ewlin-types` - Shared TypeScript types (@flux/types)
  - `ewlin-validator` - Schedule validation (@flux/schedule-validator)
- Root `package.json` for pnpm workspace orchestration
- Root `tsconfig.base.json` for shared TypeScript configuration
- Root `pnpm-workspace.yaml` for package management
- Release documentation for v0.0.8

### Updated
- CI/CD workflows to checkout submodules recursively
- Path references throughout the project

### Migration Guide
```bash
# Fresh clone (requires --recursive flag)
git clone --recursive git@github.com:ikadar/ewlin.git

# Existing clone
git pull
git submodule update --init --recursive
```

---

## [0.0.7] - 2025-12-11

### Fixed
- CI workflow: build packages before running tests (inter-package dependencies)
- ESLint errors in frontend and validator packages:
  - Added explicit return types to React components
  - Replaced non-null assertions with proper guard clauses
  - Fixed template literal type expressions
  - Fixed unused variable warnings with underscore prefix convention
  - Fixed redundant type union in `ProofApprovalGate`
- ESLint configuration: ignore config files (vite.config.ts, eslint.config.js, etc.)
- PHP lint job: skip Composer auto-scripts in CI environment

### Changed
- Merged `v0.0.1-development-environment` branch into `main`
- All releases now properly tracked on `main` branch

---

## [0.0.6] - 2025-12-11

### Added
- GitHub Actions CI/CD pipeline foundation
- CI workflow (`.github/workflows/ci.yml`):
  - `lint-node` - ESLint for all Node.js packages
  - `typecheck-node` - TypeScript compilation check
  - `test-node` - Vitest unit tests
  - `build-frontend` - Vite production build with artifact upload
  - `lint-php` - PHPStan analysis (optional)
  - `ci-success` - Summary job for branch protection
- Docker build workflow (`.github/workflows/docker.yml`):
  - `build-node` - Node.js service image
  - `build-php` - PHP-FPM service image
  - GitHub Container Registry (ghcr.io) integration
  - Docker layer caching with GitHub Actions cache
- pnpm and Composer dependency caching
- Concurrency control for workflow runs

---

## [0.0.5] - 2025-12-11

### Added
- `@flux/web` frontend application in `services/node/apps/web/`
- Vite 7 + React 19 + TypeScript 5.9 project setup
- Tailwind CSS 4 with custom Flux theme colors
- Redux Toolkit with RTK Query for state management:
  - `store.ts` - configured Redux store
  - `hooks.ts` - typed useAppDispatch and useAppSelector
  - `uiSlice.ts` - UI state (panel visibility, job selection)
  - `api.ts` - RTK Query base API service
- Feature-based folder structure (features/, components/, services/, types/)
- Basic 3-panel layout scaffold (Jobs, Schedule Grid, Details)
- ESLint 9 with React and TypeScript rules
- Prettier code formatting

---

## [0.0.4] - 2025-12-11

### Added
- `@flux/schedule-validator` package - isomorphic schedule validation
- Time utility functions:
  - `rangesOverlap` - time range overlap detection
  - `calculateInternalEndTime` - internal task duration calculation
  - `calculateOutsourcedEndTime` - outsourced task duration calculation
  - `getMaxConcurrent` - concurrent range counting
- Six conflict validators:
  - `validateStationConflict` - station double-booking detection
  - `validateGroupCapacity` - MaxConcurrent limit enforcement
  - `validatePrecedence` - task sequence order with bypass support
  - `validateApprovalGates` - BAT/Plates status checking
  - `validateAvailability` - operating hours validation
  - `validateDeadline` - workshop exit date validation
- Main validation functions:
  - `validateAssignment` - full validation with all conflicts
  - `validateAssignments` - batch validation
  - `isValidAssignment` - quick boolean check
- Comprehensive test suite (29 tests)

---

## [0.0.3] - 2025-12-11

### Added
- pnpm workspace in `services/node/` for TypeScript packages
- Node.js 22 LTS Docker container with pnpm
- TypeScript 5.x base configuration
- ESLint 9 with flat config and TypeScript support
- Prettier code formatting
- Vitest testing framework
- `@flux/types` package with domain type definitions:
  - Station, StationCategory, StationGroup, OutsourcedProvider
  - Job, JobStatus, PaperPurchaseStatus, ApprovalGates
  - Task (Internal/Outsourced), TaskStatus, Duration
  - TaskAssignment, ScheduleSnapshot, ScheduleConflict, ValidationResult

### Changed
- Updated `docker-compose.yml` with Node.js service

### Documentation
- Updated `docker/README.md` with Node.js service documentation

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
[Unreleased]: https://github.com/org/flux-scheduler/compare/v0.0.7...HEAD
[0.0.7]: https://github.com/org/flux-scheduler/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/org/flux-scheduler/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/org/flux-scheduler/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/org/flux-scheduler/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/org/flux-scheduler/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/org/flux-scheduler/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/org/flux-scheduler/releases/tag/v0.0.1
