# Feature Catalog Planning

> **Status:** Planning
>
> **Created:** 2026-02-03
>
> **Purpose:** This document records the planning decisions and approach for creating the Feature Catalog.

---

## 1. Objective

Before creating the Manual QA Plan, a **Feature Catalog** is needed, which contains all active features of the application. The catalog is the "Single Source of Truth" for features, and the Manual QA Plan is derived from it.

The Feature Catalog can also be used for other purposes:
- Onboarding documentation
- Product overview
- Release notes generation

---

## 2. Feature Catalog Structure

**Location:** `docs/features/feature-catalog.md`

| Field | Description |
|-------|-------------|
| Feature ID | Unique identifier (e.g., `SCHED-001`, `JCF-015`, `API-003`) |
| Feature Name | Short, descriptive name |
| Description | Capability format (see below) |
| Status | `Active` / `Suspicious` / `Deprecated` |
| Release Version | Which version it was introduced in |
| QA Document | Link to the related QA document |

---

## 3. Feature Description Format

We use a **two-level approach** for describing features.

### Catalog Level (quick overview)

**Format:** Capability – 1 short sentence, max 10-15 words

**Goal:** Quickly scannable list

**Example:**
```markdown
| ID | Feature | Description |
|----|---------|-------------|
| SCHED-012 | Context Menu | Right-click context menu on tiles (view details, toggle completion, swap position) |
| JCF-008 | Papier Autocomplete | Two-step paper selection: type first, then grammage |
```

### QA Document Level (detailed)

**Format:** User Story + Acceptance Criteria

**Goal:** Tester clearly understands what and why they are testing

**Example:**
```markdown
## Feature: Context Menu

### User Story

As a scheduler, I want to right-click on a tile to access common actions,
so that I can quickly view details, mark completion, or reorder tiles
without using drag & drop.

### Acceptance Criteria

- [ ] Right-click opens menu at cursor position
- [ ] Menu shows: Voir détails, Marquer terminé, Déplacer vers le haut/bas
- [ ] Menu closes on click outside / ESC / scroll
- [ ] Move up/down disabled if no adjacent tile exists
```

---

## 4. Input Sources

The following sources are used to create the Feature Catalog:

### 4.1 Release Documents

- **Location:** `docs/releases/v*.md`
- **Content:** Feature descriptions, Manual QA plans, scope definitions
- **Note:** 91 release documents contain Manual QA sections

### 4.2 Playwright E2E Tests

- **Location:** `apps/web/playwright/*.spec.ts`
- **Content:** Automated test scenarios
- **Usage:** Feature existence verification, test scenario identification

---

## 5. Deprecated Feature Handling

Later releases may override earlier features. Deprecated features are marked with `Deprecated` status in the catalog and are **not** included in the Manual QA Plan.

### Identification Methods

| Method | Description | Reliability |
|--------|-------------|-------------|
| **Code check** | Does the component/file still exist in the codebase? | High |
| **Playwright test** | Is there an active E2E test for the feature? | Medium |
| **Later release doc** | Does a later release mention that it was overridden/deleted? | Medium |
| **"Out of Scope" sections** | Does a later release explicitly exclude it? | Low |
| **User review** | User indicates during review | High |

### Verification Workflow (for each feature)

```
Feature identified (from release doc)
         │
         ▼
┌────────────────────────────────┐
│ 1. Does the component/file    │ ──No──→ DEPRECATED
│    exist?                      │
└────────────────────────────────┘
         │ Yes
         ▼
┌────────────────────────────────┐
│ 2. Is there an active         │ ──No──→ ⚠️ SUSPICIOUS
│    Playwright test?           │
└────────────────────────────────┘
         │ Yes
         ▼
┌────────────────────────────────┐
│ 3. Did a later release        │ ──Yes─→ DEPRECATED
│    override it?               │
└────────────────────────────────┘
         │ No
         ▼
      ✅ ACTIVE
```

### Statuses

| Status | Meaning | Included in QA Plan? |
|--------|---------|---------------------|
| `Active` | Working, tested feature | ✅ Yes |
| `Suspicious` | Suspicious (no test, but code exists) | ⚠️ Decision after review |
| `Deprecated` | Overridden or removed | ❌ No |

---

## 6. Workflow

### Granularity: Hybrid Approach

The Feature Catalog is created **Phase-based**, but large phases are **further divided** (~10-15 releases / batch).

### Batches

| Batch | Phase | Focus | Releases | Size |
|-------|-------|-------|----------|------|
| **B1** | 1A | Station Management API | v0.1.0 - v0.1.7 | 8 |
| **B2** | 1B | Job Management API | v0.1.9 - v0.1.19 | 11 |
| **B3** | 2B + 2C | Validation & Assignment API | v0.2.7 - v0.2.18 | 12 |
| **B4** | 3A + 3B + 3C | Mock Data, Layout, Grid | v0.3.0 - v0.3.10 | 11 |
| **B5** | 3D-3F | Drag & Drop basics | v0.3.11 - v0.3.20 | 10 |
| **B6** | 3G-3H | Station compact, Fixes | v0.3.21 - v0.3.33 | 13 |
| **B7** | 3I-3J | Navigation, Layout, UX | v0.3.34 - v0.3.46 | 13 |
| **B8** | 3K-3L | DateStrip, Validation, Pick&Place | v0.3.47 - v0.3.60 | 14 |
| **B9** | 4A-4C | Element layer, JCF basics | v0.4.0 - v0.4.12 | ~12 |
| **B10** | 4D-4F | JCF Autocomplete fields | v0.4.13 - v0.4.24 | ~12 |
| **B11** | 4G-4H | JCF Validation, Templates, API | v0.4.25 - v0.4.40 | ~12 |

> **Note:** Batch boundaries can be refined during actual review.

### Workflow (per batch)

```
┌────────────────────────────────────────────────────────────────┐
│  Processing Batch N                                             │
├────────────────────────────────────────────────────────────────┤
│  1. Review release documents (given batch)                      │
│  2. Review Playwright tests (related)                           │
│  3. Create feature list draft                                   │
│  4. Identify deprecated features                                │
├────────────────────────────────────────────────────────────────┤
│  → USER REVIEW                                                  │
│    - Is anything missing?                                       │
│    - Are the feature descriptions correct?                      │
│    - Is there a deprecated feature I missed?                    │
├────────────────────────────────────────────────────────────────┤
│  5. Batch finalization → Into Feature Catalog                   │
│  → Next batch                                                   │
└────────────────────────────────────────────────────────────────┘
```
