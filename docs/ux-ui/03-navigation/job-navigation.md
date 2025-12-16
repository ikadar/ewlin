# Job Navigation

Keyboard shortcuts to navigate between jobs in the job list.

---

## Overview

Power users can quickly switch between jobs using keyboard shortcuts instead of clicking in the job list.

---

## Shortcuts

| Action | Shortcut |
|--------|----------|
| Previous job | TBD |
| Next job | TBD |

---

## Behavior

### Order

Navigation follows the **current sort/filter order** of the job list:
- If filtered, only filtered jobs are navigated
- If sorted, navigation follows sort order

### Wrap Around

- At the **last job**, "next" wraps to the **first job**
- At the **first job**, "previous" wraps to the **last job**

---

## Integration with Quick Placement Mode

When job navigation is used while Quick Placement Mode is active:

1. Selected job changes immediately
2. Tooltip updates to show tasks from the **new job**
3. Task availability recalculates for the new job
4. Placement indicator behavior adjusts accordingly

This allows rapid job-by-job scheduling without exiting Quick Placement Mode.

---

## Visual Feedback

- Selected job is highlighted in the job list
- Task list updates to show new job's tasks
- Date navigation strip updates range (today → new job's departure date)
- Job Details Panel updates to show new job's approval gates (BAT, Papier, Plaques)

---

## Related Documents

- [Quick Placement Mode](../01-interaction-patterns/quick-placement-mode.md) — Integration
- [Left Panel](../05-components/left-panel.md) — Jobs list component
