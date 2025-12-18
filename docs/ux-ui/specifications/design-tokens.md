---
tags:
  - specification
  - ux-ui
  - design
---

# Design Tokens – Flux Scheduling UI

This document defines the design tokens (colors, spacing, typography, animation) used throughout the UI.

---

## Color System

### Base Colors (CSS Variables)

Defined in `apps/web/src/index.css` using HSL format:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
```

### Dark Mode Colors

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

---

## Job Colors

Jobs are assigned colors from a predefined palette. Defined in `colorUtils.ts`:

### Color Palette

| Color Name | Hex Value | Tailwind Class |
|------------|-----------|----------------|
| Purple | #a855f7 | purple-500 |
| Violet | #8b5cf6 | violet-500 |
| Rose | #f43f5e | rose-500 |
| Red | #ef4444 | red-500 |
| Yellow | #eab308 | yellow-500 |
| Amber | #f59e0b | amber-500 |
| Orange | #f97316 | orange-500 |
| Teal | #14b8a6 | teal-500 |
| Green | #22c55e | green-500 |
| Emerald | #10b981 | emerald-500 |
| Lime | #84cc16 | lime-500 |
| Cyan | #06b6d4 | cyan-500 |
| Sky | #0ea5e9 | sky-500 |
| Blue | #3b82f6 | blue-500 |
| Indigo | #6366f1 | indigo-500 |
| Pink | #ec4899 | pink-500 |
| Fuchsia | #d946ef | fuchsia-500 |

### Tile Color Application

For each job color, the following classes are generated:

```typescript
{
  border: `border-l-${color}-500`,      // Left border accent
  setupBg: `bg-${color}-900/40`,        // Setup section background
  setupBorder: `border-${color}-700/30`, // Setup section border
  runBg: `bg-${color}-950/35`,          // Run section background
  text: `text-${color}-300`             // Text color
}
```

---

## Validation Feedback Colors

Visual feedback during drag operations:

| State | Ring Color | Background | Usage |
|-------|------------|------------|-------|
| Valid | `ring-green-500` | `bg-green-500/10` | Drop allowed |
| Invalid | `ring-red-500` | `bg-red-500/10` | Drop blocked |
| Warning | `ring-orange-500` | `bg-orange-500/10` | Soft constraint (e.g., Plates pending) |
| Bypass | `ring-amber-500` | `bg-amber-500/10` | Alt+drop precedence bypass |

---

## Spacing

### Layout Dimensions

| Element | Width | Tailwind Class |
|---------|-------|----------------|
| Sidebar | 56px | w-14 |
| Jobs List | 288px | w-72 |
| Job Details Panel | 288px | w-72 |
| Date Strip | 48px | w-12 |
| Timeline Column | 48px | w-12 |
| Station Column (normal) | 240px | w-60 |
| Station Column (collapsed) | 120px | w-30 |

### Grid Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PIXELS_PER_HOUR` | 80px | Vertical scale |
| `START_HOUR` | 6 | Grid starts at 6:00 |
| `HOURS_TO_DISPLAY` | 24 | Full day visible |
| Grid snap interval | 30min | Drop positions snap to :00/:30 |

### Component Spacing

| Context | Value | Usage |
|---------|-------|-------|
| Tile padding | 8px | Internal padding |
| Tile margin | 2px | Gap between tiles |
| Section gap | 4px | Gap between setup/run sections |
| Border radius | 0.5rem | Standard rounded corners |

---

## Typography

### Base Font

```css
body {
  font-size: 14px;
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Text Styles

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| Tile job reference | 14px | 500 | Job ID in tile header |
| Tile duration | 12px | 400 | Duration badge |
| Timeline hour | 12px | 500 | Hour markers |
| Job card title | 14px | 600 | Job list items |
| Section header | 12px | 600 | Panel section titles |

---

## Animation & Transitions

### Transition Durations

| Duration | Value | Usage |
|----------|-------|-------|
| Fast | 100ms | Hover states |
| Default | 150ms | Column collapse, state changes |
| Smooth | 200ms | Complex transitions |

### Easing Functions

| Easing | Value | Usage |
|--------|-------|-------|
| Default | ease-out | Most transitions |
| Smooth | ease-in-out | Long animations |

### Transition Properties

```css
/* Tile state transitions */
transition-property: filter, opacity, box-shadow;
transition-duration: 150ms;
transition-timing-function: ease-out;

/* Column state transitions */
transition-property: all;
transition-duration: 150ms;
transition-timing-function: ease-out;

/* Button hover */
transition-property: colors;
transition-duration: 100ms;
```

### Visual Effects

#### Tile Selection Glow

```typescript
boxShadow: `0 0 12px 4px ${jobColor}99` // 60% opacity
```

#### Placement Indicator Glow

```typescript
boxShadow: '0 0 12px rgba(255, 255, 255, 0.8)'
```

#### Completion Gradient

```typescript
backgroundImage: 'linear-gradient(to right, rgba(34,197,94,0.6) 0%, rgba(34,197,94,0.2) 50%, transparent 100%)'
```

#### Muted State (Non-active Jobs)

```typescript
filter: 'saturate(0.2)'
opacity: 0.6
pointerEvents: 'none'
```

#### Drag Preview

```typescript
opacity: 0.8
```

---

## Special Patterns

### Unavailability Overlay

Diagonal stripe pattern for unavailable time slots:

```css
.bg-stripes-dark {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 8px,
    rgba(30, 41, 59, 0.7) 8px,
    rgba(30, 41, 59, 0.7) 16px
  );
}
```

### Now Line

```css
/* Red line indicating current time */
background-color: rgb(239 68 68); /* red-500 */
height: 2px;
```

### Departure Date Line

```css
/* Blue line indicating job departure */
background-color: rgb(59 130 246); /* blue-500 */
height: 2px;
```

---

## Icons

Icon library: **Lucide React**

### Common Icons

| Icon | Component | Usage |
|------|-----------|-------|
| Circle | `<Circle />` | Incomplete task |
| CircleCheck | `<CircleCheck />` | Completed task |
| AlertCircle | `<AlertCircle />` | Warning/conflict |
| ChevronUp | `<ChevronUp />` | Swap up |
| ChevronDown | `<ChevronDown />` | Swap down |
| Shuffle | `<Shuffle />` | Similarity indicator |
| Calendar | `<Calendar />` | Date navigation |
| Settings | `<Settings />` | Settings |
| Grid3X3 | `<Grid3X3 />` | Grid view |

---

## Z-Index Layers

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base grid | 0 | Station columns |
| Tiles | 10 | Scheduled tiles |
| Drag preview | 50 | Floating drag preview |
| Overlays | 100 | Modal overlays |
| Tooltips | 200 | Tooltips, popovers |

---

## Related Documents

- [Tile States](../04-visual-feedback/tile-states.md)
- [Conflict Indicators](../04-visual-feedback/conflict-indicators.md)
- [Station Unavailability](../04-visual-feedback/station-unavailability.md)
