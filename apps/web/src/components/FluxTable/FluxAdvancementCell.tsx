/**
 * Mode avancement cell — bi-state round checkboxes (○ / ✓) for one
 * (element, station-category) intersection. Reuses the SVG icons from
 * STCell (PendingIcon / DoneIcon) for visual consistency with the
 * expédition column.
 *
 * Single-task case  : one round.
 * Multi-task case   : N stacked rounds, individually clickable.
 * Aggregate case    : passed via `aggregate` prop — used by job-row
 *                     cells to render one master round whose state is
 *                     derived from all children + cascade-toggles them
 *                     on click. Mixed state renders an indeterminate
 *                     square (◧-ish).
 */

import { memo, useCallback } from 'react';
import type { Task, TaskAssignment } from '@flux/types';
import { PendingIcon, DoneIcon } from './STCell';
import {
  type AdvancementCellState,
  type AggregatedAdvancementState,
  computeCellState,
  aggregateCellStates,
} from './fluxAdvancement';

interface RoundButtonProps {
  state: 'checked' | 'unchecked' | 'mixed';
  disabled: boolean;
  onClick: () => void;
  title: string;
  testId?: string;
}

function RoundButton({ state, disabled, onClick, title, testId }: RoundButtonProps) {
  const className = [
    'inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors',
    disabled
      ? 'cursor-default text-emerald-500/60'
      : state === 'checked'
        ? 'cursor-pointer text-emerald-400 hover:text-emerald-300'
        : state === 'mixed'
          ? 'cursor-pointer text-amber-300 hover:text-amber-200'
          : 'cursor-pointer text-flux-text-muted hover:text-flux-text-secondary',
  ].join(' ');
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      className={className}
      data-testid={testId}
      data-state={state}
      data-disabled={disabled ? 'true' : undefined}
      title={title}
      aria-pressed={state === 'checked'}
      aria-label={title}
    >
      {state === 'checked' ? (
        <DoneIcon />
      ) : state === 'mixed' ? (
        <MixedIcon />
      ) : (
        <PendingIcon />
      )}
    </button>
  );
}

/** Indeterminate variant of the round — same circle + a dash inside (◐). */
function MixedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

interface FluxAdvancementCellProps {
  /** Tasks in this cell. Order is preserved for stable visual layout. */
  tasks: Task[];
  /** taskId → assignment lookup (passed via context for O(1) per cell). */
  assignmentsByTaskId: Map<string, TaskAssignment>;
  /** Current instant. */
  now: Date;
  /**
   * When true, render a single aggregated round whose click cascades to
   * every enabled task in `tasks`. Used by parent-row cells of multi-
   * element jobs (the user's "cocher au niveau d'un job" verb).
   */
  aggregate: boolean;
  /** Toggle handler — caller wires this to recordProgressDirect (pct=100/0). */
  onSetTaskCompletion: (taskId: string, completed: boolean) => void;
}

/**
 * Render the rounds for one cell. Empty array → render nothing (the cell
 * stays blank, no orphan icon).
 */
export const FluxAdvancementCell = memo(function FluxAdvancementCell({
  tasks,
  assignmentsByTaskId,
  now,
  aggregate,
  onSetTaskCompletion,
}: FluxAdvancementCellProps) {
  const states: AdvancementCellState[] = tasks.map((t) =>
    computeCellState(t, assignmentsByTaskId.get(t.id), now),
  );
  const handleCascadeToggle = useCallback(() => {
    const agg = aggregateCellStates(states);
    // Cascade direction : if any unchecked enabled tasks exist, set
    // them all to done ; otherwise un-check every enabled task. Mirrors
    // the conventional master-checkbox UX.
    const targetChecked = agg !== 'all';
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!;
      const s = states[i]!;
      if (s.isDisabled) continue;
      if (s.isChecked === targetChecked) continue;
      onSetTaskCompletion(t.id, targetChecked);
    }
  }, [tasks, states, onSetTaskCompletion]);

  if (tasks.length === 0) return null;

  if (aggregate) {
    const agg = aggregateCellStates(states);
    if (agg === 'empty') return null;
    const allDisabled = states.every((s) => s.isDisabled);
    const visual: 'checked' | 'unchecked' | 'mixed' =
      agg === 'all' ? 'checked' : agg === 'none' ? 'unchecked' : 'mixed';
    return (
      <div className="flex items-center justify-center">
        <RoundButton
          state={visual}
          disabled={allDisabled}
          onClick={handleCascadeToggle}
          title={
            visual === 'checked'
              ? `Décocher les ${tasks.length} tâches`
              : visual === 'mixed'
                ? `Marquer fini pour les ${tasks.length} tâches`
                : `Marquer fini pour les ${tasks.length} tâches`
          }
          testId="flux-advancement-aggregate"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-0.5">
      {tasks.map((t, i) => {
        const s = states[i]!;
        const visual = s.isChecked ? 'checked' : 'unchecked';
        return (
          <RoundButton
            key={t.id}
            state={visual}
            disabled={s.isDisabled}
            onClick={() => onSetTaskCompletion(t.id, !s.isChecked)}
            title={
              s.isDisabled
                ? 'Tâche passée — considérée comme terminée'
                : s.isChecked
                  ? 'Décocher'
                  : 'Marquer fini'
            }
            testId={`flux-advancement-round-${t.id}`}
          />
        );
      })}
    </div>
  );
});
