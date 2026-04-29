import { memo } from 'react';
import type { FluxJobStatus } from './fluxAggregation';

const STATUS_CONFIG: Record<FluxJobStatus, { color: string; label: string }> = {
  late:      { color: 'rgb(239 68 68)',   label: 'En retard' },     // red-500
  conflict:  { color: 'rgb(250 204 21)',  label: 'En conflit' },    // yellow-400
  planned:   { color: 'rgb(59 130 246)',  label: 'Planifié' },      // blue-500
  unplanned: { color: 'rgb(113 113 122)', label: 'Non planifié' },  // zinc-500
};

/**
 * Small colored dot indicating job-level status (conflict / late / planned /
 * unplanned). Renders inline before the job ID in the Flux table.
 */
export const FluxJobStatusDot = memo(function FluxJobStatusDot({
  status,
}: {
  status: FluxJobStatus;
}) {
  const { color, label } = STATUS_CONFIG[status];

  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      className="shrink-0"
      aria-label={label}
      data-testid="flux-job-status-dot"
      data-status={status}
    >
      <title>{label}</title>
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
});
