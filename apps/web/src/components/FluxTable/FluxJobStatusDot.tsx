import { memo } from 'react';
import type { FluxJobStatus } from './fluxAggregation';

const STATUS_CONFIG: Record<Exclude<FluxJobStatus, null>, { color: string; label: string }> = {
  late:     { color: 'rgb(248 113 113)', label: 'En retard' },   // red-400
  conflict: { color: 'rgb(251 191 36)',  label: 'Conflit' },     // amber-400
};

/**
 * Small colored dot indicating job-level status (late / conflict).
 * Renders inline before the job ID in the Flux table.
 */
export const FluxJobStatusDot = memo(function FluxJobStatusDot({
  status,
}: {
  status: FluxJobStatus;
}) {
  if (!status) return null;

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
