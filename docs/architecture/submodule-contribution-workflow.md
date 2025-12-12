# Submodule Contribution Workflow

This document describes how to work with the Flux Print Shop Scheduling System's submodule architecture.

## Repository Structure

The Flux system uses a **monorepo with git submodules** architecture:

```
ewlin/                          # Main monorepo
├── services/
│   └── php-api/               # → ewlin-php-api (submodule)
├── packages/
│   ├── types/                 # → ewlin-types (submodule)
│   └── validator/             # → ewlin-validator (submodule)
├── apps/
│   └── web/                   # React frontend (in monorepo)
└── docs/                      # Documentation (in monorepo)
```

### Repositories

| Repository | Description | CI Workflow |
|------------|-------------|-------------|
| [ewlin](https://github.com/ikadar/ewlin) | Main monorepo | Full CI (all packages) |
| [ewlin-php-api](https://github.com/ikadar/ewlin-php-api) | PHP/Symfony backend | PHPStan + PHPUnit |
| [ewlin-types](https://github.com/ikadar/ewlin-types) | Shared TypeScript types | TypeScript build |
| [ewlin-validator](https://github.com/ikadar/ewlin-validator) | Schedule validation | TypeScript + Vitest |

---

## Working with Submodules

### Initial Clone

When cloning the monorepo, include submodules:

```bash
git clone --recurse-submodules git@github.com:ikadar/ewlin.git
```

Or if already cloned:

```bash
git submodule update --init --recursive
```

### Updating Submodules

To get the latest changes from all submodules:

```bash
git submodule update --remote --merge
```

### Working in a Submodule

1. **Navigate to submodule directory:**
   ```bash
   cd services/php-api  # or packages/types, packages/validator
   ```

2. **Create feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

3. **Make changes and commit:**
   ```bash
   git add .
   git commit -m "feat: Add new feature"
   ```

4. **Push to submodule remote:**
   ```bash
   git push origin feature/my-feature
   ```

5. **Create Pull Request** on the submodule repository (e.g., ewlin-php-api)

6. **After PR merge**, update monorepo:
   ```bash
   cd /path/to/ewlin
   git add services/php-api
   git commit -m "chore: Update php-api submodule"
   git push
   ```

---

## CI/CD Workflows

### Submodule CI

Each submodule has its own CI workflow that runs on:
- Push to `main` branch
- Pull requests targeting `main`

| Repository | CI Jobs | Required to Pass |
|------------|---------|------------------|
| ewlin-php-api | PHPStan, PHPUnit | Yes |
| ewlin-types | TypeScript build | Yes |
| ewlin-validator | Build, Vitest | Yes |

### Monorepo CI

The monorepo CI runs the full test suite across all packages:
- Node.js lint, typecheck, test
- Frontend build
- PHP lint (PHPStan), test (PHPUnit)

---

## Branch Protection Rules

All repositories have branch protection on `main`:

- **Require pull request** before merging
- **Require status checks to pass** (CI workflow)
- **Dismiss stale approvals** when new commits are pushed
- **Include administrators** in restrictions

### Direct Push Prevention

Direct pushes to `main` are blocked. Always use pull requests:

```bash
# This will fail:
git push origin main

# Do this instead:
git checkout -b feature/my-change
# ... make changes ...
git push origin feature/my-change
# Create PR on GitHub
```

---

## Dependency Management

### TypeScript Packages

The `@flux/schedule-validator` depends on `@flux/types`:

**In monorepo context** (pnpm workspace):
```json
{
  "dependencies": {
    "@flux/types": "workspace:*"
  }
}
```

**In standalone CI** (GitHub reference):
```json
{
  "dependencies": {
    "@flux/types": "github:ikadar/ewlin-types#main"
  }
}
```

The validator package uses the GitHub reference to enable standalone CI without npm publishing.

### PHP Package

The PHP API is self-contained with dependencies managed via Composer.

---

## Release Workflow

### Submodule Release

1. **Create release branch** in submodule:
   ```bash
   cd services/php-api
   git checkout -b release/v0.1.x
   ```

2. **Make changes**, ensure CI passes

3. **Create PR** and merge to main

4. **Tag release**:
   ```bash
   git tag -a v0.1.x -m "v0.1.x - Release title"
   git push origin v0.1.x
   ```

5. **Create GitHub release** with release notes

6. **Update monorepo** submodule reference:
   ```bash
   cd /path/to/ewlin
   git add services/php-api
   git commit -m "chore: Update php-api to v0.1.x"
   git push
   ```

### Coordinated Release

For releases affecting multiple submodules:

1. Create feature branches in all affected submodules
2. Implement changes in each
3. Merge PRs in dependency order (types → validator → php-api)
4. Update monorepo with all submodule references
5. Tag monorepo if needed

---

## Troubleshooting

### Submodule Out of Sync

If submodule shows changes but you haven't modified it:

```bash
git submodule update --init
```

### Detached HEAD in Submodule

Submodules often checkout in detached HEAD state. To work on changes:

```bash
cd services/php-api
git checkout main
git pull
git checkout -b feature/my-feature
```

### CI Failing on Validator

If validator CI fails due to types dependency:

1. Ensure ewlin-types main branch has latest changes
2. Wait for ewlin-types CI to pass
3. Re-run validator CI

---

## Quick Reference

| Task | Command |
|------|---------|
| Clone with submodules | `git clone --recurse-submodules <url>` |
| Update all submodules | `git submodule update --remote --merge` |
| Check submodule status | `git submodule status` |
| Work in submodule | `cd <submodule> && git checkout -b feature/x` |
| Update monorepo reference | `git add <submodule> && git commit` |
