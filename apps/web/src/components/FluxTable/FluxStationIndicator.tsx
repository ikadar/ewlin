import { memo } from 'react';
import { STATION_STATE_LABEL, type FluxStationData } from './fluxTypes';

interface FluxStationIndicatorProps {
  data: FluxStationData | undefined;
  stationName: string;
}

// Ring geometry (spec 3.10)
const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 50.265

// Colors matching spec 3.10
const STATE_COLOR: Record<string, string> = {
  planned:      'rgb(156 163 175)', // zinc-400 / gray
  'in-progress':'rgb(251 146 60)',  // orange-400
  late:         'rgb(248 113 113)', // red-400
  done:         'rgb(74 222 128)',  // green-400
};

/**
 * Ring+dot SVG station progress indicator for the Flux Dashboard.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, section 3.10
 *
 * States:
 * - empty: blank cell (no SVG)
 * - planned: small dot, 25% opacity
 * - in-progress: track ring + progress arc + center dot (orange)
 * - late: track ring + progress arc + center dot (red)
 * - done: larger dot, 70% opacity (green)
 */
export const FluxStationIndicator = memo(function FluxStationIndicator({
  data,
  stationName,
}: FluxStationIndicatorProps) {
  if (!data || data.state === 'empty') return null;

  const { state, progress = 0 } = data;
  const color = STATE_COLOR[state];
  const stateLabel = STATION_STATE_LABEL[state];
  const tooltipText = stateLabel ? `${stationName} — ${stateLabel}` : stationName;

  if (state === 'planned') {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-label={tooltipText}
        data-testid="flux-station-indicator"
        data-state={state}
      >
        <title>{tooltipText}</title>
        <circle cx="12" cy="12" r="3.5" fill={color} fillOpacity="0.25" />
      </svg>
    );
  }

  if (state === 'done') {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-label={tooltipText}
        data-testid="flux-station-indicator"
        data-state={state}
      >
        <title>{tooltipText}</title>
        <circle cx="12" cy="12" r="5" fill={color} fillOpacity="0.7" />
      </svg>
    );
  }

  // in-progress or late: track ring + arc + center dot
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-label={tooltipText}
      data-testid="flux-station-indicator"
      data-state={state}
    >
      <title>{tooltipText}</title>
      {/* Track ring */}
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.12"
      />
      {/* Progress arc */}
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 12 12)"
      />
      {/* Center dot */}
      <circle cx="12" cy="12" r="3.5" fill={color} fillOpacity="0.7" />
    </svg>
  );
});
