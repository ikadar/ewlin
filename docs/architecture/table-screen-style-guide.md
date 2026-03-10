# Table Screen Style Guide

Style guidelines extracted from the Flux application's existing table screens.
Applies to all screens that display tabular data: CRUD pages, dashboards, and data grids.

---

## 1. Page Structure

Every table screen follows a **vertical flex layout** that fills the viewport.

### 1.1 CRUD Pages (simple tables)

```
┌─────────────────────────────────────────────┐
│ HEADER — border-b, px-6 py-4               │
│   ← Retour  |  Title  |  [+ Action button] │
├─────────────────────────────────────────────┤
│ MAIN — flex-1, p-6                          │
│   Search bar + count                        │
│   Table (overflow-x-auto)                   │
└─────────────────────────────────────────────┘
```

```tsx
<div className="min-h-screen bg-zinc-900 flex flex-col">
  <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
    ...
  </header>
  <main className="flex-1 p-6">
    ...
  </main>
</div>
```

### 1.2 Dashboard Pages (complex tables)

Dashboard tables are wrapped in an **elevated card** with toolbar + tab bar + table stacked vertically.

```
┌─────────────────────────────────────────────┐
│ PAGE — flex-1, bg-flux-base, p-4            │
│ ┌─────────────────────────────────────────┐ │
│ │ CARD — bg-flux-elevated, rounded-lg,    │ │
│ │        border border-flux-border        │ │
│ │ ┌─────────────────────────────────────┐ │ │
│ │ │ TOOLBAR — border-b, px-6 py-4      │ │ │
│ │ ├─────────────────────────────────────┤ │ │
│ │ │ TAB BAR — border-b, px-4           │ │ │
│ │ ├─────────────────────────────────────┤ │ │
│ │ │ TABLE — flex-1, overflow-auto,      │ │ │
│ │ │         scrollbar-visible           │ │ │
│ │ └─────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

```tsx
<div className="flex-1 flex flex-col overflow-hidden bg-flux-base">
  <div className="flex-1 overflow-hidden">
    <div className="p-4 h-full">
      <div className="bg-flux-elevated rounded-lg border border-flux-border h-full overflow-hidden flex flex-col">
        <Toolbar />
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <Table />
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 2. Color System

### 2.1 Dark Palette (Flux Tokens)

All table screens use the Flux dark palette. **Never use raw hex values** — always reference tokens.

| Token                      | RGB              | Usage                          |
|----------------------------|------------------|--------------------------------|
| `flux-base`                | `rgb(15 15 15)`  | Page background                |
| `flux-surface`             | `rgb(26 26 26)`  | Sub-row backgrounds            |
| `flux-elevated`            | `rgb(36 36 36)`  | Card/toolbar background        |
| `flux-hover`               | `rgb(44 44 44)`  | Row hover, header background   |
| `flux-active`              | `rgb(52 52 52)`  | Active/pressed state           |
| `flux-border`              | `rgb(42 42 42)`  | Primary borders                |
| `flux-border-light`        | `rgb(58 58 58)`  | Lighter accent borders         |
| `flux-text-primary`        | `rgb(245 245 245)` | Main text, titles            |
| `flux-text-secondary`      | `rgb(209 209 209)` | Cell text, descriptions      |
| `flux-text-tertiary`       | `rgb(161 161 161)` | Labels, hints                |
| `flux-text-muted`          | `rgb(128 128 128)` | Disabled, placeholders       |

### 2.2 CRUD Page Fallback Palette

Older CRUD pages use raw Tailwind `zinc-*` shades. These map to the Flux tokens as follows:

| zinc class       | Flux equivalent          |
|------------------|--------------------------|
| `bg-zinc-900`    | `bg-flux-base`           |
| `bg-zinc-800`    | `bg-flux-hover`          |
| `border-zinc-800`| `border-flux-border`     |
| `border-zinc-700`| `border-flux-border-light`|
| `text-zinc-100`  | `text-flux-text-primary` |
| `text-zinc-400`  | `text-flux-text-secondary`|
| `text-zinc-500`  | `text-flux-text-tertiary`|
| `text-zinc-600`  | `text-flux-text-muted`   |

**Guideline:** New pages should use `flux-*` tokens exclusively.

### 2.3 Semantic Accent Colors

| Purpose           | Color class                                       |
|--------------------|--------------------------------------------------|
| Primary action     | `bg-blue-600 hover:bg-blue-700`                  |
| Primary text accent| `text-blue-400`                                  |
| Success / done     | `text-emerald-400`, `text-green-400`              |
| Warning / conflict | `text-amber-400`                                  |
| Error / danger     | `text-red-400`                                    |
| In progress        | `text-orange-400` (`rgb(251 146 60)`)             |
| Focus ring         | `ring-blue-500`, `ring-indigo-500/40`             |
| Active tab border  | `border-blue-500`                                 |

### 2.4 Status Badge Pattern

Use transparent-background badges with matching text color:

```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-emerald-400 bg-emerald-400/10">
  Available
</span>
```

Pattern: `text-{color}-400 bg-{color}-400/10`

---

## 3. Typography

### 3.1 Base Font

```css
html { font-size: 13px; }
body { font-family: "Inter", system-ui, sans-serif; font-weight: 500; }
```

The 13px base makes all Tailwind `rem` classes slightly smaller than default:
- `text-xs` = 9.75px
- `text-sm` = 11.375px — **primary table text size**
- `text-base` = 13px
- `text-lg` = 14.625px
- `text-xl` = 16.25px — **page title size**

### 3.2 Font Features

```css
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
-webkit-font-smoothing: antialiased;
```

### 3.3 Monospace

Use `font-mono` (`JetBrains Mono`) for:
- ID columns
- JSON/code display
- Numeric identifiers

### 3.4 Text Hierarchy in Tables

| Element            | Classes                                          |
|--------------------|--------------------------------------------------|
| Page title (h1)    | `text-xl font-semibold text-flux-text-primary`   |
| Column header      | `text-sm font-medium text-flux-text-secondary`   |
| ID cell            | `text-sm font-mono font-medium text-flux-text-primary` |
| Name/primary cell  | `text-sm text-flux-text-primary font-medium` (CRUD) or `text-flux-text-secondary` (dashboard) |
| Secondary cell     | `text-sm text-flux-text-secondary`               |
| Meta/date cell     | `text-xs text-flux-text-muted`                   |
| Empty state        | `text-sm text-flux-text-muted` (center aligned)  |
| Count badge        | `text-sm text-flux-text-muted`                   |

---

## 4. Header / Toolbar

### 4.1 CRUD Page Header

```tsx
<header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <button className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors">
      <ArrowLeft size={20} />
      <span>Retour</span>
    </button>
    <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
  </div>
  <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-100 bg-blue-600 hover:bg-blue-500 rounded transition-colors">
    <Plus size={16} />
    {createLabel}
  </button>
</header>
```

### 4.2 Dashboard Toolbar

```tsx
<div className="border-b border-flux-border bg-flux-elevated px-6 py-4">
  {/* Title row */}
  <div className="flex items-center justify-between mb-4">
    <h1 className="text-xl font-semibold text-flux-text-primary">{title}</h1>
    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-blue-600 text-white text-base font-medium rounded-[0.25rem] transition-colors">
      <Plus className="w-4 h-4" strokeWidth={2} />
      {createLabel}
    </button>
  </div>
  {/* Search bar */}
  <div className="flex items-center gap-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary pointer-events-none" />
      <input className="w-full pl-10 pr-4 py-2 text-base bg-flux-hover border border-flux-border rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" />
    </div>
  </div>
</div>
```

### 4.3 Action Button Variants

| Variant       | Classes                                                                          |
|---------------|----------------------------------------------------------------------------------|
| Primary (CTA) | `px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-[0.25rem]` |
| Small primary  | `px-3 py-1.5 text-sm font-medium text-zinc-100 bg-blue-600 hover:bg-blue-500 rounded` |
| Danger         | `px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded` |
| Secondary      | `px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded` |

All buttons use `transition-colors`.

---

## 5. Search Bar

### 5.1 CRUD Search (constrained width)

```tsx
<div className="mb-4 flex items-center gap-4">
  <div className="relative flex-1 max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
    <input
      placeholder="Rechercher... (/)"
      className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
    />
  </div>
  <span className="text-zinc-500 text-sm">
    {count} {entity}{count !== 1 ? 's' : ''}{search && ` / ${total}`}
  </span>
</div>
```

### 5.2 Dashboard Search (full width)

```tsx
<div className="relative flex-1">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary pointer-events-none" />
  <input
    placeholder="Rechercher..."
    className="w-full pl-10 pr-4 py-2 text-base bg-flux-hover border border-flux-border rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
  />
</div>
```

### 5.3 Search Pattern

- Icon: `Search` from lucide-react, `w-4 h-4`, absolutely positioned left
- Input left padding: `pl-10` (accommodates icon)
- Keyboard shortcut: `/` focuses search (CRUD pages), `Alt+F` (dashboard)

---

## 6. Tab Bar

Only used on dashboard-style pages. Sits between toolbar and table.

```tsx
<div className="flex items-end border-b border-flux-border bg-flux-elevated px-4">
  <div className="flex items-end gap-0" role="tablist">
    {tabs.map(tab => (
      <button
        role="tab"
        aria-selected={isActive}
        className={[
          'px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5',
          isActive
            ? 'border-blue-500 text-white bg-flux-elevated'
            : 'border-transparent text-flux-text-secondary hover:text-white hover:bg-flux-hover/50',
        ].join(' ')}
      >
        <span>{label}</span>
        <span className="text-sm text-flux-text-muted">({count})</span>
      </button>
    ))}
  </div>
</div>
```

Key details:
- Active tab: `border-b-2 border-blue-500`, `text-white`
- Inactive tab: `border-transparent`, `text-flux-text-secondary`
- `-mb-px` overlaps the container's `border-b` to create a seamless connection
- Count badge in parentheses, `text-flux-text-muted`

---

## 7. Table

### 7.1 Container

```tsx
{/* CRUD pages */}
<div className="overflow-x-auto">
  <table className="w-full text-sm">...</table>
</div>

{/* Dashboard pages */}
<div className="h-full overflow-auto scrollbar-visible">
  <table className="w-full table-fixed" style={{ minWidth: '1440px', fontSize: '13px' }}>
    <colgroup>{/* explicit column widths */}</colgroup>
    ...
  </table>
</div>
```

### 7.2 Column Width Strategy

- **CRUD tables:** Natural column widths, `w-full` stretches to fill
- **Dashboard tables:** `table-fixed` with `<colgroup>` defining exact widths in `rem`

### 7.3 Header Row

```tsx
{/* CRUD */}
<thead>
  <tr className="border-b border-zinc-800 text-zinc-400">
    <th className="text-left px-4 py-3 font-medium">{label}</th>
  </tr>
</thead>

{/* Dashboard */}
<thead className="sticky top-0 z-30 bg-flux-hover">
  <tr className="bg-flux-hover border-b border-flux-border">
    <th className="px-2 py-3 text-left text-sm font-medium whitespace-nowrap text-flux-text-secondary">
      {label}
    </th>
  </tr>
</thead>
```

Key differences:
- Dashboard headers are **sticky** (`sticky top-0 z-30`)
- Dashboard header background: `bg-flux-hover` (darker than elevated card)
- CRUD header text: `text-zinc-400` (maps to `text-flux-text-secondary`)

### 7.4 Sortable Headers

Sortable columns have `cursor-pointer select-none` and show a chevron indicator:
- **Active ascending:** `ChevronUp`, `text-blue-400`, always visible
- **Active descending:** `ChevronDown`, `text-blue-400`, always visible
- **Inactive sortable:** `ChevronsUpDown`, `text-flux-text-muted`, `opacity-0 group-hover:opacity-100`

### 7.5 Data Rows

```tsx
{/* CRUD */}
<tr className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
  <td className="px-4 py-3 text-zinc-100 font-medium">{name}</td>
  <td className="px-4 py-3 text-zinc-400">{secondary}</td>
</tr>

{/* Dashboard */}
<tr
  className="border-b border-flux-border group transition-colors cursor-pointer hover:bg-flux-hover"
  style={{ height: '2.25rem' }}
>
  <td className="px-4 py-0 text-sm text-flux-text-secondary">{value}</td>
</tr>
```

Key differences:
| Property         | CRUD                   | Dashboard                  |
|------------------|------------------------|----------------------------|
| Row height       | Auto (`py-3`)          | Fixed `2.25rem` (`py-0`)   |
| Sub-row height   | n/a                    | `2rem`                     |
| Row border       | `border-zinc-800/60`   | `border-flux-border`       |
| Hover bg         | `bg-zinc-800/40`       | `bg-flux-hover`            |
| Cell padding     | `px-4 py-3`           | `px-4 py-0` or `px-2 py-0` |
| Cursor           | Default                | `cursor-pointer`           |

### 7.6 Frozen Columns (Dashboard Only)

Left-frozen and right-frozen columns use `sticky` positioning with z-index layering:

```tsx
const stickyCell = 'sticky z-20 bg-flux-elevated group-hover:bg-flux-hover';
```

Shadow separators between frozen and scrollable zones:
```tsx
const LEFT_SHADOW  = { boxShadow: '4px 0 8px -2px rgba(0,0,0,0.3)' };
const RIGHT_SHADOW = { boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.3)' };
```

### 7.7 Global Table CSS

Applied globally in `index.css` — no per-component overrides needed:

```css
td {
  vertical-align: middle;
  padding-top: 0;
  padding-bottom: 0;
}

td:has(> .inline-flex) {
  line-height: 0;  /* Tight spacing for inline badge/icon elements */
}
```

### 7.8 Empty State

```tsx
<tr>
  <td colSpan={columnCount} className="text-center text-zinc-600 py-12">
    Aucun {entity} trouvé
  </td>
</tr>
```

Center-aligned, generous vertical padding (`py-12`), muted color.

---

## 8. Action Cells

### 8.1 Inline Row Actions

Right-aligned, icon-only, visible on hover:

```tsx
<td className="px-4 py-3">
  <div className="flex items-center gap-2 justify-end">
    <button className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors" title="Modifier">
      <Pencil size={15} />
    </button>
    <button className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors" title="Supprimer">
      <Trash2 size={15} />
    </button>
  </div>
</td>
```

- Edit action: hover → `text-zinc-200` (neutral highlight)
- Delete action: hover → `text-red-400` (danger highlight)
- Icon size: `15px` (CRUD) or `w-4 h-4` (dashboard)
- Button padding: `p-1.5`

### 8.2 Dashboard Frozen Actions

```tsx
<td className="sticky right-0 z-20 bg-flux-elevated group-hover:bg-flux-hover px-4 py-0" style={RIGHT_SHADOW}>
  <div className="flex items-center gap-2">
    <button className="text-red-400 hover:text-red-300">
      <Trash2 className="w-4 h-4" />
    </button>
    <button className="text-blue-400 hover:text-blue-300">
      <FolderOpen className="w-4 h-4" />
    </button>
  </div>
</td>
```

Dashboard action buttons are always colored (not zinc-500 at rest).

---

## 9. Modals (Create / Edit / Delete)

### 9.1 Overlay

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
```

### 9.2 Modal Card

```tsx
<div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 w-full max-w-{size} mx-4 shadow-xl">
```

| Size       | `max-w-*` | Use case           |
|------------|-----------|---------------------|
| Small      | `sm`      | Simple forms, confirms |
| Medium     | `2xl`     | Complex forms       |
| Large      | Custom    | Special cases       |

### 9.3 Modal Title

```tsx
<h2 className="text-zinc-100 font-medium mb-4">{title}</h2>
```

For delete dialogs: `mb-2` followed by description `text-sm text-zinc-400 mb-4`.

### 9.4 Form Fields

```tsx
<label className="block text-sm text-zinc-400 mb-1">
  {label} <span className="text-red-400">*</span>
</label>
<input className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400" />
```

- Background: `bg-zinc-900` (darker than modal)
- Border: `border-zinc-600` → focus: `border-zinc-400`
- Error state: `border-red-500 focus:border-red-400`
- Error message: `text-xs text-red-400 mt-1`
- Grid layouts for multi-field rows: `grid grid-cols-{n} gap-3`

### 9.5 Modal Footer

```tsx
<div className="flex gap-3 justify-end pt-2">
  <button className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 rounded transition-colors">
    Annuler
  </button>
  <button className="px-3 py-1.5 text-sm font-medium text-zinc-100 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors">
    Enregistrer
  </button>
</div>
```

- Cancel is always on the left, save/submit on the right
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
- Loading text: replace label with "Enregistrement..."

---

## 10. Scrollbar

Scrollbars are **hidden by default** globally. Opt-in with `.scrollbar-visible`:

```css
.scrollbar-visible::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-visible::-webkit-scrollbar-track { background: transparent; }
.scrollbar-visible::-webkit-scrollbar-thumb { background: rgb(80 80 80); border-radius: 3px; }
.scrollbar-visible::-webkit-scrollbar-thumb:hover { background: rgb(110 110 110); }
```

Apply `scrollbar-visible` to the table's scroll container, not the page.

---

## 11. Animations

### 11.1 Sub-Row Entry

```css
@keyframes flux-subrow-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 400ms, easing: cubic-bezier(0.25, 1, 0.5, 1) */
/* Staggered delay: index * 30ms */
```

### 11.2 Listbox/Dropdown Entry

```css
@keyframes flux-listbox-in {
  from { opacity: 0; transform: translateY(-3px) scale(0.97); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

### 11.3 Transitions

All interactive elements use `transition-colors` for hover/focus state changes. No other transition properties unless explicitly needed.

---

## 12. Keyboard Navigation

### 12.1 Shared Patterns

| Shortcut    | Scope      | Action                     |
|-------------|------------|----------------------------|
| `/`         | CRUD pages | Focus search input         |
| `Alt+F`     | Dashboard  | Focus search input         |
| `Escape`    | CRUD pages | Blur search or navigate back|
| `Escape`    | Modals     | Close modal                |

### 12.2 Focus Management

```css
*:focus:not(:focus-visible) {
  outline: none;  /* Suppress blue ring for mouse interactions */
}
```

Keyboard focus rings use `focus-visible` + `ring-*` utilities where explicitly added.

---

## 13. Icon System

All icons come from **lucide-react**.

| Icon         | Usage                  | Size     |
|--------------|------------------------|----------|
| `Search`     | Search input           | `w-4 h-4` |
| `Plus`       | Create action          | `16px` or `w-4 h-4` |
| `ArrowLeft`  | Back navigation        | `20px`   |
| `Pencil`     | Edit action            | `15px`   |
| `Trash2`     | Delete action          | `15px` or `w-4 h-4` |
| `FolderOpen` | Open/edit (dashboard)  | `w-4 h-4` |
| `ChevronUp/Down` | Sort indicator     | `w-3 h-3` |
| `ChevronsUpDown`| Sortable (inactive) | `w-3 h-3` |

Default `strokeWidth={2}`, active sort indicators use `strokeWidth={2.5}`.

---

## 14. Z-Index Scale

| Layer                | z-index | Usage                          |
|----------------------|---------|--------------------------------|
| Page content         | 0       | Default                        |
| Frozen cells (data)  | 20      | Sticky left/right columns      |
| Frozen cells (header)| 30      | Sticky thead + frozen columns   |
| Command Center FAB   | 40      | Floating action button          |
| Modal overlay        | 50      | Modals, dialogs                 |
| Toast / error banner | 60      | Floating notifications          |

---

## 15. Tooltip System

Shared tooltip tokens (defined in `:root`):

```css
--tt-bg: rgba(35,35,35,1);
--tt-border: 1px solid rgba(35,35,35,1);
--tt-radius: 4px;
--tt-padding: 8px 12px;
--tt-font-size: 12px;
--tt-text: #f4f4f5;
--tt-secondary: #d4d4d8;
--tt-muted: #a1a1aa;
--tt-shadow: 0 4px 12px rgba(0,0,0,.4);
--tt-hover-delay: 500ms;
--tt-fade-in: 150ms;
```

Apply via `.flux-tooltip` class. Use `title` attribute for simple browser tooltips on buttons.

---

## 16. Loading & Error States

### 16.1 Full-Page Loading

```tsx
<div className="flex-1 flex items-center justify-center bg-flux-base">
  <p className="text-flux-text-muted text-sm">Chargement…</p>
</div>
```

### 16.2 CRUD Page Loading

```tsx
<div className="text-center text-zinc-500 mt-20">Chargement...</div>
```

### 16.3 Error State

```tsx
<div className="text-center text-red-400 mt-20">
  Erreur de chargement des {entity}
</div>
```

### 16.4 Inline Error (toast)

```tsx
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-red-900/80 border border-red-500/40 rounded text-sm text-red-300">
  {message}
</div>
```

---

## Summary Checklist

When building a new table screen, verify:

- [ ] Page uses `min-h-screen bg-zinc-900 flex flex-col` (CRUD) or `flex-1 bg-flux-base` (dashboard)
- [ ] Header/toolbar has `border-b`, action button on the right
- [ ] Search bar has `Search` icon, `pl-10`, `rounded-lg`
- [ ] Table uses `<table className="w-full text-sm">`
- [ ] Header row has `border-b`, `text-zinc-400` / `text-flux-text-secondary`
- [ ] Data rows have `border-b`, `hover:bg-*`, `transition-colors`
- [ ] Actions column is right-aligned with icon buttons
- [ ] Empty state uses `colSpan`, `text-center`, `py-12`
- [ ] Modals use `fixed inset-0 z-50`, `bg-black/60` overlay
- [ ] All `transition-colors` on interactive elements
- [ ] No raw hex colors — use tokens or Tailwind classes
