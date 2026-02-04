---
description: Implementálj egy release-t a standard workflow szerint
---

# UI Release Implementation from Requirement: $ARGUMENTS

Implement the specified release following the workflow below. This command extends the standard UI release workflow with:
- Integration of requirement specifications into `docs/ux-ui/` documentation
- Manual QA test plan creation
- Deterministic test fixture data for manual testing

**Target branch:** `ux-ui-development` (NOT `main`)

**Requirement source:** `docs/ux-ui/tmp/refactored-new-requirements-en.md`

## Workflow Steps

### Phase 1: Preparation and Specification

1. **Read the requirement specification:**
   - `docs/ux-ui/tmp/refactored-new-requirements-en.md` - find the relevant REQ-XX
   - Understand the requirement scope, current state, and expected behavior

2. **Read all relevant specification documents:**
   - `docs/ux-ui/` - all files (UI/UX specifications)
   - `docs/domain-model/` - all files (business rules, vocabulary)
   - `docs/roadmap/release-roadmap.md` - release scope

3. **Check release document:**
   - Verify if exists: `docs/releases/v{VERSION}-{name}.md`
   - If **not exists**:
     - Read: `docs/releases/_TEMPLATE.md`
     - Read: `docs/roadmap/release-roadmap.md` (to understand scope)
     - Create the release document
     - **Include Manual QA Test Plan section** (see template below)
   - If **exists**, read and understand the scope

4. **STOP - Present the release document and WAIT for approval!**

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

3. **Create deterministic test fixture for Manual QA:**
   - Location: `apps/web/src/mock/testFixtures.ts`
   - Add new fixture with name matching the feature (e.g., `job-focus`, `nav-bar`, `dry-time`)
   - Fixture must provide **predictable, reproducible data** for manual testing
   - Document the fixture in the release document

   **Fixture template:**
   ```typescript
   // In testFixtures.ts
   export const FIXTURES = {
     // ... existing fixtures ...
     '{feature-name}': {
       description: 'Test data for {feature description}',
       jobs: [...],
       tasks: [...],
       assignments: [...],
       // Include specific scenarios needed for manual QA
     },
   };
   ```

4. **Implement all features:**
   - React components
   - Styling (Tailwind CSS)
   - State management (Redux if needed)
   - Unit tests

   **IMPORTANT - Follow mockups precisely:**
   - **Primary mockup file:** `docs/ux-ui/dark-prettier.html`
   - **Visual reference:** `docs/ux-ui/assets/mockup-reference.png`
   - Copy class names exactly from mockup code (spacing, colors, typography)
   - Match visual structure: element order, flex directions, alignments
   - Compare your implementation's rendered HTML with the mockup HTML

5. **Write E2E tests (Playwright):**
   - Location: `apps/web/playwright/`
   - **When to write E2E tests:**
     - User interactions (click, double-click, drag & drop)
     - Navigation and scrolling behavior
     - Keyboard shortcuts
     - Visual state changes (selection, hover, active states)
     - Form interactions (search, filter)
   - **When NOT to write E2E tests:**
     - Pure styling changes (colors, spacing)
     - Internal refactoring without behavior change
     - Performance optimizations
   - **Test file naming:** `{feature-name}.spec.ts` (e.g., `job-focus.spec.ts`)
   - **Use existing helpers** from `playwright/helpers/`
   - **Add data-testid** attributes to new components for reliable selection

6. **Quality checks:**
   ```bash
   cd apps/web
   pnpm run lint
   npx tsc --noEmit
   pnpm test
   ```

7. **Run E2E tests:**
   ```bash
   cd apps/web
   pnpm playwright test
   ```

   **If E2E tests fail:**
   - Fix the failing tests or the implementation
   - Re-run until all tests pass
   - Never skip failing tests without fixing

8. **STOP - Present the implementation summary:**
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

### Phase 3: Documentation Integration

Continue only after implementation approval!

**Integrate the requirement into `docs/ux-ui/` documentation:**

1. **Identify affected documentation files:**
   - Check which `docs/ux-ui/` files are relevant to the implemented feature
   - Common targets:
     - `01-interaction-patterns/` - for interaction changes
     - `04-visual-feedback/` - for visual feedback changes
     - `05-components/` - for component changes
     - `specifications/` - for spec updates

2. **Update the documentation:**
   - Add new sections or update existing ones
   - Use the same structure and terminology as existing docs
   - Include visual diagrams (ASCII art) where helpful
   - Reference the original requirement: `> Implemented from REQ-XX`

3. **Update specification files if needed:**
   - `specifications/ui-interaction-stories.md` - add new user stories
   - `specifications/acceptance-criteria.md` - add new acceptance criteria
   - `specifications/keyboard-shortcuts.md` - if new shortcuts added
   - `specifications/design-tokens.md` - if new tokens added

---

### Phase 4: Commit and Merge

Continue only after documentation approval!

1. **Commit the changes:**
   ```bash
   git add -A
   git commit -m "$(cat <<'EOF'
   feat(web): v{VERSION} - {Title}

   {Description}

   Implements: REQ-XX

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

### Phase 5: Tag and Release

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

   Implements: REQ-XX

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

### Phase 6: Final Documentation Update

1. **Update documents:**
   - `docs/roadmap/release-roadmap.md` - mark release as completed
   - `docs/releases/v{VERSION}-*.md`:
     - Status: ✅ Released (on ux-ui-development)
     - Release Date: current date
     - Feature checklist: all checked
     - Definition of Done: all checked
     - Manual QA: all checked

2. **Mark requirement as implemented:**
   - In `docs/ux-ui/tmp/refactored-new-requirements-en.md`:
     - Add at the top of the REQ section: `> ✅ Implemented in v{VERSION}`

3. **Commit documentation:**
   ```bash
   git add docs/
   git commit -m "docs: Update for v{VERSION} UI release (REQ-XX)"
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

### Test Data Setup
| Entity | ID | Key Properties |
|--------|-----|----------------|
| Job | job-1 | {relevant properties} |
| Task | task-1 | {relevant properties} |
| ... | ... | ... |

### Test Scenarios

#### Scenario 1: {Happy Path}
**Preconditions:**
- {precondition 1}
- {precondition 2}

**Steps:**
1. {action 1}
2. {action 2}
3. {action 3}

**Expected Results:**
- [ ] {expected result 1}
- [ ] {expected result 2}

#### Scenario 2: {Edge Case}
**Preconditions:**
- {precondition}

**Steps:**
1. {action}

**Expected Results:**
- [ ] {expected result}

### Visual Verification
- [ ] {Visual check 1}
- [ ] {Visual check 2}
```

---

## Important Rules

- **NEVER** proceed without approval after Phase 1, Phase 2, and Phase 3
- **ALWAYS** read the requirement specification first
- **ALWAYS** read specification documents in Phase 1
- **ALWAYS** create deterministic test fixtures for Manual QA
- **ALWAYS** include Manual QA Test Plan in release document
- **ALWAYS** use feature branches, never commit directly to `ux-ui-development`
- **ALWAYS** use TodoWrite to track progress
- **ALWAYS** run lint, typecheck, unit tests, and E2E tests
- **ALWAYS** write E2E tests for user interactions (when applicable)
- **ALWAYS** integrate requirement into `docs/ux-ui/` documentation
- **ALWAYS** create git tag and GitHub release after merge
- **NEVER** merge into `main` - only merge into `ux-ui-development`
- **NEVER** skip failing E2E tests - fix them before proceeding
- Commit messages in English, communication in the user's language

## Affected Repository

| Repo | When affected |
|------|---------------|
| `apps/web` | Always (UI releases) |

## Affected Documentation

| Location | Purpose |
|----------|---------|
| `docs/ux-ui/` | Integrate implemented requirements |
| `docs/releases/` | Release documentation with QA plan |
| `docs/roadmap/` | Mark release as completed |
| `apps/web/src/mock/testFixtures.ts` | Deterministic test data |
