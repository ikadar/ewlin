# Flux Print Shop Scheduling System

This is the monorepo for the Flux Scheduler, a print shop scheduling system.

## Language

**All communication, code, commit messages, documentation, and comments MUST be in English. Never use Hungarian.**

## Project structure

```
ewlin/
├── services/php-api/     # PHP/Symfony backend (git submodule)
├── packages/types/       # @flux/types TypeScript package (git submodule)
├── packages/validator/   # @flux/schedule-validator (git submodule)
├── apps/web/             # React frontend
└── docs/                 # Documentation
    ├── roadmap/          # Release roadmap
    ├── releases/         # Release documents
    ├── architecture/     # ADRs, strategies
    └── domain-model/     # Business rules, vocabulary
```

## Release workflow

When asked to implement a release, **always** follow this workflow:

### 1. Prepare release document
- Check if it exists: `docs/releases/v{VERSION}-{name}.md`
- If not, create one based on `docs/releases/_TEMPLATE.md`
- Fill in: scope, prerequisites, feature checklist, testing requirements

### 2. Request approval
- Present the release document
- **WAIT** for the user's explicit approval before proceeding

### 3. Implementation
- Use TodoWrite to track tasks
- Follow the feature checklist
- Write unit and integration tests
- Run PHPStan (level 8)
- Run all tests

### 4. Request approval
- Present the implementation summary
- Test results, PHPStan results
- **WAIT** for the user's explicit approval

### 5. Update documents
- `docs/roadmap/release-roadmap.md` - mark as ✅
- `docs/releases/v{VERSION}-*.md` - status: Released, checkboxes ✅
- `services/php-api/CHANGELOG.md` - add new version

### 6. Git operations (PHP API - PR workflow)

**IMPORTANT: Always merge via PR, NEVER commit directly to main!**

```bash
# PHP API repo (services/php-api/)

# 1. Create feature branch
git checkout -b feature/v{VERSION}-{kebab-case-name}

# 2. Commit and push
git add -A
git commit -m "feat: {Short description}"
git push -u origin feature/v{VERSION}-{kebab-case-name}

# 3. Create PR
gh pr create --title "v{VERSION} - {Title}" --body "..."

# 4. WAIT for CI GREEN STATUS and PR MERGE!

# 5. After merge: checkout main and pull
git checkout main
git pull origin main

# 6. Create tag and release
git tag -a v{VERSION} -m "v{VERSION} - {Title}"
git push origin v{VERSION}
gh release create v{VERSION} --title "v{VERSION} - {Title}" --notes "..."
```

### 7. Git operations (Monorepo - documentation)
```bash
# Monorepo (ewlin/) - this can go directly to main
git add docs/ services/php-api
git commit -m "docs: Update for v{VERSION} release"
git push origin main
```

### 8. CI verification
- Check GitHub Actions status
- If failed, fix and repeat git operations

## Commit message format

```
v{VERSION} - {Short Title}

{Description}

Features:
- Feature 1
- Feature 2

Technical:
- Technical change 1

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Important files

| File | Description |
|------|-------------|
| `docs/roadmap/release-roadmap.md` | Full release roadmap |
| `docs/releases/_TEMPLATE.md` | Release document template |
| `docs/architecture/git-release-strategy.md` | Git/version strategy |
| `docs/domain-model/business-rules.md` | Business rules (BR-*) |

## Implementation plans

When given a multi-section implementation plan, **implement ALL sections completely**. Never silently skip sections (e.g. skipping backend while doing frontend). If a section cannot be implemented, explicitly flag it and ask for guidance before moving on.

**After writing database migrations, always run them immediately** (`php bin/console doctrine:migrations:migrate --no-interaction`). A migration that exists but hasn't been applied will crash the app at runtime.

## PHP API specifics

- **PHPStan level 8** is mandatory
- **PHPUnit** tests are mandatory
- Symfony 7 + Doctrine ORM
- OpenAPI documentation (Swagger UI: /api/doc)

## Playwright tests — STRICT RULES

### 1. NEVER run Playwright tests without permission
- Playwright tests (`npx playwright test`, `npx playwright show-trace`, etc.) may **ONLY be run if the user gives EXPLICIT, clear permission.**
- "Fix the tests" — this is NOT permission to run them.
- If you need test results, **ask the user** to run them and provide the output.

### 2. ALWAYS read the actual error output FIRST
- Before making any changes to failing tests, **read the actual error message**.
- The `test-results/` directory has `error-context.md` for each failing test — read it.
- Read the test output provided by the user (terminal, file) before forming a diagnosis.
- **Working from assumptions is forbidden.** Every change must be based on a concrete, read error message.
