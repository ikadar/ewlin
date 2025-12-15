# UI Development Guide

This guide describes the overall workflow for developing the frontend UI on the `ux-ui-development` branch.

## Overview

The UI development follows a structured workflow:

1. **Preparation (on `main`)** - Update UX-UI documentation and release roadmap
2. **Branch creation** - Create `ux-ui-development` branch from `main`
3. **Implementation** - Implement releases one by one using `/implement-ui-release`
4. **Final merge** - Merge `ux-ui-development` back to `main` after all M3 releases are complete

## Workflow

### Step 1: UX-UI Documentation Update (on `main`)

Before starting implementation, ensure all UX-UI specifications are finalized:

- `docs/ux-ui/` contains all UI/UX specifications
- Specifications cover all planned releases
- Any changes to the UI concept are documented here

This step is done on `main` branch and coordinated by the project lead.

### Step 2: Roadmap Update (on `main`)

Update the release roadmap to reflect the new UI concept:

- `docs/roadmap/release-roadmap.md` - update M3 release items
- Ensure each release has a clear scope and checklist
- Create release documents in `docs/releases/` if needed

This step is done on `main` branch and coordinated by the project lead.

### Step 3: Create `ux-ui-development` Branch

Once documentation and roadmap are finalized:

```bash
git checkout main
git pull origin main
git checkout -b ux-ui-development
git push -u origin ux-ui-development
```

All UI implementation work happens on this branch.

### Step 4: Implement Releases

Work through the releases one by one using the `/implement-ui-release` command:

```
/implement-ui-release v0.3.2
```

The command guides you through:
1. Reading specifications and preparing release document
2. **STOP** - Wait for scope approval
3. Creating feature branch and implementing
4. **STOP** - Wait for implementation approval (may require iterations)
5. Merging to `ux-ui-development` and updating documentation

Repeat for each release in the roadmap (v0.3.2, v0.3.3, etc.).

### Step 5: Final Merge to `main`

After all M3 frontend releases are complete on `ux-ui-development`:

1. Create a PR from `ux-ui-development` to `main`
2. Review and merge
3. Create git tags and GitHub releases for all versions

This step is coordinated by the project lead.

## Important Rules

- **NEVER** merge directly to `main` during UI development
- **ALWAYS** use `/implement-ui-release` for each release
- **ALWAYS** wait for approval at STOP points
- Work sequentially through releases (don't skip ahead)

## Quick Reference

| Step | Branch | Who |
|------|--------|-----|
| 1. UX-UI docs update | `main` | Project lead |
| 2. Roadmap update | `main` | Project lead |
| 3. Create branch | `ux-ui-development` | - |
| 4. Implement releases | `ux-ui-development` | Developer + Claude |
| 5. Final merge | `main` | Project lead |
