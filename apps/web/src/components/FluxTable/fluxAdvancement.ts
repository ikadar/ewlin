/**
 * Mode avancement helpers — derive checkbox state for the Flux's round
 * cells from the schedule snapshot. The rond is now a shortcut over the
 * unique effort-tracking channel : clicking the rond writes
 * `recordedProgressPct = 100` (or 0 to uncheck) via recordProgressDirect.
 * There's no separate "marqué fini" flag anymore (cf. avancement
 * remise-à-plat Phase 2, 2026-05-24).
 *
 *   isChecked  = presumedDone OR (recordedProgressPct >= 100)
 *   isDisabled = presumedDone                 // silence-is-consent override
 *
 * presumedDone is intentionally simple : any tile whose scheduled window
 * is wholly in the past is treated as done (silence = consent). The fine-
 * grained "saisie partielle on past tile" nuance lives in the
 * ProgressCaptureModal — the mode avancement is a bulk tool, not a
 * partial-progress tool. Saved decision : `feedback_optimistic_silence_consent`.
 */

import type { ScheduleSnapshot, Task, TaskAssignment } from '@flux/types';

/** Round state for one task in mode avancement. */
export interface AdvancementCellState {
  /** Whether the round shows ✓ (checked) or ○ (unchecked). */
  isChecked: boolean;
  /**
   * When true, the round can't be toggled. Always paired with `isChecked=true`
   * — represents the silence-is-consent presumption on past tiles : the
   * algo already considers the task done, the operator can't un-decide it
   * from this UI.
   */
  isDisabled: boolean;
}

/** Aggregated state for a list of cells in the same column (job row cell). */
export type AggregatedAdvancementState = 'all' | 'none' | 'mixed' | 'empty';

/**
 * Compute the round state for a single task.
 *
 * @param task            The task entity from the snapshot.
 * @param assignment      The placement (if any). Past `scheduledEnd` triggers
 *                        the silence-is-consent presumption.
 * @param now             Current instant (passed in so callers can use the
 *                        NowContext override consistently across the page).
 */
export function computeCellState(
  task: Task | undefined,
  assignment: TaskAssignment | undefined,
  now: Date,
): AdvancementCellState {
  if (!task) {
    return { isChecked: false, isDisabled: false };
  }
  const isPastTile = assignment ? new Date(assignment.scheduledEnd) < now : false;
  const isManuallyDone =
    task.type === 'Internal' && (task.recordedProgressPct ?? 0) >= 100;
  return {
    isChecked: isPastTile || isManuallyDone,
    isDisabled: isPastTile,
  };
}

/**
 * Aggregate per-task states into a parent-cell state. Used by job-row
 * cells (cascade source) and the multi-task per-element case.
 *
 * Rules :
 *   - Empty list                                  → 'empty'  (render nothing)
 *   - Every state checked                         → 'all'
 *   - No state checked                            → 'none'
 *   - Mix (some checked, some not)                → 'mixed'  (indeterminate dash)
 *
 * Disabled states count as checked for the rollup — a past tile is
 * effectively done from the operator's POV.
 */
export function aggregateCellStates(states: AdvancementCellState[]): AggregatedAdvancementState {
  if (states.length === 0) return 'empty';
  let anyChecked = false;
  let anyUnchecked = false;
  for (const s of states) {
    if (s.isChecked) anyChecked = true;
    else anyUnchecked = true;
    if (anyChecked && anyUnchecked) return 'mixed';
  }
  return anyChecked ? 'all' : 'none';
}

/**
 * Build a quick lookup : taskId → assignment. Avoids O(n²) loops when a
 * single render iterates many cells.
 */
export function buildAssignmentIndex(
  snapshot: ScheduleSnapshot | null,
): Map<string, TaskAssignment> {
  const map = new Map<string, TaskAssignment>();
  if (!snapshot) return map;
  for (const a of snapshot.assignments) {
    map.set(a.taskId, a);
  }
  return map;
}

/**
 * Build : stationId → categoryId. The snapshot stores tasks with a
 * concrete stationId, but the Flux table is keyed by category. We
 * pre-build the lookup once per render rather than scanning stations[]
 * in every cell.
 */
export function buildStationCategoryIndex(
  snapshot: ScheduleSnapshot | null,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!snapshot) return map;
  for (const s of snapshot.stations) {
    map.set(s.id, s.categoryId);
  }
  return map;
}

/**
 * Group tasks by (elementId, categoryId) for fast cell-level lookup.
 * Includes placed AND unplaced tasks — mode avancement shows every task
 * of the job, the silence-is-consent presumption only filters on the
 * past-tile gate which is per-task, not per-cell.
 */
export function buildElementCategoryTaskIndex(
  snapshot: ScheduleSnapshot | null,
): Map<string, Map<string, Task[]>> {
  const stationCat = buildStationCategoryIndex(snapshot);
  const index = new Map<string, Map<string, Task[]>>();
  if (!snapshot) return index;
  for (const task of snapshot.tasks) {
    if (task.type !== 'Internal') continue;
    const catId = stationCat.get(task.stationId);
    if (!catId) continue;
    let byCat = index.get(task.elementId);
    if (!byCat) {
      byCat = new Map();
      index.set(task.elementId, byCat);
    }
    const list = byCat.get(catId);
    if (list) {
      list.push(task);
    } else {
      byCat.set(catId, [task]);
    }
  }
  return index;
}
