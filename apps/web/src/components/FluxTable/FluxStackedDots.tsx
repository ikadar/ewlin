import { memo } from 'react';
import { sortStationDataBySeverity } from './fluxAggregation';
import type { FluxStationData } from './fluxTypes';

interface FluxStackedDotsProps {
  /** Station states for each element at this station, in any order. Will be sorted worst-first. */
  data: FluxStationData[];
  stationName: string;
}

const DOT_RADIUS = 5;
const DOT_GAP = 6; // gap between circle centers (spec 3.11)
const SVG_SIZE = 24;

const STATE_COLOR: Record<string, string> = {
  planned:      'rgb(156 163 175)',
  'in-progress':'rgb(251 146 60)',
  late:         'rgb(248 113 113)',
  done:         'rgb(74 222 128)',
  empty:        'transparent',
};

// Background color for stroke (to create separation between overlapping dots)
const BG_COLOR = 'rgb(36 36 36)'; // flux-elevated

/**
 * Stacked overlapping dots for collapsed multi-element station cells.
 * Shows one dot per element that has a task at this station, sorted worst-first.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, section 3.11, 6.3
 */
export const FluxStackedDots = memo(function FluxStackedDots({
  data,
  stationName,
}: FluxStackedDotsProps) {
  const nonEmpty = data.filter(d => d.state !== 'empty');
  if (nonEmpty.length === 0) return null;

  const sorted = sortStationDataBySeverity(nonEmpty);
  const count = sorted.length;

  // Center the dots horizontally within the 24px SVG
  const totalSpan = (count - 1) * DOT_GAP;
  const startX = SVG_SIZE / 2 - totalSpan / 2;

  return (
    <svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      aria-label={stationName}
      data-testid="flux-stacked-dots"
    >
      <title>{stationName}</title>
      {sorted.map((d, i) => (
        <circle
          key={i}
          cx={startX + i * DOT_GAP}
          cy={SVG_SIZE / 2}
          r={DOT_RADIUS}
          fill={STATE_COLOR[d.state] ?? 'transparent'}
          stroke={BG_COLOR}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
});
