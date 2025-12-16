import type { Station } from '@flux/types';
import { StationHeader, type OffScreenInfo } from './StationHeader';

export interface StationHeadersProps {
  /** Stations to display */
  stations: Station[];
  /** Off-screen tile counts per station (keyed by station ID) */
  offScreenByStation?: Record<string, OffScreenInfo>;
  /** Click handler for off-screen indicator */
  onOffScreenClick?: (stationId: string, direction: 'up' | 'down') => void;
}

/**
 * StationHeaders - Sticky header row containing all station headers.
 * Displays station names with optional off-screen indicators.
 */
export function StationHeaders({
  stations,
  offScreenByStation,
  onOffScreenClick,
}: StationHeadersProps) {
  return (
    <div className="flex gap-3 px-3 bg-zinc-900 border-b border-white/10 shrink-0 sticky top-0 z-30">
      {stations.map((station) => (
        <StationHeader
          key={station.id}
          station={station}
          offScreen={offScreenByStation?.[station.id]}
          onOffScreenClick={
            onOffScreenClick
              ? (direction) => onOffScreenClick(station.id, direction)
              : undefined
          }
        />
      ))}
    </div>
  );
}
