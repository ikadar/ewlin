# Anatomy of a Job

This document explains how print jobs are structured in the Flux Scheduler system — from the top-level job down to individual tasks on machines.

---

## The Hierarchy

A job follows a three-tier structure:

```
Job
├── Element A ("COUV" — cover)
│   ├── Task 1  →  G37(20+40)
│   ├── Task 2  →  P137(10+5)
│   └── Task 3  →  Stahl(15+30)
├── Element B ("INT" — interior)
│   ├── Task 1  →  G37(15+60)
│   ├── Task 2  →  P137(10+5)
│   ├── Task 3  →  Stahl(10+45)
│   └── Task 4  →  H(10+20)
└── Element C ("FIN" — finishing)
    └── Task 1  →  ST:MCA(2j):pelliculage
```

**Job** = A complete print order for a client, with a deadline.
**Element** = A physical component of the finished product (cover, interior, insert, etc.).
**Task** = A single production operation on a specific machine or outsourced to a provider.

---

## Job

A job represents a customer order that needs to go through the workshop and be delivered by a specific date.

### Key properties

| Property | Description |
|----------|-------------|
| `reference` | Order reference (e.g., `"ORD-2024-0142-A"`). User-editable for managing order lines. |
| `client` | Customer name. |
| `description` | Product description (e.g., "Brochure A4 48 pages"). |
| `workshopExitDate` | **Deadline** — the date the job must leave the factory. |
| `status` | Lifecycle state (see below). |
| `quantity` | Total print run (number of finished products). |
| `color` | Randomly assigned at creation for visual identification on the scheduling grid. |
| `requiredJobIds` | Other jobs that must finish before this one can start. |
| `shipper` | Transport company for delivery (optional). |

### Job lifecycle

```
Draft → Planned → InProgress → Completed
                      ↓
                   Delayed
                      ↓
                  Completed

Any state → Cancelled
```

| Status | Meaning |
|--------|---------|
| `Draft` | Job is being defined, not yet ready for scheduling. |
| `Planned` | Definition complete, ready to be placed on the schedule. |
| `InProgress` | At least one task has started execution. |
| `Delayed` | Automatic — triggers when the scheduled completion exceeds the deadline. |
| `Completed` | All tasks finished. |
| `Cancelled` | Cancelled — cascades to all incomplete tasks. |

### Job-level dependencies

Jobs can depend on other jobs via `requiredJobIds`. This is a **finish-to-start** dependency: all tasks of the required job must complete before the first task of the dependent job can start.

- No circular dependencies allowed.
- Dependent jobs use shades of the same base color for visual grouping on the grid.

---

## Element

An element is a physical part of the finished product. Every job has at least one element.

### Why elements?

A simple flyer has a single element — just one piece of paper going through the press. But a brochure has a **cover** and an **interior**, each going through different machines with different paper, then assembled together. A book might have even more: cover, text block, dust jacket, inserts.

Each element has its own production sequence (list of tasks), its own paper, its own specs.

### Common element names

| Name | Meaning |
|------|---------|
| `COUV` | Couverture (cover) |
| `INT` | Intérieur (interior / text block) |
| `ELT` | Default name for single-element jobs |
| `INSERT` | An insert or encart |
| `FIN` | Finishing element |

### Production specifications (spec)

Each element carries metadata about its production:

| Field | Format | Example | Description |
|-------|--------|---------|-------------|
| `format` | ISO name or WxH mm | `"A4"`, `"210x297"` | Product format |
| `papier` | `Type:Grammage` | `"Couché mat:135"` | Paper type and weight |
| `pagination` | Integer (2 or ×4) | `48` | Page count |
| `imposition` | `LxH(poses)` | `"50x70(8)"` | Sheet layout |
| `impression` | `recto/verso` | `"Q/Q"` | Printing spec (colors per side) |
| `surfacage` | `recto/verso` | `"mat/mat"` | Finishing/coating |
| `quantite` | Integer | `5000` | Element-level quantity |
| `qteFeuilles` | Integer | `625` | Sheet count (calculated) |

### Element dependencies (within a job)

Elements within the same job can depend on each other via `prerequisiteElementIds`. This is **finish-to-start**: all tasks of the prerequisite element must complete before the dependent element's first task can start.

```
COUV (cover)  ──────→ FIN (finishing/binding)
INT (interior) ─────↗
```

In this example, the finishing element depends on both COUV and INT. Binding can't start until both the cover and interior are printed and folded.

- Only elements within the same job can have dependencies.
- No circular dependencies (elements form a DAG).
- **Dry time rule:** If the last task of a prerequisite element is on an offset press, the dependent element must wait an additional **4 hours** of drying time before it can start.

### Element prerequisites (production readiness)

Before an element can go into production, certain prerequisites may need to be met:

| Prerequisite | Statuses | Ready when |
|-------------|----------|------------|
| **Paper** | `none` → `in_stock` → `to_order` → `ordered` → `delivered` | `none`, `in_stock`, or `delivered` |
| **BAT** (Bon à Tirer — proof approval) | `none` → `waiting_files` → `files_received` → `bat_sent` → `bat_approved` | `none` or `bat_approved` |
| **Plates** (printing plates) | `none` → `to_make` → `ready` | `none` or `ready` |
| **Forme** (die-cutting tool) | `none` → `in_stock` → `to_order` → `ordered` → `delivered` | `none`, `in_stock`, or `delivered` |

An element is **blocked** if any prerequisite is not in a ready state. Blocked elements show a dashed border on the scheduling grid as a visual warning (scheduling is still allowed in MVP).

---

## Task

A task is a single production step performed on a machine or by an external provider.

### Task types

**Internal task** — performed on a station in the workshop:
```
G37(20+40)
```
- Station: G37 (offset press)
- Setup: 20 minutes
- Run: 40 minutes
- Total: 60 minutes

**Outsourced task** — sent to an external provider:
```
ST:MCA(2j):pelliculage
```
- Provider: MCA
- Action: pelliculage (lamination)
- Duration: 2 open days (business days, Mon–Fri)

### Task sequence

Tasks within an element follow a **strict linear sequence**. Task 2 cannot start before Task 1 completes. Task 3 cannot start before Task 2 completes. And so on.

```
Element "COUV":
  Task 1: G37(20+40)         ← print
  Task 2: P137(10+5)         ← cut (waits for Task 1)
  Task 3: Stahl(15+30)       ← fold (waits for Task 2)
```

There is no parallelism within an element. If you need parallel production paths, use separate elements.

### Task lifecycle

```
Defined → Ready → Assigned → Executing → Completed
                                ↓
                              Failed

Any non-terminal state → Cancelled
```

| Status | Meaning |
|--------|---------|
| `Defined` | Created, not yet ready. |
| `Ready` | All dependencies satisfied, can be scheduled. |
| `Assigned` | Placed on the schedule with a time slot. |
| `Executing` | Currently in progress on the machine. |
| `Completed` | Finished. |
| `Failed` | Error during execution. |
| `Cancelled` | Cancelled (typically via job cancellation). |

### Dry time

When a task is performed on an **offset press** (category `cat-offset`), the next task — whether in the same element or in a dependent element — must wait **4 hours** for ink drying. This drying continues outside working hours (it's a physical process, not constrained to the operating schedule).

---

## Stations (postes)

A station is a physical machine in the workshop. Each station belongs to a **category** (what type of work it does) and a **group** (capacity constraints).

### Station categories

| Category | Example stations | Work type |
|----------|-----------------|-----------|
| Presse offset | G37, 754, GTO | Offset printing |
| Presse numérique | C9500 | Digital printing |
| Massicot | P137, VM | Cutting |
| Typo | SBG, SBB | Typography / die-cutting |
| Plieuse | Stahl, MBO, Horizon | Folding |
| Encarteuse-piqueuse | H | Saddle-stitching |
| Assembleuse-piqueuse | Duplo10, Duplo20 | Collating and stitching |
| Conditionnement | Carton, Film | Packaging |

### Operating schedule

Each station has a weekly operating schedule defining when it's available. Tasks scheduled during downtime are **stretched** across the gap:

```
Example: Station operates 08:00–18:00
Task starts at 16:00, needs 3 hours of work.
→ Works 2h (16:00–18:00), overnight gap, works 1h (08:00–09:00 next day)
→ Effective end: 09:00 next day
```

Schedule exceptions (holidays, maintenance) can override the regular pattern for specific dates.

### Capacity

Most stations have **capacity = 1** — only one task at a time. When a tile is placed between existing tiles on a capacity-1 station, subsequent tiles are pushed down automatically.

Station **groups** enforce aggregate capacity. For example, a group of 3 finishing stations with `maxConcurrent = 2` means at most 2 of the 3 can be active simultaneously.

### Similarity indicators

When consecutive tasks on the same station share characteristics (same paper type, same format, same weight, same inking), **setup time can potentially be reduced**. The UI shows filled/hollow circles between tiles to indicate matching criteria.

---

## Outsourced Providers (sous-traitants)

External companies that perform specialized work outside the workshop.

| Provider | Description |
|----------|-------------|
| MCA | External finishing |
| F37 | External services |
| LGI | External services |
| AVN | External services |
| JF | External services |

### Key differences from stations

| Aspect | Station | Provider |
|--------|---------|----------|
| Capacity | Usually 1 | **Unlimited** — multiple tasks can overlap |
| Duration unit | **Minutes** (setup + run) | **Open days** (business days) |
| Location | In the workshop | External |
| Scheduling | Respects operating hours | Uses departure/reception times |

### Outsourced task timing

Each provider has:
- **Latest departure time** (e.g., 14:00) — if work is sent after this time, the lead time starts the next business day.
- **Reception time** (e.g., 09:00) — when completed work arrives back.
- **Transit days** — business days for transport.

Example: Task sent to MCA at 15:00 on Monday with `latestDepartureTime = 14:00` and `2JO`:
- Missed Monday cutoff → effective start is Tuesday
- 2 open days: Tuesday + Wednesday
- Work returns Thursday at reception time

---

## Putting It All Together — Example

**Job: "Catalogue produits 48 pages" for Hachette Livre**
- Reference: `ORD-2024-0142`
- Deadline: April 15, 2026
- Quantity: 5,000

```
Job ORD-2024-0142
│
├── Element "COUV" (Cover)
│   Paper: Couché mat 135g, Format: A4, Impression: Q/Q, Surfacage: mat/mat
│   Imposition: 50x70(8), Pagination: 4 pages
│   Prerequisites: Paper ✓ delivered, BAT ✓ approved, Plates ✓ ready
│   │
│   ├── Task 1: G37(20+40)            ← Offset print (20 min setup, 40 min run)
│   ├── Task 2: P137(10+5)            ← Cut (10 min setup, 5 min run)
│   └── Task 3: Stahl(15+30)          ← Fold (15 min setup, 30 min run)
│
├── Element "INT" (Interior) — depends on nothing
│   Paper: Offset 80g, Format: A4, Impression: Q/Q
│   Imposition: 65x90(16), Pagination: 48 pages
│   │
│   ├── Task 1: G37(15+60)            ← Offset print
│   ├── Task 2: P137(10+5)            ← Cut
│   ├── Task 3: Stahl(10+45)          ← Fold
│   └── Task 4: H(10+20)              ← Saddle-stitch
│
└── Element "FIN" (Finishing) — depends on COUV + INT
    │
    ├── Task 1: ST:MCA(2j):pelliculage     ← External lamination (2 business days)
    └── Task 2: Film(10+15)                ← Shrink-wrap packaging
```

**Scheduling flow:**
1. COUV and INT can be produced **in parallel** (no dependency between them).
2. After COUV's last task on G37, there's a **4-hour dry time** before FIN can start.
3. After INT's last task (H), FIN must also wait for completion.
4. FIN waits for **both** COUV and INT (plus dry time from whichever offset press task finishes last).
5. The outsourced pelliculage at MCA takes 2 business days.
6. Final packaging on Film station.
7. Everything must be done by April 15, 2026.

---

## Summary of Relationships

```
┌─────────────────────────────────────────────┐
│                  Schedule                    │
│                                             │
│  ┌─────────┐    requiredJobIds    ┌──────┐  │
│  │  Job A  │ ──────────────────→  │Job B │  │
│  └────┬────┘                      └──┬───┘  │
│       │ 1:N                          │      │
│  ┌────┴──────────────┐          ┌────┴───┐  │
│  │ Element    Element │          │Element │  │
│  │ "COUV"     "INT"  │          │ "ELT"  │  │
│  └──┬────────────┬───┘          └───┬────┘  │
│     │prerequisite│                  │       │
│     │ ElementIds │                  │       │
│     ▼            ▼                  │       │
│  ┌──────────────────┐               │       │
│  │ Element "FIN"    │               │       │
│  └────┬─────────────┘               │       │
│       │ 1:N                    1:N  │       │
│  ┌────┴────┐                ┌───┴───┐       │
│  │  Tasks  │                │ Tasks │       │
│  │ (seq.)  │                │(seq.) │       │
│  └────┬────┘                └───┬───┘       │
│       │                        │            │
│       ▼                        ▼            │
│  ┌─────────┐  ┌──────────┐  ┌────────┐     │
│  │Station  │  │Station   │  │Provider│     │
│  │(internal)│ │(internal)│  │(outsrc)│     │
│  └─────────┘  └──────────┘  └────────┘     │
└─────────────────────────────────────────────┘
```

| Relationship | Cardinality | Rule |
|-------------|-------------|------|
| Job → Elements | 1 to many (≥1) | Every job has at least one element |
| Element → Tasks | 1 to many (≥1) | Every element has at least one task |
| Element → Element | Many to many (same job) | finish-to-start, no cycles |
| Job → Job | Many to many | finish-to-start, no cycles |
| Task → Station | Many to 1 | Internal tasks only |
| Task → Provider | Many to 1 | Outsourced tasks only |
