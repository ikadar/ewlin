---
description: Implement a UI release on the ux-ui-development branch
---

# UI Release Implementation: $ARGUMENTS

Implement the specified release following the workflow below.

**Target branch:** `ux-ui-development` (NOT `main`)

## Workflow Steps

### Phase 1: Preparation and Specification

1. **Read all relevant specification documents:**
   - `docs/ux-ui/` - all files (UI/UX specifications)
   - `docs/domain-model/` - all files (business rules, vocabulary)
   - `docs/roadmap/release-roadmap.md` - release scope

2. **Check release document:**
   - Verify if exists: `docs/releases/v{VERSION}-{name}.md`
   - If **not exists**:
     - Read: `docs/releases/_TEMPLATE.md`
     - Read: `docs/roadmap/release-roadmap.md` (to understand scope)
     - Create the release document
   - If **exists**, read and understand the scope

3. **STOP - Present the release document and WAIT for approval!**

---

### Phase 2: Feature Branch and Implementation

Continue only after approval!

1. **Create feature branch:**
   ```bash
   cd /Users/istvan/Code/ewlin
   git checkout ux-ui-development && git pull origin ux-ui-development
   git checkout -b feature/v{VERSION}-{short-name}
   ```

2. **Create TodoWrite list** based on the feature checklist

3. **Implement all features:**
   - React components
   - Styling (Tailwind CSS)
   - State management (Redux if needed)
   - Unit tests

4. **Quality checks:**
   ```bash
   cd apps/web
   pnpm run lint
   npx tsc --noEmit
   pnpm test
   ```

5. **STOP - Present the implementation summary:**
   - Created/modified files
   - Test results
   - Lint/TypeScript results
   - **WAIT for approval!**

#### Handling Modification Requests

If modifications are requested:
1. Make the requested changes
2. Run quality checks again
3. Present the updated implementation summary
4. Repeat until approved

---

### Phase 3: Commit and Merge

Continue only after approval!

1. **Commit the changes:**
   ```bash
   git add -A
   git commit -m "$(cat <<'EOF'
   feat(web): v{VERSION} - {Title}

   {Description}

   Features:
   - Feature 1
   - Feature 2

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

2. **Push and merge into ux-ui-development:**
   ```bash
   git push -u origin feature/v{VERSION}-{short-name}
   git checkout ux-ui-development
   git pull origin ux-ui-development
   git merge feature/v{VERSION}-{short-name}
   git push origin ux-ui-development
   ```

3. **Clean up feature branch:**
   ```bash
   git branch -d feature/v{VERSION}-{short-name}
   git push origin --delete feature/v{VERSION}-{short-name}
   ```

---

### Phase 4: Tag and Release

1. **Create git tag on ux-ui-development:**
   ```bash
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   ```

2. **Create GitHub release:**
   ```bash
   gh release create v{VERSION} \
     --target ux-ui-development \
     --title "v{VERSION} - {Title}" \
     --notes "$(cat <<'EOF'
   ## Summary
   {Brief description}

   ## Features
   - Feature 1
   - Feature 2

   ## Notes
   - This is a UI development release (ux-ui-development branch)
   - Not yet merged to main
   EOF
   )"
   ```

---

### Phase 5: Documentation Update

1. **Update documents:**
   - `docs/roadmap/release-roadmap.md` - mark release as completed
   - `docs/releases/v{VERSION}-*.md`:
     - Status: ✅ Released (on ux-ui-development)
     - Release Date: current date
     - Feature checklist: all checked
     - Definition of Done: all checked

2. **Commit documentation:**
   ```bash
   git add docs/
   git commit -m "docs: Update for v{VERSION} UI release"
   git push origin ux-ui-development
   ```

---

## Important Rules

- **NEVER** proceed without approval after Phase 1 and Phase 2
- **ALWAYS** read specification documents in Phase 1
- **ALWAYS** use feature branches, never commit directly to `ux-ui-development`
- **ALWAYS** use TodoWrite to track progress
- **ALWAYS** run lint, typecheck, and tests
- **ALWAYS** create git tag and GitHub release after merge
- **NEVER** merge into `main` - only merge into `ux-ui-development`
- Commit messages in English, communication in the user's language

## Affected Repository

| Repo | When affected |
|------|---------------|
| `apps/web` | Always (UI releases) |
