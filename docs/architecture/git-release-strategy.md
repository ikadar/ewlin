# Git Release Strategy – Flux Print Shop Scheduling System

This document defines the **Git branching model**, **tagging conventions**, and **release workflow** for the Flux Print Shop Scheduling System.

---

## 1. Branching Model

We use a **simplified trunk-based development** model with short-lived feature branches.

### Branch Types

| Branch | Purpose | Naming | Lifetime |
|--------|---------|--------|----------|
| `main` | Production-ready code | — | Permanent |
| `feature/*` | New features | `feature/station-crud` | Days |
| `fix/*` | Bug fixes | `fix/validation-error` | Days |
| `release/*` | Release preparation | `release/v0.1.0` | Hours–Days |
| `hotfix/*` | Production hotfixes | `hotfix/v0.1.1` | Hours |

### Branch Flow

```
main ─────●─────────●─────────●─────────●───────→
          │         ↑         │         ↑
          │    merge│         │    merge│
          ▼         │         ▼         │
feature/a ●───●───●─┘  feature/b ●───●──┘
```

**Rules:**
- `main` is always deployable
- Feature branches are short-lived (< 1 week)
- All merges to `main` go through Pull Request
- Squash merge preferred for clean history
- Delete branches after merge

---

## 2. Version Numbering

We follow **Semantic Versioning 2.0** (semver.org) with milestone alignment:

```
v{MAJOR}.{MINOR}.{PATCH}[-{PRERELEASE}]

Examples:
  v0.0.1      - Milestone 0, release 1
  v0.1.0      - Milestone 1, first release
  v0.1.5      - Milestone 1, release 5
  v0.2.0-rc.1 - Milestone 2, release candidate 1
  v1.0.0      - First production release
```

### Version Mapping to Milestones

| Version Range | Milestone | Focus |
|---------------|-----------|-------|
| `v0.0.x` | M0 | Infrastructure & Foundation |
| `v0.1.x` | M1 | Core Domain MVP |
| `v0.2.x` | M2 | Scheduling Core |
| `v0.3.x` | M3 | Frontend Integration |
| `v0.4.x` | M4 | Production Readiness |
| `v1.0.0` | — | First Production Release |
| `v1.x.x` | Post-MVP | Ongoing development |

### Version Increment Rules

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking API change | MAJOR | v1.0.0 → v2.0.0 |
| New feature (backward compatible) | MINOR | v0.1.0 → v0.2.0 |
| Bug fix | PATCH | v0.1.0 → v0.1.1 |
| Milestone transition | MINOR | v0.0.x → v0.1.0 |

**Pre-1.0 Rule:** While in v0.x.x, MINOR increments may include breaking changes.

---

## 3. Tag Naming Conventions

### Release Tags

```
v{VERSION}

Examples:
  v0.0.1
  v0.1.0
  v0.2.5
  v1.0.0
```

### Pre-release Tags

```
v{VERSION}-{STAGE}.{NUMBER}

Stages:
  alpha  - Feature incomplete, unstable
  beta   - Feature complete, testing
  rc     - Release candidate, final testing

Examples:
  v0.2.0-alpha.1
  v0.2.0-beta.1
  v0.2.0-rc.1
  v0.2.0-rc.2
  v0.2.0          (final release)
```

### Milestone Tags (Optional)

For milestone completion markers:

```
milestone-{NUMBER}

Examples:
  milestone-0
  milestone-1
  milestone-2
```

---

## 4. Release Workflow

### Standard Release

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Create release branch (optional for significant releases)
git checkout -b release/v0.1.0

# 3. Update version in package files
# - package.json (frontend, shared packages)
# - composer.json (PHP services)
# Update CHANGELOG.md

# 4. Commit version bump
git add -A
git commit -m "chore: bump version to v0.1.0"

# 5. Create annotated tag
git tag -a v0.1.0 -m "Release v0.1.0: Core Domain MVP

Features:
- Station CRUD operations
- Job management with DSL
- Task assignment basics

See CHANGELOG.md for details."

# 6. Merge to main (if using release branch)
git checkout main
git merge --no-ff release/v0.1.0

# 7. Push with tags
git push origin main
git push origin v0.1.0

# 8. Delete release branch
git branch -d release/v0.1.0
```

### Quick Patch Release

```bash
# For small fixes, tag directly on main
git checkout main
git pull origin main

# Make fix, commit
git add -A
git commit -m "fix: correct validation error message"

# Tag
git tag -a v0.1.1 -m "Release v0.1.1: Fix validation error"

# Push
git push origin main --tags
```

### Hotfix Release

```bash
# 1. Create hotfix branch from the release tag
git checkout -b hotfix/v0.1.1 v0.1.0

# 2. Make the fix
git add -A
git commit -m "fix: critical validation bypass"

# 3. Tag the hotfix
git tag -a v0.1.1 -m "Hotfix v0.1.1: Critical validation fix"

# 4. Merge to main
git checkout main
git merge --no-ff hotfix/v0.1.1

# 5. Push
git push origin main
git push origin v0.1.1

# 6. Cleanup
git branch -d hotfix/v0.1.1
```

---

## 5. Tag Message Format

Use consistent, informative tag messages:

```
Release v{VERSION}: {SHORT_TITLE}

{DESCRIPTION}

Features:
- Feature 1
- Feature 2

Fixes:
- Fix 1
- Fix 2

Breaking Changes:
- Change 1 (if applicable)

See CHANGELOG.md for full details.
```

### Examples

**Feature Release:**
```
Release v0.1.0: Core Domain MVP

First milestone completion with core station and job management.

Features:
- Station CRUD with operating schedules
- Station categories with similarity criteria
- Station groups with capacity limits
- Job management with DSL task definition
- Basic validation rules

See CHANGELOG.md for full details.
```

**Patch Release:**
```
Release v0.1.1: Bug fixes

Fixes:
- Fix station availability calculation edge case
- Correct DSL parser error messages
```

**Pre-release:**
```
Pre-release v0.2.0-rc.1: Scheduling Core RC1

Release candidate for scheduling core functionality.

New in this RC:
- Assignment validation service
- Conflict detection (all 6 types)
- Business calendar integration

Known issues:
- Performance optimization pending
- UI polish incomplete
```

---

## 6. CHANGELOG Management

Maintain a `CHANGELOG.md` in the repository root following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New feature in progress

## [0.1.1] - 2025-01-15

### Fixed
- Station availability calculation edge case (#123)
- DSL parser error messages (#124)

## [0.1.0] - 2025-01-10

### Added
- Station CRUD operations
- Station categories with similarity criteria
- Station groups with capacity limits
- Job management with DSL task definition
- Basic validation rules

### Changed
- Updated API response format

## [0.0.6] - 2025-01-05

### Added
- CI/CD pipeline with GitHub Actions
- Docker image build automation

[Unreleased]: https://github.com/org/repo/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/org/repo/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/org/repo/compare/v0.0.6...v0.1.0
[0.0.6]: https://github.com/org/repo/releases/tag/v0.0.6
```

---

## 7. CI/CD Integration

### Automatic Tagging Triggers

Configure CI/CD to trigger on tag pushes:

```yaml
# GitHub Actions example
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build and test
        run: |
          npm ci
          npm run build
          npm test

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
          files: |
            dist/*.tar.gz
```

### Tag Protection Rules

Configure repository settings:

- **Protected tags pattern:** `v*`
- **Require signed tags:** Recommended for production
- **Restrict who can push:** Release managers only

---

## 8. Release Documents

Each release has a dedicated planning document in `docs/releases/`:

```
docs/releases/
├── _TEMPLATE.md                           # Template for new releases
├── v0.0.1-development-environment.md      # M0: Dev environment
├── v0.0.2-php-symfony-foundation.md       # M0: PHP/Symfony
├── v0.1.0-station-entity.md               # M1: Station entity
└── ...
```

### Release Document Contents

Each document includes:
- **Status** – Not Started / In Progress / Complete / Released
- **Prerequisites** – Dependencies on other releases
- **Related Documentation** – Links to requirements, business rules, ADRs
- **Feature Checklist** – Checkbox list of deliverables
- **Testing Requirements** – Unit, integration, and manual tests
- **Definition of Done** – Criteria for release completion
- **Release Notes Draft** – Pre-written release notes

### Workflow

1. **Before starting a release:** Create release document from template
2. **During development:** Track progress via feature checkboxes
3. **Before tagging:** Verify all Definition of Done items checked
4. **After release:** Update document status to "Released"

See [Release Document Template](../releases/_TEMPLATE.md) for the full structure.

---

## 9. Release Checklist

### Before Tagging

- [ ] All tests passing on `main`
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated in:
  - [ ] `package.json` (all packages)
  - [ ] `composer.json` (PHP services)
  - [ ] Documentation references (if any)
- [ ] Documentation review complete
- [ ] Breaking changes documented (if any)
- [ ] Migration guide written (if needed)

### After Tagging

- [ ] GitHub/GitLab release created
- [ ] Release notes published
- [ ] Team notified
- [ ] Deployment triggered (if automated)
- [ ] Smoke tests passed on staging

---

## 10. Rollback Procedure

If a release needs to be rolled back:

```bash
# 1. Identify the last good version
git log --oneline --tags

# 2. Deploy the previous version
# (deployment-specific commands)

# 3. Create hotfix branch from current
git checkout -b hotfix/v0.1.2 v0.1.1

# 4. Apply fixes
# ...

# 5. Release the hotfix
git tag -a v0.1.2 -m "Hotfix v0.1.2: Rollback fixes"
git push origin v0.1.2
```

**Never delete or move existing tags** – this breaks reproducibility.

---

## 11. Roadmap to Release Mapping

| Roadmap Version | Git Tag | Milestone |
|-----------------|---------|-----------|
| v0.0.1 | `v0.0.1` | M0: Dev Environment |
| v0.0.2 | `v0.0.2` | M0: PHP/Symfony Foundation |
| v0.0.3 | `v0.0.3` | M0: Node.js Foundation |
| v0.0.4 | `v0.0.4` | M0: Shared Package |
| v0.0.5 | `v0.0.5` | M0: Frontend Foundation |
| v0.0.6 | `v0.0.6` | M0: CI/CD Pipeline |
| v0.1.0 | `v0.1.0` | M1: Station Entity |
| v0.1.1 | `v0.1.1` | M1: Station Category |
| ... | ... | ... |
| v0.1.x | `v0.1.x` + `milestone-1` | M1 Complete |
| v0.2.0 | `v0.2.0` | M2: Validation Types |
| ... | ... | ... |
| v1.0.0 | `v1.0.0` | Production Release |

---

## 12. Summary

| Aspect | Convention |
|--------|------------|
| Branch model | Trunk-based with feature branches |
| Main branch | `main` (always deployable) |
| Tag format | `v{MAJOR}.{MINOR}.{PATCH}` |
| Pre-release | `v{VERSION}-{alpha|beta|rc}.{N}` |
| Versioning | Semantic Versioning 2.0 |
| Changelog | Keep a Changelog format |
| Tag messages | Annotated with release notes |

**Key Principles:**
1. Every release has a tag
2. Tags are immutable (never delete/move)
3. Main branch is always deployable
4. Version numbers align with roadmap milestones
5. CHANGELOG documents all notable changes
