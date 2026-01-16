# Brainstorm: Job Element Data Model

**Date**: 2026-01-16
**Participants**: User, Carson (facilitator)
**Status**: Ready for architecture review

---

## Context

The current data model represents jobs with a linear sequence of tasks:

```
Job → Task1 → Task2 → Task3 (strict sequence)
```

However, the real business model is more complex:

```
Job → Elements → Tasks
         ↓
    (precedences between elements)
```

### What is an Element?

An **Element** represents a segment of the production process. It can be:

- **A physical part** of the final product (e.g., cover, interior of a brochure)
- **A process step** (e.g., assembly, finishing)

Elements have:
- A **suffix** for identification (e.g., `couv`, `int`, `fin`)
- A **strict internal task sequence** (tasks within an element are always sequential)
- **Optional precedence rules** with other elements

### Example: Brochure Job

```
Job: Brochure 2026-0042
├── Element "couv" (Cover)
│   └── T1 → T2 → T3 (strict sequence)
├── Element "int" (Interior)
│   └── T1 → T2 (strict sequence)
└── Element "fin" (Finishing)
    └── T1 → T2 (strict sequence)
    └── Prerequisites: [couv, int]
```

Key insight: **Cover and Interior can be processed in parallel**, while Finishing must wait for both to complete.

---

## UI Decisions

### 1. JobDetailsPanel

**Layout**: Elements stacked vertically (no tabs), each with its tasks listed below.

```
┌─────────────────────────────────────┐
│ Job 2026-0042 - Brochure            │
│ Sortie: 24 jan 2026                 │
├─────────────────────────────────────┤
│ ─── COUV ───────────────────────── │
│  ┌────────────────────────────────┐ │
│  │ ○ Impression Komori     1h30   │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ ○ Découpe Polar         0h45   │ │
│  └────────────────────────────────┘ │
│                                     │
│ ─── INT ────────────────────────── │
│  ┌────────────────────────────────┐ │
│  │ ✓ Impression Xerox      1h00   │ │
│  └────────────────────────────────┘ │
│  ┌────────────────────────────────┐ │
│  │ ○ Pliage Stahl          1h15   │ │
│  └────────────────────────────────┘ │
│                                     │
│ ─── FIN ─────────────── <Workflow /> couv int │
│  ┌────────────────────────────────┐ │
│  │ ○ Assemblage Horizon    0h45   │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Element header format**:
- Suffix as title (e.g., `COUV`, `INT`, `FIN`)
- Prerequisites shown on the right: `<Workflow />` icon + list of required element suffixes
- Lucide icon: **Workflow**

**Task display**: Same as current (duration visible, clickable for Pick & Place)

---

### 2. Scheduling Grid (Tiles)

**Element suffix displayed as badge** on each tile:

```
┌─────────────────────────┐
│ 2026-0042        [couv] │
│ █████████████           │
└─────────────────────────┘
```

**Badge styling** (Tailwind):
```tsx
<span className="bg-black/50 rounded-sm px-1 text-xs">
  {element.suffix}
</span>
```

- `border-radius`: small (`rounded-sm`)
- `border`: none
- `background`: semi-opaque black (`bg-black/50`)
- `text color`: inherit from card title

---

### 3. Precedence Rules

#### Principle

- **No placement restrictions** - user can place any task freely
- **Precedence bounds are calculated** based on what's placed
- **Conflicts shown as warnings** in the existing conflict list (same type as current precedence conflicts)

#### Bound Calculation

**Two types of precedence:**

| Type | Applies to | Bound calculation |
|------|------------|-------------------|
| **Intra-element** | All tasks except first in element | `end of previous task in same element` |
| **Inter-element** | First task of element only | `MAX(end of last task of each prerequisite element)` |

**Example:**

| Task | Bound |
|------|-------|
| COUV.T1 | none |
| COUV.T2 | end of COUV.T1 |
| COUV.T3 | end of COUV.T2 |
| INT.T1 | none |
| INT.T2 | end of INT.T1 |
| **FIN.T1** | **MAX(end of COUV.T3, end of INT.T2)** |
| FIN.T2 | end of FIN.T1 |

**Important**: Inter-element precedence only affects the **first task** of the dependent element. Subsequent tasks only consider intra-element precedence.

#### Conflict Handling

- If a task is placed before its precedence bound → **warning displayed in conflict list**
- Same conflict type as existing `PrecedenceConflict`
- User can choose to ignore the warning

---

## Data Model (For Architecture Discussion)

### Current Model (assumed)

```typescript
interface Job {
  id: string;
  reference: string;
  taskIds: string[];
  // ...
}

interface Task {
  id: string;
  jobId: string;
  sequenceOrder: number;
  // ...
}
```

### Proposed Model

```typescript
interface Job {
  id: string;
  reference: string;
  elementIds: string[];  // replaces taskIds
  // ...
}

interface Element {
  id: string;
  jobId: string;
  suffix: string;                    // "couv", "int", "fin"
  label?: string;                    // "Couverture" (optional, for display)
  prerequisiteElementIds: string[];  // e.g., ["elem-couv", "elem-int"]
  taskIds: string[];
}

interface Task {
  id: string;
  elementId: string;    // replaces jobId
  sequenceOrder: number;
  // ...
}
```

### Decisions Made

1. **Task.jobId**: Winston (architect) will decide whether to keep `jobId` on Task in addition to `elementId`

2. **Single-element jobs**: Element has a suffix (e.g., "ELT") but badge is NOT displayed on tiles for single-element jobs

3. **Entity naming**: Confirmed as "Element"

4. **Migration strategy**: Not applicable - starting fresh with mock data

---

## Summary

| Aspect | Decision |
|--------|----------|
| JobDetailsPanel layout | Elements stacked, no tabs |
| Precedence indicator | Workflow icon + suffix list, right-aligned |
| Tile badge | Suffix in `bg-black/50 rounded-sm` badge (multi-element jobs only) |
| Single-element jobs | Have suffix but badge NOT displayed |
| Placement | Free, no restrictions |
| Precedence validation | Soft (warnings only) |
| Conflict type | Reuse existing PrecedenceConflict |
| Inter-element precedence | First task of element only |
| Entity name | Element |

---

## Next Steps

1. **Architecture review** - Validate data model with architect (Winston)
2. **API design** - Define endpoints for elements CRUD
3. **Migration plan** - Strategy for existing data
4. **Implementation** - Start with JobDetailsPanel, then grid, then precedence logic
