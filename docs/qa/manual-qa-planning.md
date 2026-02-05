# Manual QA Planning

> **Status:** Planning
>
> **Created:** 2026-02-03
>
> **Purpose:** This document records the planning decisions and approach for creating the Manual QA Plan.
>
> **Related document:** [Feature Catalog Planning](./feature-catalog-planning.md)

---

## 1. Objective

The project is nearing completion. A comprehensive Manual QA Plan is needed that covers **all active features** of the application and provides detailed guidance for testers.

The Manual QA Plan is created based on the [Feature Catalog](../features/feature-catalog.md), which contains all active features.

---

## 2. Decisions

### Approach

The Manual QA Plan is created through **feature-based rewriting**. Existing release documents and Playwright tests serve as input sources – features and test scenarios are identified from these. However, the end result is not a simple concatenation of release documents, but a QA documentation organized into logical groups with a unified structure. This ensures consistency, avoids overlaps, and is easier to maintain than scattered per-release QA plans.

### Depth

The documentation is created at a **detailed level for testers**. Each test scenario contains preconditions, specific steps, and expected results. The goal is for a tester to be able to perform testing independently based on the documentation, without further explanation.

**Example test scenario:**

```markdown
#### Scenario: Toggle task completion via context menu

**Preconditions:**
- App loaded with `context-menu` fixture (`http://localhost:5173/?fixture=context-menu`)
- At least one tile visible on the grid
- The tile is not in completed state

**Steps:**
1. Right-click on the tile
2. Verify the context menu appears at cursor position
3. Click "Marquer terminé"

**Expected Results:**
- [ ] Context menu closes after click
- [ ] Tile shows completed state:
  - Green gradient background from left
  - Completion icon changes from `circle` to `circle-check` (emerald color)
- [ ] Job's progress indicator updates in the sidebar
```

### Scope

The Manual QA Plan covers the following areas:

- **Frontend – Scheduler UI (M3):** The main scheduler interface, including grid navigation, drag & drop operations, pick & place function, validation feedback, and other interactions.
- **Frontend – Job Creation Form (M4):** The job creation form, including the Elements table, autocomplete fields, template management, and validation.
- **Backend API (M1 + M2):** Station Management, Job Management, and Scheduling API endpoints.

---

## 3. Folder Structure

```
docs/qa/
├── feature-catalog-planning.md    # Feature catalog creation plan
├── manual-qa-planning.md          # This document (QA plan creation plan)
├── manual-qa-plan.md              # Main QA document (index + common setup)
├── scheduler/                      # M3 - Scheduler UI features
│   ├── grid-navigation.md
│   ├── drag-drop.md
│   ├── pick-place.md
│   ├── validation-feedback.md
│   └── ...
├── jcf/                           # M4 - Job Creation Form features
│   ├── elements-table.md
│   ├── autocomplete-fields.md
│   ├── templates.md
│   └── ...
└── api/                           # M1-M2 - Backend API
    ├── station-management.md
    ├── job-management.md
    ├── scheduling.md
    └── postman/
        ├── flux-api.postman_collection.json
        └── flux-api.postman_environment.json
```

---

## 4. Content Elements (for each feature)

Each Manual QA document contains the following sections:

### 4.1 Feature Overview

- User Story (detailed description)
- Acceptance Criteria

### 4.2 Test Fixtures

- Which fixture can be used for testing
- Fixture URL and short description

**Format:**
```markdown
| Fixture | URL | Description |
|---------|-----|-------------|
| `context-menu` | `?fixture=context-menu` | Multiple tiles on a station for swap testing |
```

### 4.3 Test Scenarios

For each scenario:
- **Preconditions** – prerequisites
- **Steps** – specific steps
- **Expected Results** – expected results (in checkbox format)

### 4.4 Visual Checklist

- UI element appearance
- Colors, sizes, layout

### 4.5 Edge Cases

- Edge cases
- Error states
- Empty states

### 4.6 Cross-feature Interactions

- Interaction with other features
- Integration points

---

## 5. Main Document Sections

The `manual-qa-plan.md` main document contains the following additional sections:

| Section | Description |
|---------|-------------|
| **Index** | Links to all feature QA documents |
| **Regression Test Suite** | Collection of critical happy paths |
| **Smoke Test Checklist** | Basic tests that can be run in 5-10 minutes |
| **Browser Matrix** | Supported browsers |

---

## 6. Closed Questions

### Fixture Documentation

**Decision:** Medium depth – Name, URL, short description (what it contains)

### Browser Matrix

**Decision:** Desktop only

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest | P1 |
| Firefox | Latest | P1 |
| Safari | Latest (macOS) | P2 |

> **Note:** Mobile/tablet not in scope, desktop-first application.

### API Testing Tools

**Decision:** Both – Markdown (curl examples) + Postman collection

---

## 7. Workflow

The Manual QA Plan creation starts after the Feature Catalog is finalized.

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Create Feature Catalog                                       │
│     (see: feature-catalog-planning.md)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Create Manual QA documents                                   │
│     - By feature category (scheduler, jcf, api)                  │
│     - Detailed test scenarios                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Assemble main document                                       │
│     - Index                                                      │
│     - Smoke test checklist                                       │
│     - Regression suite                                           │
└─────────────────────────────────────────────────────────────────┘
```
