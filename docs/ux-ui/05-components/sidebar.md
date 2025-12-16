# Sidebar

The narrow navigation strip on the far left of the screen.

---

## Overview

The Sidebar provides top-level navigation between main application views. It's always visible and takes minimal horizontal space.

---

## Structure

```
+--------+
|  [□]   |  ← Grid view (active)
|  [📅]  |  ← Calendar view
|  [⚙]   |  ← Settings
|        |
|        |
|        |
+--------+
```

---

## Dimensions

| Property | Value |
|----------|-------|
| Width | 56px (w-14) |
| Height | Full viewport height |
| Background | `bg-zinc-900/50` |
| Border | `border-r border-white/5` |

---

## Navigation Items

| Icon | Lucide Name | Purpose | Route |
|------|-------------|---------|-------|
| Grid | `layout-grid` | Scheduling view (default) | `/schedule` |
| Calendar | `calendar` | Calendar overview | `/calendar` |
| Settings | `settings` | Application settings | `/settings` |

---

## Button States

### Active

```html
<button class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-zinc-300 hover:bg-white/15 hover:text-white">
  <i data-lucide="layout-grid" class="w-5 h-5"></i>
</button>
```

### Inactive

```html
<button class="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-white/10 hover:text-zinc-300">
  <i data-lucide="calendar" class="w-5 h-5"></i>
</button>
```

---

## Visual States

| State | Background | Text Color |
|-------|------------|------------|
| **Inactive** | transparent | `text-zinc-500` |
| **Inactive + Hover** | `bg-white/10` | `text-zinc-300` |
| **Active** | `bg-white/10` | `text-zinc-300` |
| **Active + Hover** | `bg-white/15` | `text-white` |

---

## Behavior

| Feature | Behavior |
|---------|----------|
| Always visible | Yes |
| Collapsible | No |
| Responsive | Icons only, no labels |

---

## Accessibility

- Each button has appropriate `aria-label`
- Keyboard navigation with Tab
- Visual focus indicator on focus

---

## Related Documents

- [00-overview.md](../00-overview.md) — Screen layout
