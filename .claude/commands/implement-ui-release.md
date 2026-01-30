---
description: Implement a UI release on the ux-ui-development branch
---

# UI Release Implementation: $ARGUMENTS

Implement the specified release following the workflow below.

**Target branch:** `ux-ui-development` (NOT `main`)

---

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
     - Create the release document with:
       - Feature checklist
       - **Manual QA Test Plan section** (see template at the bottom of this document)
   - If **exists**, read and understand the scope

3. **STOP — Present the release document and WAIT for approval!**

---

### Phase 2: Feature Branch and Implementation

Continue only after approval!

1. **Create feature branch:**
   ```bash
   cd /Users/istvan/Code/ewlin
   git checkout ux-ui-development && git pull origin ux-ui-development
   git checkout -b feature/v{VERSION}-{short-name}
   ```

2. **Create task list** based on the feature checklist

3. **Implement all features:**

   **Main app conventions to follow:**
   - TypeScript strict mode
   - `@flux/types` for all domain types
   - Tailwind CSS with project design tokens (`index.css` @theme)
   - `memo()` for components receiving heavy data props
   - `useCallback` for event handlers passed to children
   - Barrel exports (`index.ts`) for component directories
   - `clsx()` + `tailwind-merge` for conditional classes
   - Path alias: `@/*` → `./src/*`

   **Component structure:**
   ```
   src/components/MyComponent/
   ├── MyComponent.tsx        # Main component
   ├── MyComponent.test.tsx   # Unit tests
   └── index.ts               # Barrel export
   ```

4. **Create deterministic test fixture for Manual QA:**
   - Location: `apps/web/src/mock/testFixtures.ts`
   - Add new fixture with name matching the feature (e.g., `zoom-80`, `font-standardization`)
   - Fixture must provide **predictable, reproducible data** for manual testing
   - Document the fixture in the release document's Manual QA Test Plan section

5. **Write unit tests (Vitest):**
   - Location: alongside component (`MyComponent.test.tsx`)
   - Test: rendering, props, callbacks, edge cases
   - Use `@testing-library/react`

6. **Write E2E tests (Playwright):**
   - Location: `apps/web/playwright/`
   - **When to write E2E tests:**
     - User interactions (click, double-click, keyboard navigation)
     - Navigation and scrolling behavior
     - Keyboard shortcuts
     - Visual state changes (selection, hover, active states)
     - Form interactions (search, filter)
   - **When NOT to write E2E tests:**
     - Pure styling changes (colors, spacing)
     - Internal refactoring without behavior change
     - Performance optimizations
   - **Test file naming:** `{feature-name}.spec.ts` (e.g., `zoom-levels.spec.ts`)
   - **Add data-testid** attributes to new components for reliable selection

7. **Quality checks:**
   ```bash
   cd apps/web
   pnpm run lint
   npx tsc --noEmit
   pnpm test
   ```

8. **Run E2E tests:**
   ```bash
   cd apps/web
   pnpm exec playwright test
   ```

   **If tests fail:** fix and re-run. Never skip failing tests.

9. **STOP — Present the implementation summary:**
   - Created/modified files
   - Unit test results
   - E2E test results
   - Lint/TypeScript results
   - **Manual QA Test Plan** with steps and expected results
   - **Test fixture URL:** `http://localhost:5173/?fixture={feature-name}`
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

   Manual QA:
   - Test fixture: ?fixture={feature-name}
   - QA steps documented in release notes

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

   ## Manual QA
   Test URL: `http://localhost:5173/?fixture={feature-name}`

   ### Test Steps
   1. {Step 1}
   2. {Step 2}

   ### Expected Results
   - {Expected result 1}
   - {Expected result 2}

   ## Notes
   - This is a UI development release (ux-ui-development branch)
   - Not yet merged to main
   EOF
   )"
   ```

---

### Phase 5: Documentation Update

1. **Update documents:**
   - `docs/roadmap/release-roadmap.md` — mark release items as `[x]` completed
   - `docs/releases/v{VERSION}-*.md`:
     - Status: ✅ Released (on ux-ui-development)
     - Release Date: current date
     - Feature checklist: all checked
     - Manual QA: all checked
     - Definition of Done: all checked

2. **Commit documentation:**
   ```bash
   git add docs/
   git commit -m "docs: Update for v{VERSION} release"
   git push origin ux-ui-development
   ```

---

## Manual QA Test Plan Template

Include this section in every release document:

```markdown
## Manual QA Test Plan

### Test Fixture
- **Fixture name:** `{feature-name}`
- **URL:** `http://localhost:5173/?fixture={feature-name}`
- **Description:** {What the fixture provides}

### Visual Verification
- [ ] {Visual check 1 — layout, sizing, colors}
- [ ] {Visual check 2 — font sizes, spacing}
- [ ] {Visual check 3 — component alignment}

### Interaction Testing
- [ ] {Interaction 1 — e.g., click behavior}
- [ ] {Interaction 2 — e.g., keyboard navigation works}
- [ ] {Interaction 3 — e.g., zoom level changes}

### Regression Testing
- [ ] Existing functionality still works
- [ ] No visual regressions in unrelated components
```

---

## Important Rules

### Approval gates
- **NEVER** proceed without approval after Phase 1 and Phase 2
- **ALWAYS** present release document before implementation
- **ALWAYS** present implementation summary before commit

### Manual QA
- **ALWAYS** include Manual QA Test Plan in release document
- **ALWAYS** create deterministic test fixtures for Manual QA
- **ALWAYS** document test fixture URL and steps in implementation summary

### Quality
- **ALWAYS** read specification documents in Phase 1
- **ALWAYS** use feature branches, never commit directly to `ux-ui-development`
- **ALWAYS** run lint, typecheck, unit tests, and E2E tests
- **ALWAYS** write E2E tests for user interactions (when applicable)
- **ALWAYS** create git tag and GitHub release after merge
- **NEVER** merge into `main` — only merge into `ux-ui-development`
- **NEVER** skip failing tests — fix them before proceeding
- Commit messages in English, communication in the user's language

## Affected Repository

| Repo | When affected |
|------|---------------|
| `apps/web` | Always (UI releases) |
| `packages/types` | When domain types change |
