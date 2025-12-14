# Timeline View vs Sequence View

Two view modes for the scheduling grid, toggled via button or keyboard shortcut.

---

## Overview

The grid supports two view modes that change how tiles are displayed:

| Mode | Tile Height | Tile Position | Purpose |
|------|-------------|---------------|---------|
| **Timeline View** | Proportional to duration | Aligned to time axis | Focus on scheduling (when) |
| **Sequence View** | Uniform (all same height) | Stacked as list | Focus on ordering (what sequence) |

---

## Timeline View (Default)

### Characteristics

- Tile height is proportional to task duration (setup + run)
- Tiles are positioned on the time axis at their scheduled times
- A 60-minute task is twice as tall as a 30-minute task
- Time axis is functional — tile position reflects actual schedule

### Use Cases

- Precise scheduling work
- Visualizing time utilization
- Identifying gaps and overlaps
- Checking deadline feasibility

---

## Sequence View

### Characteristics

- All tiles have **uniform height** regardless of duration
- Tiles stack vertically as a **list** in chronological order
- Time axis remains visible as **reference** (decorative)
- Tiles do **not** align spatially to the time axis
- Tiles still display start/end times as **text**

### Preserved Features

| Feature | Behavior in Sequence View |
|---------|---------------------------|
| Time axis | Visible as reference |
| Station unavailability | Hatched overlay still shown |
| Similarity indicators | Still displayed between tiles |
| Tile content | Start/end times shown as text |

### Use Cases

- Reviewing task order without duration noise
- Checking sequence correctness
- Comparing order across stations
- Planning before detailed scheduling

---

## Toggle Mechanism

| Method | Action |
|--------|--------|
| Button | UI button (location TBD) toggles between modes |
| Keyboard shortcut | TBD — toggles between modes |

---

## Visual Comparison

### Timeline View

```
Time    [Komori]         [Massicot]

09:00   +---------+
        |         |
        | Task 1  |      +---------+
        | (60min) |      | Task 2  |
        |         |      | (30min) |
10:00   +---------+      +---------+

        +---------+
        | Task 3  |
10:30   | (30min) |
        +---------+
```

### Sequence View

```
Time    [Komori]         [Massicot]
(ref)
        +---------+      +---------+
        | Task 1  |      | Task 2  |
        | 09:00-  |      | 09:15-  |
        | 10:00   |      | 09:45   |
        +---------+      +---------+
        +---------+
        | Task 3  |
        | 10:00-  |
        | 10:30   |
        +---------+

(All tiles same height, stacked as list)
```

---

## Related Documents

- [Scheduling Grid](../05-components/scheduling-grid.md) — Grid component details
- [Tile Component](../05-components/tile-component.md) — Tile content and styling
