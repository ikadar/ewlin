# Spec: Tab Filtering

**Status:** Draft
**Date:** 2026-03-02

---

## 1. Problem Statement

The Tableau de Flux has five tabs above the table ("Tous", "A faire prepresse", "Cdes papier", "Cdes formes", "Plaques a produire"), but only the "Tous" tab is visually active. The other four are static labels with no interaction. Users cannot quickly narrow the table to jobs that require a specific action (e.g., "which jobs still need paper ordered?").

---

## 2. Goal

Clicking any of the five tabs filters the table to show only the rows matching that tab's criterion. The active tab is visually distinguished, the count badge reflects the number of visible rows, and sub-rows follow their parent's visibility. Clicking "Tous" restores the full table.

---

## 3. Detailed Behavior

### 3.1 Tabs Definition

There are exactly 5 tabs, always visible in this order:

| # | Label | Filter criterion | Description |
|---|-------|-----------------|-------------|
| 1 | Tous | None (show all) | Default tab, no filtering |
| 2 | A faire prepresse | BAT is neither "OK" nor "n.a." | Jobs where prepress work is still pending |
| 3 | Cdes papier | Papier = "A cder" | Jobs where paper must be ordered |
| 4 | Cdes formes | Formes = "A cder" | Jobs where forme must be ordered |
| 5 | Plaques a produire | Plaques = "A faire" | Jobs where plates must be produced |

### 3.2 Filter Criteria on Multi-Element Rows

For jobs with multiple elements (multi-element rows), the filter evaluates the **aggregated worst status** of the parent row, not the individual sub-element statuses.

"Worst" follows the existing severity ranking: red > yellow > gray > green.

**Example:** A job has 2 elements. Element A has Papier = "Cde" (yellow), element B has Papier = "A cder" (red). The worst of the two is "A cder" (red > yellow), so the parent row carries Papier = "A cder". When the user clicks "Cdes papier" (which tests Papier = "A cder"), this job appears in the filtered results.

Conversely, if both elements had Papier = "Cde", the worst would be "Cde" — the job would **not** appear under "Cdes papier".

The same principle applies to all four prerequisite columns. The aggregated values per row are listed in section 5.1.

### 3.3 Row Visibility

When a filter is active:

- **Parent rows** matching the filter criterion are visible; non-matching rows are hidden.
- **Sub-rows** (expanded multi-element detail lines) follow their parent: if the parent is hidden, all its sub-rows are also hidden; if the parent is visible, its sub-rows remain in whatever expand/collapse state they were in.
- Rows whose prerequisite statuses are all "OK", "n.a.", or green do not match any filter other than "Tous".

### 3.4 Tab Visual States

Each tab has exactly two visual states: **active** and **inactive**.

**Active tab:**

- Bottom border: 2px solid blue (blue-600 / blue-500 in dark mode)
- Text: high contrast (gray-900 / dark-text-primary)
- Background: elevated surface (white / dark-elevated)

**Inactive tab:**

- Bottom border: 2px solid transparent
- Text: secondary (gray-600 / dark-text-secondary)
- Background: none (inherits from tab bar)
- Hover: text becomes high contrast (gray-900 / dark-text-primary)

Only one tab is active at a time. Clicking a tab makes it active and deactivates all others.

### 3.5 Dynamic Count Badge

Each tab displays a count badge in parentheses after its label, showing the number of **parent rows** matching that tab's filter (not counting sub-rows).

Format: `({count})` — e.g., `Tous (5)`, `Cdes formes (1)`.

Counts update dynamically: whenever a prerequisite status changes (e.g., user changes a badge via the listbox dropdown), all five tab counts are recalculated immediately to reflect the new filter results.

### 3.6 Search Bar

A global search input is positioned in the toolbar above the tab bar, to the left of the "Nouveau job" button. It allows the user to filter rows by free-text search across all visible columns.

**Markup:**

- A container `<div>` with classes `relative flex-1`
- A magnifying glass SVG icon positioned absolutely at the left (classes `absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-text-tertiary`)
- An `<input type="text">` with placeholder `Rechercher...`

**Input styling:**

- Layout: `w-full pl-10 pr-4 py-2 text-base`
- Border: `border border-gray-300 dark:border-dark-border rounded-lg`
- Focus: `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`
- Background: `bg-white dark:bg-dark-hover`
- Text: `text-gray-900 dark:text-dark-text-primary`
- Placeholder: `placeholder-gray-400 dark:placeholder-dark-text-muted`

**Behavior:**

- Typing in the search bar filters rows in real time (on each keystroke).
- The search is case-insensitive and matches any substring across all visible text columns.
- Search filtering combines with tab filtering: both conditions must be satisfied for a row to be visible.
- Clearing the search bar restores the tab-filter-only results.
- Sub-rows follow the same combination logic: a sub-row is visible only if its parent passes both search and tab filter and the row is in expanded state.

### 3.7 Keyboard Shortcuts

The toolbar displays a shortcut hint bar below the tabs. These shortcuts are part of the specification.

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Alt + ←` / `Alt + →` | Switch tab | Cycles to the previous / next tab. Wraps around (last → first, first → last). |
| `Alt + ↑` / `Alt + ↓` | Navigate rows | Moves focus to the previous / next visible parent row in the table. |
| `Alt + F` | Focus search | Places keyboard focus in the search bar. If the search bar already has focus, selects all text. |
| `Alt + N` | New job | Activates the "Nouveau job" button. |

**Shortcut hint bar markup:**

The hints are displayed right-aligned in a bar between the tabs and the table. Each shortcut is rendered as:

- `<kbd>` elements: `px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-400 dark:border-gray-600 rounded text-sm font-mono`
- Labels: `text-xs text-gray-500 dark:text-dark-text-muted`
- Separators: a vertical bar `|` in `text-gray-300 dark:text-dark-border`, with horizontal margin `mx-1`

### 3.8 URL Persistence

The active tab is reflected in the URL hash so that the filter state survives page reloads and can be shared via URL.

**Hash format:** `#tab={filterName}`

| URL hash | Active tab |
|----------|-----------|
| _(none)_ or `#tab=all` | Tous |
| `#tab=prepresse` | A faire prepresse |
| `#tab=papier` | Cdes papier |
| `#tab=formes` | Cdes formes |
| `#tab=plaques` | Plaques a produire |

**Behavior:**

- On page load, if the URL contains a valid `#tab=...` hash, that tab is activated instead of the default "Tous".
- When the user clicks a tab, the URL hash is updated (via `history.replaceState` or direct `location.hash` assignment). No page reload occurs.
- An invalid or unrecognized hash value defaults to "Tous".

### 3.9 Default State

On page load (with no URL hash), the "Tous" tab is active, all rows are visible, and the search bar is empty.

---

## 4. Visual Previews

> See companion file: [`mockup.html`](mockup.html) for interactive preview.

**Tab "Tous" — all 5 rows visible:**

![Tab Tous](screenshots/tab-tous.png)

**Tab "A faire prepresse" — 3 rows visible (00078, 00091, 00103):**

![Tab Prepresse](screenshots/tab-prepresse.png)

**Tab "Cdes papier" — 2 rows visible (00078, 00091):**

![Tab Papier](screenshots/tab-papier.png)

**Tab "Cdes formes" — 1 row visible (00078):**

![Tab Formes](screenshots/tab-formes.png)

**Tab "Plaques a produire" — 2 rows visible (00078, 00091):**

![Tab Plaques](screenshots/tab-plaques.png)

---

## 5. Business Logic

### 5.1 Reference Data

Each parent row (not sub-rows) carries four prerequisite status values used by the filter logic. These values correspond to the **worst status** across all elements for that job.

| Row | BAT | Papier | Formes | Plaques |
|-----|-----|--------|--------|---------|
| 00042 | OK | Stock | n.a. | Pretes |
| 00078 | Att.fich | A cder | A cder | A faire |
| 00091 | Att.fich | A cder | Cdee | A faire |
| 00103 | Envoye | Livre | Livree | Pretes |
| 00117 | n.a. | Stock | Stock | n.a. |

### 5.2 Filter Algorithm

For each tab click:

1. Identify the filter function for the clicked tab (see table in 3.1).
2. For each parent row in the table body:
   - Evaluate the filter function against the row's aggregated prerequisite values.
   - If the function returns true, show the row; otherwise hide it.
   - For multi-element rows: find all associated sub-rows (detail lines). Apply the same visibility as the parent.
3. Update tab styling: set the clicked tab to active state, set all others to inactive state.

**Worked example — "A faire prepresse" filter applied to reference data (5.1):**

- 00042: BAT = "OK" → excluded (BAT is "OK")
- 00078: BAT = "Att.fich" → included (neither "OK" nor "n.a.")
- 00091: BAT = "Att.fich" → included
- 00103: BAT = "Envoye" → included (neither "OK" nor "n.a.")
- 00117: BAT = "n.a." → excluded (BAT is "n.a.")

Result: 3 rows visible. Matches verification matrix (5.4).

### 5.3 Filter Functions (Pseudocode)

```
all:       always true
prepresse: row.bat != "OK" AND row.bat != "n.a."
papier:    row.papier == "A cder"
formes:    row.formes == "A cder"
plaques:   row.plaques == "A faire"
```

### 5.4 Verification Matrix

Expected filter results for the reference data (5.1):

| Tab | Visible parent rows | Count |
|-----|-------------------|-------|
| Tous | 00042, 00078, 00091, 00103, 00117 | 5 |
| A faire prepresse | 00078, 00091, 00103 | 3 |
| Cdes papier | 00078, 00091 | 2 |
| Cdes formes | 00078 | 1 |
| Plaques a produire | 00078, 00091 | 2 |

### 5.5 Sub-Row Association

Sub-rows are associated to their parent via a parent job identifier. When the parent is hidden, all its sub-rows must be hidden too, regardless of their expand/collapse state. When the parent is shown, sub-rows return to their previous visibility (expanded or collapsed).

### 5.6 Edge Cases

| Scenario | Expected behavior |
|----------|-------------------|
| Filter active, user expands a multi-element row | New sub-rows appear (parent is visible, so sub-rows should be visible) |
| Filter active, user collapses a multi-element row | Sub-rows disappear (normal collapse behavior) |
| Filter hides a row that was expanded | Parent and all its sub-rows disappear. Expand/collapse state is preserved — when returning to "Tous", the row reappears in its expanded state |
| All rows hidden by filter | Table body appears empty. No special empty-state message required in the mockup |

