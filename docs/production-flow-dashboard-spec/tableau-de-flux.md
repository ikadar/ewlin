# Tableau de Flux — Production Flow Dashboard

**Status:** Draft
**Date:** 2026-03-02

---

## 1. Problem Statement

Print shops manage dozens of active jobs simultaneously. Each job passes through a pipeline of prerequisite steps (prepress approval, paper ordering, forme ordering, plate production) and multiple production stations (offset press, cutting, lamination, folding, stitching, packaging). Today, production managers piece together job status from scattered sources — verbal updates, separate spreadsheets, handwritten boards. There is no centralized view showing every active job's progress at a glance, making it difficult to spot bottlenecks, prioritize actions, and answer questions like "which jobs still need paper ordered?"

---

## 2. Goal

A single-page dashboard displaying all active print jobs in a dense, horizontally scrollable table. Each row shows a job's identification, prerequisite statuses, production station progress, and shipping information. The dashboard supports:

- **Tab-based filtering** to quickly isolate jobs requiring a specific action
- **Full-text search** to find jobs by any visible field
- **Interactive status updates** via dropdown menus on prerequisite badges
- **Multi-element expansion** to drill into jobs with multiple print elements
- **Keyboard shortcuts** for power users
- **URL persistence** so the active filter survives page reload

---

## 3. Detailed Behavior

### 3.1 Page Layout

The page is divided into two regions:

- **Sidebar** (56px wide, left edge): A narrow vertical navigation bar for the ERP application. Contains icon buttons for "Flux" (this dashboard, active by default) and "Demandes" (work requests). A dark mode toggle sits at the bottom.
- **Main area** (fills remaining width): A full-height card containing a sticky header, tab bar, and scrollable table.

The sidebar is part of the global ERP shell and is outside the scope of this specification.

### 3.2 Toolbar

The toolbar sits at the top of the main area and contains, top to bottom:

**Title bar:**

- Left: Page title "Flux de production"
- Right: "Nouveau job" button (primary blue) with a "+" icon and an `Alt+N` keyboard hint badge

**Search bar** (below the title):

- A full-width text input with a magnifying glass icon on the left and placeholder "Rechercher..."
- Typing filters rows in real time (on each keystroke)
- The search is case-insensitive and matches any substring across all visible text columns (ID, Client, Designation, Transporteur, status badge labels)
- Search filtering combines with tab filtering: both conditions must be satisfied for a row to be visible
- Clearing the input restores the tab-filter-only results
- Sub-rows follow the same logic: a sub-row is visible only if its parent passes both filters and the row is in expanded state

### 3.3 Tab Bar & Filtering

Below the search bar, a horizontal tab bar contains exactly 5 tabs, always visible in this order:

| # | Label | Filter criterion | Description |
|---|-------|-----------------|-------------|
| 1 | Tous | None (show all) | Default tab, no filtering |
| 2 | A faire prepresse | BAT is neither "OK" nor "n.a." | Jobs with pending prepress work |
| 3 | Cdes papier | Papier = "A cder" | Jobs where paper must be ordered |
| 4 | Cdes formes | Formes = "A cder" | Jobs where forme must be ordered |
| 5 | Plaques a produire | Plaques = "A faire" | Jobs where plates must be produced |

**Tab visual states:**

Each tab has two states: **active** and **inactive**.

- Active: blue bottom border (2px solid), high-contrast text, elevated background
- Inactive: transparent bottom border, secondary text color, no background. On hover, text becomes high-contrast.

Only one tab is active at a time. Clicking a tab makes it active and deactivates all others.

**Dynamic count badge:**

Each tab displays a count in parentheses after its label — e.g., `Tous (5)`, `Cdes formes (1)`. The count represents the number of **parent rows** (not sub-rows) matching that tab's filter. Counts update dynamically whenever a prerequisite status changes (e.g., user modifies a badge via the listbox dropdown) — all five tab counts are recalculated immediately.

**Row visibility when a filter is active:**

- Parent rows matching the filter are visible; non-matching rows are hidden.
- Sub-rows follow their parent: if the parent is hidden, all its sub-rows are hidden too; if the parent is visible, sub-rows remain in whatever expand/collapse state they were in.
- For multi-element jobs, the filter evaluates the **aggregated worst status** of the parent row (see section 6.1), not individual sub-element statuses.

### 3.4 Keyboard Shortcuts

The toolbar displays a shortcut hint bar to the right of the tabs. These shortcuts are part of the specification:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Alt + ←` / `Alt + →` | Switch tab | Cycles to the previous/next tab. Wraps around (last to first, first to last). |
| `Alt + ↑` / `Alt + ↓` | Navigate rows | Moves focus to the previous/next visible parent row in the table. |
| `Alt + F` | Focus search | Places keyboard focus in the search bar. If already focused, selects all text. |
| `Alt + N` | New job | Activates the "Nouveau job" button. |

The hint bar renders each shortcut as a `<kbd>` badge followed by a label, separated by vertical bars.

### 3.5 URL Persistence

The active tab is reflected in the URL hash so the filter state survives page reloads and can be shared.

Format: `#tab={filterName}`

| Hash | Active tab |
|------|-----------|
| _(none)_ or `#tab=all` | Tous |
| `#tab=prepresse` | A faire prepresse |
| `#tab=papier` | Cdes papier |
| `#tab=formes` | Cdes formes |
| `#tab=plaques` | Plaques a produire |

On page load, a valid hash activates the corresponding tab. An invalid hash defaults to "Tous". Clicking a tab updates the hash without page reload.

### 3.6 Table Architecture

The table uses a frozen-column layout: identification columns are pinned to the left, the actions column is pinned to the right, and all other columns scroll horizontally between them. A drop shadow on the right edge of the frozen left zone and the left edge of the frozen right zone visually separates them from the scrollable area.

**Column inventory** (left to right):

| # | Column | Width | Frozen | Content |
|---|--------|-------|--------|---------|
| 1 | _(expand)_ | 24px | Left | Expand/collapse toggle for multi-element jobs |
| 2 | ID | 4rem | Left | 5-digit zero-padded job number, monospace font |
| 3 | Client | 9rem | Left | Client or company name |
| 4 | Designation | 20% | Left | Job description (+ element count for multi-element jobs) |
| 5 | Sortie | 6rem | — | Atelier exit date in JJ/MM format |
| 6 | BAT | 6rem | — | Prepress approval status badge |
| 7 | Papier | 6rem | — | Paper procurement status badge |
| 8 | Formes | 6rem | — | Forme procurement status badge |
| 9 | Plaques | 6rem | — | Plate production status badge |
| 10 | Off. | 3.5rem | — | Offset press (ring+dot indicator) |
| 11 | Mass. | 3.5rem | — | Massicot (ring+dot indicator) |
| 12 | Pell. | 3.5rem | — | Pelliculeuse (ring+dot indicator) |
| 13 | Typo | 3.5rem | — | Typo press (ring+dot indicator) |
| 14 | Pli. | 3.5rem | — | Plieuse (ring+dot indicator) |
| 15 | Enc. | 3.5rem | — | Enc.-Piqueuse (ring+dot indicator) |
| 16 | Ass. | 3.5rem | — | Ass.-Piqueuse (ring+dot indicator) |
| 17 | Assem. | 3.5rem | — | Assembleuse (ring+dot indicator) |
| 18 | Cond. | 3.5rem | — | Conditionnement (ring+dot indicator) |
| 19 | Transp. | 6rem | — | Carrier name |
| 20 | Parti | 7rem | — | Shipment status toggle + date |
| 21 | Actions | 4rem | Right | Delete and edit icon buttons |

**Column headers:** Display abbreviated names with a `title` tooltip for the full name. Clicking a column header sorts the table by that column (direction toggles between ascending and descending). A small chevron appears on hover to indicate sortability.

**Row dimensions:**

- Parent rows: 36px height
- Sub-rows: 32px height
- All cells are vertically centered

**Scrollbars:** Custom thin overlay (6px width/height), dark gray thumb (rgb 80,80,80, lighter on hover), transparent track.

### 3.7 Identification Columns (Frozen Left)

Three columns are always visible, pinned to the left:

- **ID**: 5-digit zero-padded job number (e.g., `00042`, `00078`) in monospace font. For multi-element jobs, the ID cell also contains the expand/collapse toggle.
- **Client**: Company or client name (e.g., `Ducros`, `Muller AG`, `Lefevre & Fils`).
- **Designation**: Job description. For multi-element jobs, includes an element count in parentheses — e.g., `Etiquettes adhesives 500ex (3)`, `Boites carton 350g recto-verso (2)`.

### 3.8 Prerequisite Columns

Four columns (BAT, Papier, Formes, Plaques) show the procurement/approval status of each prerequisite as a colored badge — a small rounded label with semantic color coding.

**Color semantics:**

| Color | RGB | Meaning | Examples |
|-------|-----|---------|---------|
| Green | 74, 222, 128 | Ready / delivered / in stock | OK, Stock, Livre, Livree, Pretes |
| Yellow | 250, 204, 21 | In progress / ordered / sent | Envoye, Recus, Cde, Cdee |
| Red | 248, 113, 113 | Action required / blocking | Att.fich, A cder, A faire |
| Gray | 128, 128, 128 | Not applicable | n.a. |

**Complete status catalog per column:**

| Status | BAT | Papier | Formes | Plaques | Color |
|--------|:---:|:------:|:------:|:-------:|-------|
| n.a. | x | — | x | x | Gray |
| Stock | — | x | x | — | Green |
| Att.fich | x | — | — | — | Red |
| Recus | x | — | — | — | Yellow |
| Envoye | x | — | — | — | Yellow |
| OK | x | — | — | — | Green |
| A cder | — | x | x | — | Red |
| Cde / Cdee | — | x | x | — | Yellow |
| Livre / Livree | — | x | x | — | Green |
| A faire | — | — | — | x | Red |
| Pretes | — | — | — | x | Green |

Badges use abbreviated labels — the column header provides context. Badge styling: 11px font, medium weight, 2px 6px padding, 4px border-radius, colored background tint + colored text + transparent border.

### 3.9 Prerequisite Listbox Interaction

Each prerequisite cell is an interactive **listbox** (combobox pattern). Clicking the cell opens a dropdown panel listing all available statuses for that column.

**Trigger (the cell itself):**

- The entire cell area is clickable
- Displays the current badge on the left and a subtle caret arrow on the right
- The caret is always visible at low opacity (35%); it rotates 180° when the dropdown is open
- On hover, the cell background subtly lightens
- On keyboard focus, an indigo outline appears

**Dropdown panel:**

- Opens directly below the trigger, at least as wide as the column
- Dark background (rgb 26,26,26) with subtle border (rgb 42,42,42), 6px border-radius, pronounced shadow
- Each option shows a vertical color bar (3px x 14px, matching the status color) on the left, and the status label in plain text on the right
- The currently selected option has a thin indigo bar (2px, rgb 99,102,241) on its left edge
- Hover highlights the option with a slightly lighter background
- Appears with a combined fade + scale + translateY animation (150ms)

**Keyboard navigation:**

- `Arrow Up` / `Arrow Down`: Move focus between options
- `Enter` or `Space`: Select the focused option, close the panel
- `Escape`: Close the panel without changing selection

**Close behavior:** The panel closes on click outside or on option selection.

### 3.10 Station Columns

Nine columns represent production station categories. Each cell shows a **ring+dot** SVG indicator conveying the station's progress for that job.

**Station categories:**

| # | Abbreviation | Full name | Category ID |
|---|-------------|-----------|-------------|
| 1 | Off. | Offset | cat-offset |
| 2 | Mass. | Massicot | cat-cutting |
| 3 | Pell. | Pelliculeuse | cat-pelliculeuse |
| 4 | Typo | Typo | cat-typo |
| 5 | Pli. | Plieuse | cat-folding |
| 6 | Enc. | Enc.-Piqueuse | cat-booklet |
| 7 | Ass. | Ass.-Piqueuse | cat-saddle-stitch |
| 8 | Assem. | Assembleuse | cat-assembly |
| 9 | Cond. | Conditionnement | cat-packaging |

**Station states and visual indicators:**

| State | Color (RGB) | Visual | Progress |
|-------|-------------|--------|----------|
| Empty | — | Blank cell | No task at this station |
| Planned | 156, 163, 175 (gray) | Small dot, low opacity (25%) | 0% |
| In progress | 251, 146, 60 (orange) | Center dot (70% opacity) + partial ring arc | 1–99% |
| Late | 248, 113, 113 (red) | Center dot (70% opacity) + partial ring arc | 1–99% |
| Done | 74, 222, 128 (green) | Larger dot (70% opacity) | 100% |

**Ring+dot rendering:**

- SVG canvas: 24x24px, centered in the cell, zero padding
- **0% (planned):** A small dot (radius 3.5px) at center, 25% opacity. No ring.
- **1–99% (in progress / late):** A background ring track at 12% opacity + a colored progress arc proportional to the percentage (stroke-dasharray/dashoffset) + a center dot (radius 3.5px) at 70% opacity. The ring starts at 12 o'clock (SVG rotated -90 degrees). Ring radius: 8px, stroke-width: 1.5px, stroke-linecap: round.
- **100% (done):** A larger dot (radius 5px) at center, 70% opacity. No ring.

Each cell has a tooltip showing station name + status text (e.g., "Offset — En cours", "Massicot — Termine").

Columns are separated by thin vertical borders (1px) to delineate the indicators.

### 3.11 Multi-Element Jobs

Some print jobs consist of multiple elements (e.g., a box with a "Couverture" and an "Interieur", or labels with "Ronde", "Carree", "Ovale" variants). These jobs display as expandable parent rows with collapsible sub-rows.

**Parent row identification:**

- The Designation column shows the element count in parentheses: e.g., `Etiquettes adhesives 500ex (3)`
- An expand/collapse toggle appears in the first cell: **"+"** when collapsed, **"−"** when expanded
- The parent row's left border has a subtle indigo tint (25% opacity when collapsed, full opacity when expanded)

**Collapsed state (parent row aggregation):**

When collapsed, the parent row shows aggregated "worst" values:

- **Prerequisite badges**: The worst status across all elements (see section 6.1 for the severity ranking). A small "+N" count label appears next to the badge, where N is the number of remaining elements — e.g., "Att.fich +2" means the worst is "Att.fich" and there are 2 other elements.
- **Station cells**: Multiple colored circles stacked/overlapping, one per element that has a task at that station. Sorted worst-first (see section 6.2) so the most critical state is visually prominent. Circle radius: 5px, gap between centers: 6px, stroke: 1.5px matching background color.

**Expanded state (sub-rows):**

When expanded, sub-rows appear below the parent — one per element:

- Sub-rows have a left indigo border (3px solid) for visual grouping
- The Designation cell shows `↳ {element name}` (e.g., `↳ Couverture`, `↳ Interieur`)
- ID, Client, Sortie columns are empty (inherited from parent)
- Prerequisite badges show the individual element's own status (not the aggregated worst)
- Station cells show individual ring+dot indicators for that element
- Transporteur, Parti, and Actions cells are empty

**Expand/collapse animation:**

Sub-rows appear with a staggered slide+fade animation: each sub-row is delayed by 30ms relative to the previous one. Duration: 400ms, easing: cubic-bezier(0.25, 1, 0.5, 1).

**Toggle button:**

- 14x14px square, 3px border-radius, 1px border
- Monospace font, 11px, semibold
- Default: transparent background, gray text, gray border
- Hover: darker background (rgb 52,52,52), indigo border (rgb 129,140,248), lighter text
- Expanded: indigo-tinted background (rgba 99,102,241 at 25%), indigo border, indigo text

### 3.12 Transporteur Column

Displays the carrier/shipping company assigned to the job:

- Shows the carrier name in plain text (e.g., `Chronopost`, `DHL`, `TNT`, `GLS`)
- Shows `—` (em dash) if no carrier is assigned yet

### 3.13 Parti Column (Shipment Status)

Indicates whether the job has been shipped, using a toggle icon with an optional date:

- **Not shipped**: A circle outline icon in gray. Lightens on hover.
- **Shipped**: A circle-check icon in green + the shipment date in JJ/MM format (e.g., `25/02`). Lightens on hover.

### 3.14 Actions Column (Frozen Right)

Pinned to the right edge of the table, with a left shadow separator. Contains two icon buttons per parent row:

1. **Delete** (trash icon): Red color. Tooltip: "Supprimer".
2. **Edit** (folder icon): Blue color. Tooltip: "Editer".

Sub-rows do not display action buttons.

### 3.15 Visual Theme

- **Color mode**: Dark theme
- **Dark palette**: Near-black base (rgb 15,15,15), progressing through surface (26,26,26), elevated (36,36,36), hover (44,44,44), and active (52,52,52). Borders: rgb 42,42,42. Text: primary (245,245,245), secondary (209,209,209), tertiary (161,161,161), muted (128,128,128).
- **Fonts**: Inter for UI text, JetBrains Mono for job IDs, keyboard hints, and code
- **Base font size**: 13px — compact for data-dense display
- **Font features**: OpenType contextual alternates (cv02, cv03, cv04, cv11) for optimized Inter rendering
- **Antialiasing**: Subpixel antialiasing disabled (grayscale) for crisper text on dark backgrounds

### 3.16 Default State

On page load (with no URL hash):

- The "Tous" tab is active, all rows are visible
- The search bar is empty
- All prerequisite listboxes are closed
- Multi-element rows are in their initial expand/collapse state (which may vary per job — see section 5 for sample data)

---

## 4. Visual Previews

> See companion file: [`mockup.html`](mockup.html) for interactive preview.

**Full table — "Tous" tab, all 5 rows visible (00091 expanded with sub-rows):**

![Full table view](screenshots/tab-tous.png)

**Tab "A faire prepresse" — 3 rows visible (00078, 00091, 00103):**

![Tab Prepresse](screenshots/tab-prepresse.png)

**Tab "Cdes papier" — 2 rows visible (00078, 00091):**

![Tab Papier](screenshots/tab-papier.png)

**Tab "Cdes formes" — 1 row visible (00078):**

![Tab Formes](screenshots/tab-formes.png)

**Tab "Plaques a produire" — 2 rows visible (00078, 00091):**

![Tab Plaques](screenshots/tab-plaques.png)

---

## 5. Data Specification

### 5.1 Parent Row Reference Data

Each parent row carries identification, prerequisite statuses (aggregated worst for multi-element jobs), and shipping information:

| ID | Client | Designation | Sortie | Elem. | BAT | Papier | Formes | Plaques | Transp. | Parti |
|----|--------|-------------|--------|:-----:|-----|--------|--------|---------|---------|-------|
| 00042 | Ducros | Brochure A4 16p Couche Satin | 28/02 | 1 | OK | Stock | n.a. | Pretes | Chronopost | 25/02 |
| 00078 | Muller AG | Etiquettes adhesives 500ex | 05/03 | 3 | Att.fich | A cder | A cder | A faire | — | — |
| 00091 | Lefevre & Fils | Boites carton 350g recto-verso | 03/03 | 2 | Att.fich | A cder | Cdee | A faire | DHL | — |
| 00103 | Pharma Plus | Notice pliee 6 volets 90g | 01/03 | 1 | Envoye | Livre | Livree | Pretes | TNT | — |
| 00117 | Editions Vega | Reimpression catalogue 2025 | 27/02 | 1 | n.a. | Stock | Stock | n.a. | GLS | 26/02 |

### 5.2 Station States per Parent Row

`done` = green, `progress` = orange, `late` = red, `planned` = gray, `—` = no task at this station.

| ID | Off. | Mass. | Pell. | Typo | Pli. | Enc. | Ass. | Assem. | Cond. |
|----|------|-------|-------|------|------|------|------|--------|-------|
| 00042 | done | done | done | — | done | done | — | — | done |
| 00078 | _(multi)_ | _(multi)_ | — | _(multi)_ | — | — | — | — | _(multi)_ |
| 00091 | _(multi)_ | _(multi)_ | — | — | _(multi)_ | — | — | — | _(multi)_ |
| 00103 | done | progress | — | — | planned | — | — | — | planned |
| 00117 | late | done | done | — | — | planned | — | — | planned |

For multi-element rows (00078, 00091), see section 5.3 for per-element breakdown.

### 5.3 Multi-Element Data

**Job 00078 — 3 elements (Etiquettes adhesives 500ex):**

Prerequisite statuses:

| Element | Initial | BAT | Papier | Formes | Plaques |
|---------|:-------:|-----|--------|--------|---------|
| Etiquette Ronde | R | OK (green) | Stock (green) | Stock (green) | Pretes (green) |
| Etiquette Carree | C | Envoye (yellow) | Cde (yellow) | n.a. (gray) | A faire (red) |
| Etiquette Ovale | O | Att.fich (red) | A cder (red) | A cder (red) | A faire (red) |

Station states:

| Element | Off. | Mass. | Pell. | Typo | Pli. | Enc. | Ass. | Assem. | Cond. |
|---------|------|-------|-------|------|------|------|------|--------|-------|
| Ronde | late | planned | — | planned | — | — | — | — | planned |
| Carree | progress | planned | — | — | — | — | — | — | planned |
| Ovale | planned | — | — | planned | — | — | — | — | planned |

Aggregated worst: BAT = Att.fich (red), Papier = A cder (red), Formes = A cder (red), Plaques = A faire (red).

**Job 00091 — 2 elements (Boites carton 350g recto-verso):**

Prerequisite statuses:

| Element | Initial | BAT | Papier | Formes | Plaques |
|---------|:-------:|-----|--------|--------|---------|
| Couverture | C | Envoye (yellow) | Recus (yellow) | n.a. (gray) | n.a. (gray) |
| Interieur | I | Att.fich (red) | A cder (red) | Cdee (yellow) | A faire (red) |

Station states:

| Element | Off. | Mass. | Pell. | Typo | Pli. | Enc. | Ass. | Assem. | Cond. |
|---------|------|-------|-------|------|------|------|------|--------|-------|
| Couverture | progress | planned | — | — | — | — | — | — | planned |
| Interieur | planned | — | — | — | planned | — | — | — | planned |

Aggregated worst: BAT = Att.fich (red), Papier = A cder (red), Formes = Cdee (yellow), Plaques = A faire (red).

---

## 6. Business Logic

### 6.1 Severity Ranking

Status colors follow a strict severity order from worst to best:

```
red (0) > yellow (1) > gray (2) > green (3)
```

This ranking is used for worst-value aggregation (6.2) and for stacked dot sorting (6.3).

### 6.2 Worst-Value Aggregation

For multi-element jobs, the parent row displays the worst (most severe) status across all elements for each prerequisite column.

**Algorithm:**

1. For a given prerequisite column (BAT, Papier, Formes, or Plaques):
2. Collect the status of every element for that column.
3. Map each status to its color (red / yellow / gray / green).
4. Select the status with the lowest severity rank (red = 0 wins over yellow = 1, etc.).
5. Display that status as the parent row's badge.

**Worked example — Job 00078, Papier column:**

- Ronde: Stock (green, rank 3)
- Carree: Cde (yellow, rank 1)
- Ovale: A cder (red, rank 0)
- Minimum rank: 0 (red) → parent shows "A cder" (red)

**Worked example — Job 00091, Formes column:**

- Couverture: n.a. (gray, rank 2)
- Interieur: Cdee (yellow, rank 1)
- Minimum rank: 1 (yellow) → parent shows "Cdee" (yellow)

### 6.3 Station Stacking (Collapsed Multi-Element)

When a multi-element row is collapsed, station cells show stacked dots instead of ring+dot indicators. Each dot represents one element.

**Algorithm:**

1. Collect the station state of each element for that station column (skip null/empty).
2. Sort by severity: late (0) > progress (1) > planned (2) > done (3).
3. Render overlapping circles, worst-first so the most critical state is painted on top and visible.

### 6.4 Tab Filter Functions

```
all:       always true
prepresse: row.bat != "OK" AND row.bat != "n.a."
papier:    row.papier == "A cder"
formes:    row.formes == "A cder"
plaques:   row.plaques == "A faire"
```

**Worked example — "A faire prepresse" applied to reference data (5.1):**

- 00042: BAT = "OK" → excluded (BAT is "OK")
- 00078: BAT = "Att.fich" → included (neither "OK" nor "n.a.")
- 00091: BAT = "Att.fich" → included
- 00103: BAT = "Envoye" → included (neither "OK" nor "n.a.")
- 00117: BAT = "n.a." → excluded (BAT is "n.a.")

Result: 3 rows visible.

### 6.5 Filter Verification Matrix

Expected results for the reference data in section 5.1:

| Tab | Visible parent rows | Count |
|-----|-------------------|-------|
| Tous | 00042, 00078, 00091, 00103, 00117 | 5 |
| A faire prepresse | 00078, 00091, 00103 | 3 |
| Cdes papier | 00078, 00091 | 2 |
| Cdes formes | 00078 | 1 |
| Plaques a produire | 00078, 00091 | 2 |

### 6.6 Sub-Row Association

Sub-rows are associated to their parent via a job identifier. When the parent is hidden (by tab or search filter), all its sub-rows are hidden too regardless of expand/collapse state. When the parent becomes visible again, sub-rows return to their previous expand/collapse state.

### 6.7 Edge Cases

| Scenario | Expected behavior |
|----------|-------------------|
| Filter active, user expands a multi-element row | Sub-rows appear (parent is visible, so sub-rows should be visible) |
| Filter active, user collapses a multi-element row | Sub-rows disappear (normal collapse behavior) |
| Filter hides an expanded row | Parent and all sub-rows disappear. Expand state is preserved — returning to "Tous" restores the expanded state |
| All rows hidden by filter | Table body appears empty. No empty-state message required |
| User changes a prerequisite via listbox | All tab counts recalculate immediately. If the row no longer matches the active filter, it disappears |
| Search + tab filter combined | Both must match for a row to be visible |
| Listbox open, user clicks another badge | First listbox closes, second opens |
