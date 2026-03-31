import { memo } from 'react';
import { PREREQUISITE_BADGE_LABEL, PREREQUISITE_STATUS_COLOR, type PrerequisiteStatus } from './fluxTypes';

interface FluxPrerequisiteBadgeProps {
  status: PrerequisiteStatus;
  /**
   * If set, shows a "+N" muted label after the badge.
   * Used for collapsed multi-element parent rows (spec 3.11).
   * N = total elements - 1.
   */
  plusCount?: number;
  /** Status change date in JJ/MM format (e.g. "15/03"). Shown next to badge when set. */
  date?: string | null;
}

const COLOR_CLASSES: Record<string, string> = {
  green:  'bg-green-900/20 text-green-400 border-green-800/50',
  yellow: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/50',
  red:    'bg-red-900/20 text-red-400 border-red-800/50',
  gray:   'bg-zinc-700/25 text-zinc-500 border-zinc-700/50',
};

/**
 * Read-only prerequisite status badge for the Flux Dashboard.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, section 3.8
 */
export const FluxPrerequisiteBadge = memo(function FluxPrerequisiteBadge({
  status,
  plusCount,
  date,
}: FluxPrerequisiteBadgeProps) {
  const color = PREREQUISITE_STATUS_COLOR[status] ?? 'gray';
  const colorClass = COLOR_CLASSES[color];

  return (
    <span className="inline-flex items-center gap-1" data-testid="flux-prereq-badge">
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded-[0.25rem] border font-medium whitespace-nowrap leading-snug ${colorClass}`}
        style={{ fontSize: '11px' }}
        data-color={color}
      >
        {PREREQUISITE_BADGE_LABEL[status] ?? status}
      </span>
      {date && (
        <span
          className="text-zinc-600 whitespace-nowrap leading-none font-mono"
          style={{ fontSize: '10px' }}
        >
          {date}
        </span>
      )}
      {plusCount != null && plusCount > 0 && (
        <span
          className="text-flux-text-muted whitespace-nowrap font-semibold leading-none"
          style={{ fontSize: '9px' }}
          data-testid="flux-prereq-plus-count"
        >
          +{plusCount}
        </span>
      )}
    </span>
  );
});
