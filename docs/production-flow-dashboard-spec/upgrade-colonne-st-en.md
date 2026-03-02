# Upgrade — Subcontracting Column (ST)

**Status:** Specification
**Date:** 2026-03-02
**Prerequisite:** Tableau de Flux implemented per `tableau-de-flux.md` specification (mockup.html)

---

## 1. Summary

Add an **ST** (Sous-traitance / Subcontracting) column to the production flow table, positioned between the last station column (Cond.) and the Transporteur column. This column tracks tasks delegated to external suppliers, using a 3-state checkbox system (pending / in progress / done). A new "S-T a faire" filter tab is added to the tab bar.

---

## 2. Column Inventory Changes

The ST column is inserted at position **19** (between Cond. and Transp.). Subsequent columns shift:

| # | Column | Before | After |
|---|--------|--------|-------|
| 19 | **ST** | _(did not exist)_ | **New** — 160px max |
| 20 | Transp. | was #19 | shifted |
| 21 | Parti | was #20 | shifted |
| 22 | Actions | was #21 | shifted |

**Header:** "ST" — no additional tooltip.

---

## 3. Data Model

### 3.1 Structure

Each job can have zero or more subcontracting tasks. Each task has three fields:

```
{
  task:     string,   // Operation name (e.g., "Vernis UV selectif")
  supplier: string,   // External supplier (e.g., "Faco 37")
  status:   'pending' | 'progress' | 'done'
}
```

### 3.2 Organization by Job Type

- **Mono-element job**: flat array of items → `ST[jobId] = [ item, item, ... ]`
- **Multi-element job**: dictionary keyed by element name → `ST[jobId] = { 'Couverture': [ item ], 'Interieur': [ item ] }`
- An element may have an empty array `[]` (no subcontracting for that element)

### 3.3 Reference Data

| Job | Element | Task | Supplier | Initial status |
|-----|---------|------|----------|----------------|
| 00042 | — | Vernis UV selectif | Faco 37 | `done` |
| 00078 | Etiquette Ronde | Decoupe mi-chair | Clement | `pending` |
| 00078 | Etiquette Carree | Gaufrage logo | JF | `progress` |
| 00078 | Etiquette Ovale | _(none)_ | — | — |
| 00091 | Couverture | Pelliculage mat | SIPAP | `done` |
| 00091 | Interieur | Vernis UV | Faco 37 | `progress` |
| 00103 | — | Vernis UV | SIPAP | `done` |
| 00103 | — | Reliure Singer | Clement | `pending` |
| 00117 | — | _(none)_ | — | — |

---

## 4. Cell Rendering

### 4.1 Layout

- The `td.td-st` cell has a **max-width of 160px**
- Contains a `.st-cell` container (vertical flex, 1px gap)
- Each task is a `.st-line` row (horizontal flex) with:
  - A checkbox icon `.st-toggle` (16x16px, flex-shrink 0)
  - A label `.st-label` with overflow ellipsis

### 4.2 Text Format

Each line displays: **"Supplier · Task"**

Examples:
- `Faco 37 · Vernis UV selectif`
- `Clement · Reliure Singer`
- `SIPAP · Pelliculage mat`

### 4.3 Custom Tooltip

A **non-native** tooltip (no `title` attribute) appears on hover over each ST line:

- HTML element `<div class="st-tooltip">` positioned `fixed`, follows cursor
- Dark background (`rgb(36 36 36)`), border (`rgb(58 58 58)`), 4px border-radius
- Text 11px, color `rgb(209 209 209)`
- Drop shadow, 120ms opacity transition
- Content: full "Supplier · Task" text (same as label but untruncated)

The tooltip is triggered via a `data-tip` attribute on each `.st-line`, handled by `mouseover` / `mousemove` / `mouseout` events delegated at `document` level.

### 4.4 Empty Cell

If a job has no ST tasks (empty array), the cell remains empty — no placeholder.

---

## 5. 3-State Checkbox

### 5.1 The 3 States

| State | CSS class | Color (RGB) | SVG icon |
|-------|-----------|-------------|----------|
| `pending` (to do) | `st-pending` | 128, 128, 128 (gray) | Empty circle ○ |
| `progress` (in progress) | `st-progress` | 251, 146, 60 (orange) | Circle with center dot ⊙ |
| `done` (complete) | `st-done` | 74, 222, 128 (green) | Circle with checkmark ✓ |

### 5.2 Click Cycle

Each click advances to the next state in the cycle:

```
pending → progress → done → pending → ...
```

Implementation:

```js
var ST_CYCLE = ['pending', 'progress', 'done'];
var cur = toggle.dataset.status;
var next = ST_CYCLE[(ST_CYCLE.indexOf(cur) + 1) % 3];
```

### 5.3 SVG Icons

All 3 SVGs share the same frame: `viewBox="0 0 24 24"`, `class="w-4 h-4"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`.

- **Pending**: `<circle cx="12" cy="12" r="10">` (empty circle)
- **Progress**: `<circle cx="12" cy="12" r="10">` + `<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none">` (solid center dot)
- **Done**: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14">` + `<path d="m9 11 3 3L22 4">` (circle + checkmark, Lucide `circle-check` style)

> **Note:** The "in progress" icon does not imply partial progress. It is a simple binary indicator meaning "the task has started at the subcontractor."

### 5.4 Added CSS

```css
.st-progress { color: rgb(251 146 60); }
```

The `.st-done` and `.st-pending` classes already existed in the station theme; they are reused.

---

## 6. Multi-Element Behavior

### 6.1 Expanded Multi-Element Job

Each sub-row displays its own element's ST tasks, via `renderSTCell(items, jobId, elementName)`. The `data-element` attribute is present on the toggle to identify the element on click.

### 6.2 Collapsed Multi-Element Job

ST tasks from all elements are **flattened** into a single list via `renderFlatSTCell(jobId)`. The `data-element` attribute is not set (the handler finds the element via flat index lookup).

### 6.3 Checkbox Initialization

After each expand/collapse, `initSTCheckboxes(container)` is called on newly created ST cells to attach click handlers. A `_stInit` flag prevents double-binding.

---

## 7. New "S-T a faire" Tab

### 7.1 Position and Label

The tab is added as the **6th tab** (after "Plaques a produire"):

| # | Label | Criterion |
|---|-------|-----------|
| 6 | S-T a faire | Job has at least one ST task with `status != 'done'` |

### 7.2 Filter Logic

```js
soustraitance: function(row) { return row.dataset.stPending === 'true'; }
```

The `data-st-pending` attribute is maintained on each parent row and recalculated after each ST checkbox click via `updateSTPending(jobId)`.

**Rule:** a job is considered "ST to do" if at least one task has `status === 'pending'` **or** `status === 'progress'`. In other words, only `'done'` on all tasks removes the job from the filter.

### 7.3 URL Hash

| Hash | Tab |
|------|-----|
| `#tab=st` | S-T a faire |

### 7.4 Count Badge

The badge count is calculated like all other tabs: number of parent rows matching the filter. It updates immediately after each ST checkbox click.

### 7.5 Verification Matrix (Initial Data)

| Job | Non-done ST tasks | data-st-pending | Visible? |
|-----|------------------|-----------------|----------|
| 00042 | 0 (1 done) | false | No |
| 00078 | 2 (1 pending + 1 progress) | true | Yes |
| 00091 | 1 (1 progress) | true | Yes |
| 00103 | 1 (1 pending) | true | Yes |
| 00117 | 0 (no tasks) | false | No |

**Result: 3 visible rows** (00078, 00091, 00103).

---

## 8. Visual Preview

> See interactive file: [`mockup2.html`](mockup2.html)

**"S-T a faire" tab — 3 rows visible (00078, 00091, 00103):**

![Tab S-T a faire](screenshots/tab-st.png)

**"Tous" tab — ST column visible with all 3 states:**

![Full view](screenshots/tab-tous.png)

---

## 9. Implementation Checklist

- [ ] Add ST column to the column inventory (header `<th>`)
- [ ] Create `SOUS_TRAITANCES` data model with `task`, `supplier`, `status` fields
- [ ] Implement the 3 SVGs (pending, progress, done) and `ST_STATES` mapping
- [ ] Implement `renderSTCell()` and `renderFlatSTCell()` with "Supplier · Task" format
- [ ] Add CSS: `.st-progress`, `.st-tooltip`, `.st-label`, `td.td-st { max-width: 160px }`
- [ ] Implement custom tooltip (non-native) with `data-tip` and `fixed` positioning
- [ ] Implement 3-state click cycle (`initSTCheckboxes`)
- [ ] Maintain `data-st-pending` on parent rows (`updateSTPending`)
- [ ] Add 6th tab "S-T a faire" with its filter
- [ ] Add `#tab=st` to URL persistence
- [ ] Integrate ST checkboxes in multi-element expand/collapse
- [ ] Verify tab counts update on ST checkbox click
