import { type ReactNode } from 'react';
import type { OutsourcedProvider } from '@flux/types';
import { PIXELS_PER_HOUR } from '../TimelineColumn';

export interface ProviderColumnProps {
  /** Provider to display */
  provider: OutsourcedProvider;
  /** Starting hour of the grid (e.g., 6 for 6:00 AM) */
  startHour?: number;
  /** Number of hours to display */
  hoursToDisplay?: number;
  /** Pixels per hour for grid scaling (default: 80) */
  pixelsPerHour?: number;
  /** Children (tiles) to render inside the column */
  children?: ReactNode;
  /** Whether this column is collapsed (during drag to another station) */
  isCollapsed?: boolean;
}

/**
 * ProviderColumn - Column for outsourced provider tasks.
 * Similar to StationColumn but with distinct styling:
 * - Dotted left border
 * - Darker background
 * - No drag-drop functionality (providers are read-only for now)
 */
export function ProviderColumn({
  provider,
  startHour: _startHour = 6,
  hoursToDisplay = 24,
  pixelsPerHour = PIXELS_PER_HOUR,
  children,
  isCollapsed = false,
}: ProviderColumnProps) {
  // Calculate total height
  const totalHeight = hoursToDisplay * pixelsPerHour;

  // Generate hour grid lines
  const gridLines: number[] = [];
  for (let i = 0; i <= hoursToDisplay; i++) {
    gridLines.push(i * pixelsPerHour);
  }

  // Column width: full (240px / w-60) or collapsed (120px / w-30)
  const widthClass = isCollapsed ? 'w-30' : 'w-60';

  return (
    <div
      className={`${widthClass} shrink-0 bg-zinc-900/50 relative transition-all duration-150 ease-out border-l-2 border-dashed border-zinc-600`}
      style={{ height: `${totalHeight}px` }}
      data-testid={`provider-column-${provider.id}`}
    >
      {/* Hour grid lines */}
      {gridLines.map((top) => (
        <div
          key={top}
          className="absolute left-0 right-0 h-px bg-zinc-700/30 pointer-events-none"
          style={{ top: `${top}px` }}
          data-testid="hour-grid-line"
        />
      ))}

      {/* Tiles (children) */}
      {children}
    </div>
  );
}
