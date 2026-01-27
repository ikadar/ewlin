---
description: Implement a JCF (Job Creation Form) release based on the reference/jcf prototype
---

# JCF Release Implementation: $ARGUMENTS

Implement the specified JCF release (v0.4.4–v0.4.28) following the workflow below.

**Target branch:** `feature/jcf` (created from `ux-ui-development`)

**Reference sources (read-only, NEVER merge):**
- **Spec:** `reference/jcf/docs/implicit-logic-specification.md` (primary — the "what")
- **Reference app:** `reference/jcf/` (visual/behavioral — the "how it looks/works")

---

## Workflow Steps

### Phase 1: Preparation and Specification

1. **Read the spec section(s) relevant to this release:**
   - Check the release entry in `docs/roadmap/release-roadmap.md` for the `Spec source: §N` reference
   - Read the corresponding section(s) from `reference/jcf/docs/implicit-logic-specification.md`

2. **Read the reference implementation (read-only):**
   - Identify the reference component(s) listed in the spec or roadmap
   - Read the reference source files to understand the UI/UX behavior
   - **DO NOT copy code — only understand the behavior**

3. **Read main app context:**
   - `docs/domain-model/domain-vocabulary.md` — domain terms
   - `docs/domain-model/business-rules.md` — business rules
   - Existing components in `apps/web/src/components/` — follow established patterns

4. **Check release document:**
   - Verify if exists: `docs/releases/v{VERSION}-{name}.md`
   - If **not exists**:
     - Read: `docs/releases/_TEMPLATE.md`
     - Read: `docs/roadmap/release-roadmap.md` (to understand scope)
     - Create the release document with:
       - Spec source references (§ sections)
       - Reference files consulted (read-only)
       - Feature checklist
       - UX verification checklist
       - **Manual QA Test Plan section** (see template at the bottom of this document)
   - If **exists**, read and understand the scope

5. **STOP — Present the release document and WAIT for approval!**

---

### Phase 2: Implementation

Continue only after approval!

1. **Create feature branch:**
   ```bash
   cd /Users/istvan/Code/ewlin
   git checkout feature/jcf && git pull origin feature/jcf
   git checkout -b feature/v{VERSION}-{short-name}
   ```

2. **Create task list** based on the feature checklist

3. **Implement all features — CLEAN REIMPLEMENTATION:**

   **THE CARDINAL RULE: Reimplementation, not porting.**
   - Read the reference code to understand the BEHAVIOR
   - Close the reference file
   - Implement from scratch following main app conventions
   - NEVER copy-paste from `reference/jcf/`

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
   - Add new fixture with name matching the feature (e.g., `autocomplete`, `elements-table`)
   - Fixture must provide **predictable, reproducible data** for manual testing
   - Document the fixture in the release document's Manual QA Test Plan section

5. **UX Fidelity Verification:**
   - Start the reference app: `cd reference/jcf && npm run dev` (port 5173/3001)
   - Start the main app: `cd apps/web && pnpm dev` (different port)
   - Compare side-by-side for the specific feature:
     - [ ] Visual layout matches
     - [ ] Keyboard navigation matches
     - [ ] Autocomplete behavior matches (dropdown, highlights, selection)
     - [ ] Validation behavior matches (timing, error display, error messages)
     - [ ] Edge cases match (empty state, long text, special characters)

6. **Write unit tests (Vitest):**
   - Location: alongside component (`MyComponent.test.tsx`)
   - Test: rendering, props, callbacks, edge cases
   - Use `@testing-library/react`

7. **Write E2E tests (Playwright):**
   - Location: `apps/web/playwright/`
   - **When to write E2E tests:**
     - User interactions (click, type, keyboard navigation)
     - Autocomplete open/close/select behavior
     - Form validation feedback
     - Multi-step flows (type → select → verify)
   - **When NOT to write E2E tests:**
     - Pure styling changes
     - Internal refactoring
   - Test file naming: `jcf-{feature-name}.spec.ts`
   - Add `data-testid` attributes for reliable selection

8. **Quality checks:**
   ```bash
   cd apps/web
   pnpm run lint
   npx tsc --noEmit
   pnpm test
   ```

9. **Run E2E tests:**
   ```bash
   cd apps/web
   pnpm exec playwright test
   ```

   **If tests fail:** fix and re-run. Never skip failing tests.

10. **STOP — Present the implementation summary:**
    - Created/modified files
    - Unit test results
    - E2E test results
    - Lint/TypeScript results
    - UX fidelity checklist (from step 5)
    - **Manual QA Test Plan** with steps and expected results
    - **Test fixture URL:** `http://localhost:5173/?fixture={feature-name}`
    - **Explicitly confirm:** "No code was copied from reference/jcf/"
    - **WAIT for approval!**

#### Handling Modification Requests

If modifications are requested:
1. Make the requested changes
2. Re-verify UX fidelity against reference app
3. Run quality checks again
4. Present the updated implementation summary
5. Repeat until approved

---

### Phase 3: Commit and Merge

Continue only after approval!

1. **Commit the changes:**
   ```bash
   git add -A
   git commit -m "$(cat <<'EOF'
   feat(web): v{VERSION} - {Title}

   {Description}

   Spec source: §{N} ({Section Name})
   Reference: reference/jcf (read-only, not ported)

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

2. **Push and merge into feature/jcf:**
   ```bash
   git push -u origin feature/v{VERSION}-{short-name}
   git checkout feature/jcf
   git pull origin feature/jcf
   git merge feature/v{VERSION}-{short-name}
   git push origin feature/jcf
   ```

3. **Clean up feature branch:**
   ```bash
   git branch -d feature/v{VERSION}-{short-name}
   git push origin --delete feature/v{VERSION}-{short-name}
   ```

---

### Phase 4: Tag and Release

1. **Create git tag on feature/jcf:**
   ```bash
   git tag -a v{VERSION} -m "v{VERSION} - {Title}"
   git push origin v{VERSION}
   ```

2. **Create GitHub release:**
   ```bash
   gh release create v{VERSION} \
     --target feature/jcf \
     --title "v{VERSION} - {Title}" \
     --notes "$(cat <<'EOF'
   ## Summary
   {Brief description}

   ## Spec Source
   - §{N}: {Section Name} from implicit-logic-specification.md

   ## Features
   - Feature 1
   - Feature 2

   ## UX Fidelity
   - Verified against reference/jcf (side-by-side comparison)
   - Clean reimplementation (no code copied from reference)

   ## Manual QA
   Test URL: `http://localhost:5173/?fixture={feature-name}`

   ### Test Steps
   1. {Step 1}
   2. {Step 2}

   ### Expected Results
   - {Expected result 1}
   - {Expected result 2}

   ## Notes
   - JCF development release (feature/jcf branch)
   - Not yet merged to ux-ui-development or main
   EOF
   )"
   ```

---

### Phase 5: Documentation Update

1. **Update documents:**
   - `docs/roadmap/release-roadmap.md` — mark release items as `[x]` completed
   - `docs/releases/v{VERSION}-*.md`:
     - Status: ✅ Released (on feature/jcf)
     - Release Date: current date
     - Feature checklist: all checked
     - UX fidelity checklist: all checked
     - Manual QA: all checked
     - Definition of Done: all checked

2. **Commit documentation:**
   ```bash
   git add docs/
   git commit -m "docs: Update for v{VERSION} JCF release"
   git push origin feature/jcf
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
- [ ] {Visual check 3 — match with reference/jcf}

### Interaction Testing
- [ ] {Interaction 1 — e.g., click opens dropdown}
- [ ] {Interaction 2 — e.g., keyboard navigation works}
- [ ] {Interaction 3 — e.g., selection triggers focus chain}

### Cross-check with reference/jcf
- [ ] Open reference/jcf side-by-side — behavior matches
- [ ] Keyboard navigation speed and feel matches
- [ ] Visual spacing and sizing proportionally consistent
```

---

## Important Rules

### Approval gates
- **NEVER** proceed without approval after Phase 1 and Phase 2
- **ALWAYS** present release document before implementation
- **ALWAYS** present implementation summary before commit

### Vibe-code firewall
- **NEVER** copy-paste code from `reference/jcf/`
- **NEVER** import modules from `reference/jcf/`
- **ALWAYS** reimplemented from scratch following main app conventions
- **ALWAYS** explicitly confirm "No code was copied from reference/jcf/" in summary

### UX fidelity
- **ALWAYS** run both apps side-by-side for visual comparison
- **ALWAYS** verify keyboard navigation matches reference
- **ALWAYS** verify autocomplete behavior matches reference
- **ALWAYS** verify validation timing and error display matches reference

### Manual QA
- **ALWAYS** include Manual QA Test Plan in release document
- **ALWAYS** create deterministic test fixtures for Manual QA
- **ALWAYS** document test fixture URL and steps in implementation summary

### Quality
- **ALWAYS** read the relevant spec section(s) before implementing
- **ALWAYS** read the reference source to understand behavior (then close it)
- **ALWAYS** run lint, typecheck, unit tests, and E2E tests
- **ALWAYS** write E2E tests for user interactions
- **ALWAYS** create git tag and GitHub release after merge
- **NEVER** merge into `ux-ui-development` or `main` — only into `feature/jcf`
- **NEVER** skip failing tests — fix them before proceeding
- Commit messages in English, communication in the user's language

### Branch strategy
- `feature/jcf` is the long-lived JCF development branch (from `ux-ui-development`)
- Per-release branches: `feature/v{VERSION}-{short-name}` (from `feature/jcf`)
- Merge direction: per-release branch → `feature/jcf`
- `feature/jcf` → `ux-ui-development` merge happens only after all JCF releases complete

## Affected Repository

| Repo | When affected |
|------|---------------|
| `apps/web` | Always (JCF components, pages, tests) |
| `packages/types` | v0.4.4 (type mapping), possibly later releases |

## Spec Section Quick Reference

| Release | Spec §  | Reference Files |
|---------|---------|-----------------|
| v0.4.4  | §1, §9, §11.6 | `shared/types.ts`, `data/*.json` |
| v0.4.5  | §9 | `data/*.json`, `server/routes/` |
| v0.4.6  | — | `src/App.tsx`, `src/pages/Home.tsx` |
| v0.4.7  | — | `src/components/JobHeader.tsx` |
| v0.4.8  | — | `src/components/Autocomplete.tsx`, `JobHeader.tsx` |
| v0.4.9  | — | `src/components/ElementsTable.tsx` |
| v0.4.10 | §8 | `src/components/ElementsTable.tsx` |
| v0.4.11 | — | `src/components/Autocomplete.tsx` |
| v0.4.12 | §7 | `src/components/Autocomplete.tsx` |
| v0.4.13 | §1.5 | `src/components/FormatAutocomplete.tsx` |
| v0.4.14 | §1.3 | `src/components/ImpressionAutocomplete.tsx` |
| v0.4.15 | §1.4 | `src/components/ElementsTable.tsx:339-347` |
| v0.4.16 | §1.6 | `src/components/ElementsTable.tsx:296-305` |
| v0.4.17 | §1.1 | `src/components/PapierAutocomplete.tsx` |
| v0.4.18 | §1.2 | `src/components/ImpositionAutocomplete.tsx` |
| v0.4.19 | — | `src/components/PrecedencesAutocomplete.tsx` |
| v0.4.20 | §5.1–5.2 | `src/components/SequenceAutocomplete.tsx` |
| v0.4.21 | §5.3 | `src/components/SequenceAutocomplete.tsx` |
| v0.4.22 | §6 | `src/components/WorkflowSequenceAutocomplete.tsx` |
| v0.4.23 | §2.1 L1 | `src/components/ElementsTable.tsx:269-482` |
| v0.4.24 | §2.2, §3 | `src/components/ElementsTable.tsx:392-423, 241-267` |
| v0.4.25 | §2.1 L3 | `src/components/ElementsTable.tsx` |
| v0.4.26 | §10 | `server/routes/jobs.ts` |
| v0.4.27 | — | `src/components/TemplateList.tsx`, `TemplateEditorModal.tsx` |
| v0.4.28 | §4 | `src/components/ElementsTable.tsx`, `TemplateEditorModal.tsx` |
