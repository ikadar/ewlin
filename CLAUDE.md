# Flux Print Shop Scheduling System

This is the monorepo for the Flux Scheduler, a print shop scheduling system.

## Project structure

```
operator-sandbox/
├── services/php-api/          # PHP/Symfony backend (git submodule)
├── services/scheduling-engine/ # Rust scheduling engine (axum)
├── packages/types/            # @flux/types TypeScript package (git submodule)
├── packages/validator/        # @flux/schedule-validator (git submodule)
├── apps/web/                  # React frontend
└── docs/                      # Documentation
    ├── operator-sandbox/      # Operator scheduling algorithm docs
    ├── roadmap/               # Release roadmap
    ├── releases/              # Release documents
    ├── architecture/          # ADRs, strategies
    └── domain-model/          # Business rules, vocabulary
```

## Language

The user communicates in French or English. Match the language they use. All code, commit messages, documentation, and plans must be written in English.

## Autonomy level — HIGH

The user trusts Claude to make implementation decisions and execute without asking for approval at every step. Specifically:

- **Do NOT ask for permission** before editing files, creating files, running builds, or committing.
- **Do NOT ask "should I proceed?" or "on y va?"** — if the task is clear, just do it.
- **Commit frequently** without asking. Group related changes into logical commits.
- **Fix bugs immediately** when discovered — don't report them and wait.
- **When in plan mode**, gather information, design the approach, write the plan, and call ExitPlanMode. Don't ask intermediate questions unless genuinely ambiguous.
- **Ask the user ONLY when**:
  - A domain/business decision is needed (not a technical one)
  - Requirements are genuinely ambiguous
  - There are multiple valid approaches with different trade-offs the user should choose between
- **For UI/UX changes**: create a playground first, show it to the user, then implement after validation. This is the ONE area where approval is needed before coding.

## Key technical decisions (do not re-ask)

- **Real database only** — never use mock/fixture data. Always target the real PHP API + PostgreSQL.
- **Playground before frontend** — validate UI/UX with a playground HTML file before implementing React components.
- **Submodules** — services/php-api, packages/types, packages/validator are git submodules. Commit in each submodule first, then commit the reference in the monorepo.
- **Rust engine** — `services/scheduling-engine/` is a standalone axum HTTP service. Run with `cargo run`. Not a submodule.

## PHP API specifics

- **PHPStan level 8** is mandatory
- **PHPUnit** tests are mandatory
- Symfony 7 + Doctrine ORM
- OpenAPI documentation (Swagger UI: /api/doc)

## Commit message format

```
feat/fix/refactor/docs: Short description

Longer description if needed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Playwright tests — STRICT RULES

1. **NEVER run Playwright tests without explicit permission.**
2. **ALWAYS read the actual error output FIRST** before making changes to failing tests.

## Key reference files

| File | Description |
|------|-------------|
| `docs/operator-sandbox/implementation-plan.md` | Full implementation plan with all decisions |
| `docs/operator-sandbox/plan-review-2026-04-04.md` | Review summary + architectural rethink |
| `docs/operator-sandbox/deterministic-operator-algorithm-analysis.md` | Algorithm analysis |
