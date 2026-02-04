---
tags:
  - architecture
  - documentation
  - workflow
---

# Documentation Derivation Strategy

This document describes the hierarchical relationship between documentation artifacts and how they can be derived from source documents using Claude Code.

---

## Problem Statement

When both UX designer and developer use Claude Code, a key question arises:

> How can Claude Code generate component stories and implementation code if the design documentation doesn't contain TypeScript types?

The answer: **establish a clear derivation hierarchy** where domain concepts flow into technical specifications.

---

## Documentation Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: Source of Truth (Human-Authored)                              │
│  ─────────────────────────────────────────                              │
│  These documents are written by humans and define the domain.           │
│  They use natural language and domain vocabulary.                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  docs/domain-model/                    docs/requirements/               │
│  ─────────────────                     ──────────────────               │
│  domain-vocabulary.md                  user-stories.md                  │
│  business-rules.md                     acceptance-criteria.md           │
│  workflow-definitions.md                                                │
│                                                                         │
│  Answers: "What concepts exist?"       Answers: "What should happen?"   │
│           "What are the rules?"                 "What can users do?"    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: Derived Specifications (Generated, Human-Editable)            │
│  ───────────────────────────────────────────────────────────            │
│  These documents are derived from Layer 1 by Claude Code.               │
│  They add technical precision while remaining editable.                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  packages/types/                       docs/ux-ui/specifications/       │
│  ──────────────                        ───────────────────────          │
│  index.ts                              component-api.md                 │
│  (TypeScript interfaces)               (Props documentation)            │
│                                                                         │
│  Derived from:                         Derived from:                    │
│  - domain-vocabulary.md                - domain-vocabulary.md           │
│                                        - user-stories.md                │
│                                        - packages/types/                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: UX Component Documentation (Designer Perspective)             │
│  ──────────────────────────────────────────────────────────             │
│  Visual and behavioral specifications for components.                   │
│  Focus on WHAT, not HOW.                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  docs/ux-ui/05-components/                                              │
│  ─────────────────────────                                              │
│  tile-component.md                                                      │
│  job-card-component.md                                                  │
│  scheduling-grid.md                                                     │
│                                                                         │
│  Contains:                             References:                      │
│  - Visual anatomy                      - domain-vocabulary.md terms     │
│  - States and transitions              - component-api.md props         │
│  - Interaction patterns                                                 │
│  - Color and dimension specs                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: Implementation (Code)                                         │
│  ──────────────────────────────                                         │
│  Actual React components and Storybook stories.                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  apps/web/src/components/              apps/web/src/components/         │
│  ────────────────────────              ────────────────────────         │
│  Tile/Tile.tsx                         Tile/Tile.stories.tsx            │
│                                                                         │
│  Derived from:                         Derived from:                    │
│  - component-api.md (props)            - component-api.md (props)       │
│  - 05-components/*.md (behavior)       - 05-components/*.md (states)    │
│  - packages/types/ (types)             - design-tokens.md (colors)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Derivation Flow

### From Domain Vocabulary to TypeScript Types

**Input:** `docs/domain-model/domain-vocabulary.md`

```markdown
## Job

- **Definition:** A complete print order...
- **Typical fields:**
  - `reference` – order reference
  - `client` – customer name
  - `color` – hex color string
  - `departureDate` – workshop exit date
```

**Output:** `packages/types/index.ts`

```typescript
interface Job {
  id: string;
  reference: string;
  client: string;
  color: string;
  departureDate?: string;
}
```

### From Domain + User Stories to Component API

**Input:** `docs/domain-model/domain-vocabulary.md`

```markdown
## Tile

- **Definition:** The visual representation of an assignment...
- **Visual elements:** Setup/run sections, Job reference, Completion checkbox
- **Related terms:** Assignment, Job
```

**Input:** `docs/requirements/user-stories.md`

```markdown
### US-TILE-001
> As a scheduler, I want to click a tile to select its job...
```

**Output:** `docs/ux-ui/specifications/component-api.md`

```typescript
interface TileProps {
  assignment: TaskAssignment;  // ← from "Related terms"
  job: Job;                    // ← from "Related terms"
  isSelected?: boolean;        // ← from user story
  onSelect?: (jobId: string) => void;
}
```

### From Component API to Stories

**Input:** `docs/ux-ui/specifications/component-api.md` + `docs/ux-ui/05-components/tile-component.md`

**Output:** `apps/web/src/components/Tile/Tile.stories.tsx`

```typescript
export const Default: Story = {
  args: {
    assignment: createAssignment(),
    job: createJob('#A855F7'),
  },
};

export const Selected: Story = {
  args: {
    ...Default.args,
    isSelected: true,  // ← from component-api.md props
  },
};

export const Completed: Story = {
  // ← from tile-component.md "Visual States" section
};
```

---

## Workflow: Designer and Developer with Claude Code

### Designer Workflow

1. **Update source documents** (Layer 1)
   - Edit `domain-vocabulary.md` with new concepts
   - Add user stories in `user-stories.md`

2. **Request derivation**
   ```
   "Update component-api.md based on the new Tile fields
   I added to domain-vocabulary.md"
   ```

3. **Write component specs** (Layer 3)
   - Create/update `05-components/tile-component.md`
   - Reference domain terms and component-api props

4. **Review in Storybook**
   ```
   "Generate stories for the new Tile states I documented"
   ```

### Developer Workflow

1. **Read specifications**
   ```
   "What props does the Tile component need?
   Check component-api.md and tile-component.md"
   ```

2. **Implement component**
   ```
   "Implement Tile.tsx based on the component-api.md interface"
   ```

3. **Create stories**
   ```
   "Generate Tile.stories.tsx showing all states
   from tile-component.md"
   ```

4. **Verify in Storybook**
   - Visual check against design specs
   - Interactive testing of states

---

## Key Principles

### 1. Domain Vocabulary is the Shared Language

Both designer and developer reference the same domain terms. When the designer says "Job color", both know it means `Job.color: string` (hex format).

### 2. Component Specs Don't Contain TypeScript

The `05-components/tile-component.md` describes:
- Visual anatomy
- States and behaviors
- Interactions

But NOT:
- TypeScript interfaces
- React props

That's what `component-api.md` is for.

### 3. Derived Documents Allow Human Edits

Generated sections are marked:

```markdown
<!-- AUTO-GENERATED from domain-vocabulary.md -->
interface Job { ... }
<!-- END AUTO-GENERATED -->

<!-- MANUAL ADDITIONS -->
// Custom validation logic
<!-- END MANUAL -->
```

Re-generation preserves manual sections.

### 4. Storybook is the Visual Verification

After implementation, Storybook provides:
- Visual diff against design specs
- Interactive state exploration
- Living documentation

---

## Data Requirements Section Pattern

Instead of TypeScript in component docs, use a "Data Requirements" section:

```markdown
## Data Requirements

| Data | Domain Term | Used For |
|------|-------------|----------|
| Job color | `Job.color` | Tile background, border |
| Job reference | `Job.reference` | Display text |
| Scheduled time | `TaskAssignment.scheduledStart/End` | Position, height |
| Completion status | `TaskAssignment.isCompleted` | Checkbox state |
| Setup duration | `Task.duration.setupMinutes` | Setup section height |
```

This bridges design and implementation without requiring TypeScript knowledge.

---

## User Stories vs UI Interaction Stories

There are two levels of user stories in this project:

### Requirements User Stories (`docs/requirements/user-stories.md`)

**Purpose:** Define WHAT the system should do (capabilities).

**Scope:** Full system (backend + frontend).

**Naming:** `US-{domain}-{number}` (e.g., US-STATION-001, US-PROVIDER-002)

**Example:**
```markdown
### US-SCHEDULE-001
> As a scheduler, I want to assign tasks to stations,
> so that I can plan production.
```

### UI Interaction Stories (`docs/ux-ui/specifications/ui-interaction-stories.md`)

**Purpose:** Define HOW users interact with the UI to achieve capabilities.

**Scope:** Frontend UI only.

**Naming:** `US-UI-{category}-{number}` (e.g., US-UI-DRAG-001, US-UI-TILE-002)

**Categories:** DRAG, TILE, QUICK, VISUAL, VALID, EDGE

**Example:**
```markdown
### US-UI-DRAG-001
> **Implements:** [US-SCHEDULE-001](../../requirements/user-stories.md#us-schedule-001)
>
> As a scheduler, I want to drag an unscheduled task from the sidebar
> and drop it onto a station column, so that I can quickly schedule new work.
```

### Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│  docs/requirements/user-stories.md                              │
│  ─────────────────────────────────                              │
│  US-SCHEDULE-001: "assign tasks to stations"                    │
│                                                                 │
│  CAPABILITY - What the user can achieve                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ implemented by
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  docs/ux-ui/specifications/ui-interaction-stories.md            │
│  ───────────────────────────────────────────────────            │
│  US-UI-DRAG-001: "drag from sidebar, drop onto column"          │
│  US-UI-QUICK-001: "Alt+Q quick placement mode"                  │
│                                                                 │
│  MECHANISM - How the capability is achieved in the UI           │
└─────────────────────────────────────────────────────────────────┘
```

One capability (US-SCHEDULE-001) can have multiple UI mechanisms:
- Drag-and-drop (US-UI-DRAG-001)
- Quick placement (US-UI-QUICK-001)
- Future: keyboard-only placement

---

## Related Documents

- [Domain Vocabulary](../domain-model/domain-vocabulary.md)
- [User Stories](../requirements/user-stories.md)
- [UI Interaction Stories](../ux-ui/specifications/ui-interaction-stories.md)
- [Component API](../ux-ui/specifications/component-api.md)
- [Git Release Strategy](git-release-strategy.md)
