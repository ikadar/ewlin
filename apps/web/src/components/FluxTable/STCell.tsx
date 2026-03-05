/**
 * STCell — ST (Sous-traitance) column cell component.
 *
 * Renders a vertical list of outsourced tasks, each with:
 *   - A 3-state SVG icon (pending=gray circle, progress=orange dot, done=green check)
 *   - A label "ProviderName · ActionType" with overflow ellipsis
 *   - A custom fixed-position tooltip on hover
 *
 * Click on the icon cycles: pending → progress → done → pending.
 *
 * @see docs/releases/v0.5.23-st-column-frontend.md
 * @see docs/production-flow-dashboard-spec/upgrade-colonne-st-en.md §4–5
 */

import { memo, useRef, useCallback } from 'react';
import type { FluxOutsourcingTask, FluxSTStatus } from './fluxTypes';

// ── ST status cycle ──────────────────────────────────────────────────────────

const ST_CYCLE: FluxSTStatus[] = ['pending', 'progress', 'done'];

function nextSTStatus(current: FluxSTStatus): FluxSTStatus {
  return ST_CYCLE[(ST_CYCLE.indexOf(current) + 1) % 3]!;
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

/** Pending: empty circle ○ */
function PendingIcon() {
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
    </svg>
  );
}

/** Progress: circle with center dot ⊙ */
function ProgressIcon() {
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
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Done: circle with checkmark ✓ (Lucide circle-check style) */
function DoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

interface STCellProps {
  tasks: FluxOutsourcingTask[];
  onUpdateSTStatus: (taskId: string, status: FluxSTStatus) => void;
}

export const STCell = memo(function STCell({ tasks, onUpdateSTStatus }: STCellProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback((text: string, x: number, y: number) => {
    const el = tooltipRef.current;
    if (!el) return;
    el.textContent = text;
    el.style.left = `${x + 14}px`;
    el.style.top = `${y + 14}px`;
    el.style.opacity = '1';
  }, []);

  const moveTooltip = useCallback((x: number, y: number) => {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.left = `${x + 14}px`;
    el.style.top = `${y + 14}px`;
  }, []);

  const hideTooltip = useCallback(() => {
    const el = tooltipRef.current;
    if (!el) return;
    el.style.opacity = '0';
  }, []);

  if (tasks.length === 0) return null;

  return (
    <div className="st-cell" data-testid="st-cell">
      {tasks.map(task => {
        const label = `${task.providerName} · ${task.actionType}`;
        return (
          <div
            key={task.taskId}
            className="st-line"
            onMouseEnter={(e) => showTooltip(label, e.clientX, e.clientY)}
            onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
            onMouseLeave={hideTooltip}
            data-testid={`st-line-${task.taskId}`}
          >
            <button
              className={`st-${task.status}`}
              style={{ display: 'flex', flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              onClick={() => onUpdateSTStatus(task.taskId, nextSTStatus(task.status))}
              aria-label={`${label}: ${task.status}`}
              data-testid={`st-toggle-${task.taskId}`}
              data-status={task.status}
            >
              {task.status === 'pending'  && <PendingIcon />}
              {task.status === 'progress' && <ProgressIcon />}
              {task.status === 'done'     && <DoneIcon />}
            </button>
            <span className="st-label">{label}</span>
          </div>
        );
      })}
      {/* Custom tooltip — position: fixed, follows cursor */}
      <div ref={tooltipRef} className="st-tooltip" />
    </div>
  );
});
