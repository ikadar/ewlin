# Left Panel — Jobs List

The leftmost content column showing all jobs with their status and progress.

---

## Overview

The Jobs List provides job context — what the user can work on. It displays all jobs organized by status, with problematic jobs prominently shown at the top.

---

## Structure

```
+------------------------+
|  [+] Add Job   [Search]|
+------------------------+
|  PROBLEMS (2)          |
|  [Late job card]       |
|  [Conflict job card]   |
+------------------------+
|  JOBS                  |
|  [Job card]            |
|  [Job card - selected] |
|  [Job card]            |
|  ...                   |
+------------------------+
```

---

## Header

### Add Job Button

- **Position:** Top-left of the panel
- **Icon:** Plus icon
- **Action:** Opens job creation modal

### Search Field

- **Position:** Top-right of the panel
- **Placeholder:** "Rechercher..." (Search)
- **Filters by:** Reference, client name, description
- **Behavior:** Real-time filtering as user types

---

## Problems Section

Jobs with issues appear at the **top** of the list, visually separated.

### Section Header

```html
<span class="text-red-400/80 uppercase tracking-wider">Problèmes</span>
<span class="text-zinc-600">2</span>  <!-- count -->
```

### Problem Types

| Type | Visual | Icon |
|------|--------|------|
| **Late** (En retard) | Red background, red border | `alert-circle` |
| **Conflict** (Conflit) | Amber background, amber border | `shuffle` |

### Late Job Card

```html
<div class="bg-red-500/10 border border-red-500/20">
  <span class="font-mono text-red-300">12342</span>
  <span class="text-zinc-300">AXA</span>
  <i data-lucide="alert-circle" class="text-red-400"></i>
  <div>Contrat assurance habitation</div>
  <span class="text-red-400">En retard</span>
</div>
```

### Conflict Job Card

```html
<div class="bg-amber-500/10 border border-amber-500/20">
  <span class="font-mono text-amber-300">12341</span>
  <span class="text-zinc-300">Michelin</span>
  <i data-lucide="shuffle" class="text-amber-400"></i>
  <div>Guide vert Bretagne</div>
  <span class="text-amber-400">Conflit</span>
</div>
```

---

## Jobs Section

Regular jobs listed below the problems section.

### Section Header

```html
<span class="text-zinc-500 uppercase tracking-wider">Travaux</span>
```

### Job Card Content

| Element | Description |
|---------|-------------|
| **Reference** | Job reference number (monospace) |
| **Client** | Client name (truncated) |
| **Description** | Job description (truncated) |
| **Deadline indicator** | Date shown on right if approaching |
| **Progress dots** | Task completion visualization |

### Progress Dots

Small circles showing task completion status:

```html
<div class="flex gap-1">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>  <!-- completed -->
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>  <!-- completed -->
  <span class="w-1.5 h-1.5 rounded-full border border-zinc-700"></span>  <!-- pending -->
  <span class="w-1.5 h-1.5 rounded-full border border-zinc-700"></span>  <!-- pending -->
</div>
```

- **Filled green (bg-emerald-500):** Task completed
- **Empty outline (border-zinc-700):** Task pending

Number of dots = number of tasks in the job.

---

## Visual States

### Normal Job Card

```html
<div class="rounded-lg cursor-pointer hover:bg-white/5">
```

### Selected Job Card

```html
<div class="rounded-lg bg-white/10 border border-white/10">
```
- Lighter text colors
- Background highlight
- Border visible

---

## Interactions

| Action | Result |
|--------|--------|
| **Click job** | Select job (highlights, shows details in Job Details Panel) |
| **Keyboard ↑/↓** | Navigate between jobs |
| **Type in search** | Filter jobs in real-time |
| **Click Add Job** | Opens job creation modal |

---

## Panel Behavior

| Feature | Behavior |
|---------|----------|
| Width | Fixed (w-72 / 288px) |
| Scrollable | Yes (overflow-y-auto) |
| Collapsible | TBD |

---

## Related Documents

- [Job Navigation](../03-navigation/job-navigation.md) — Keyboard navigation
- [Job Details Panel](job-details-panel.md) — Selected job details
- [Conflict Indicators](../04-visual-feedback/conflict-indicators.md) — Problem types
