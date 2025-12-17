import type { Station } from '@flux/types';
import { OffScreenIndicator } from './OffScreenIndicator';

export interface OffScreenInfo {
  /** Count of tiles above viewport */
  above: number;
  /** Count of tiles below viewport */
  below: number;
}

export interface StationHeaderProps {
  /** Station to display */
  station: Station;
  /** Off-screen tile counts (optional) */
  offScreen?: OffScreenInfo;
  /** Click handler for off-screen indicator */
  onOffScreenClick?: (direction: 'up' | 'down') => void;
  /** Whether this header is collapsed (during drag to another station) */
  isCollapsed?: boolean;
}

/**
 * StationHeader - Individual station header cell.
 * Shows station name and optional off-screen indicators.
 */
export function StationHeader({
  station,
  offScreen,
  onOffScreenClick,
  isCollapsed = false,
}: StationHeaderProps) {
  const hasIndicator = offScreen && (offScreen.above > 0 || offScreen.below > 0);

  // Width: full (240px / w-60) or collapsed (120px / w-30)
  const widthClass = isCollapsed ? 'w-30' : 'w-60';

  return (
    <div
      className={`${widthClass} shrink-0 py-2 px-3 text-sm font-medium text-zinc-300 transition-all duration-150 ease-out ${
        hasIndicator ? 'flex items-center justify-between' : ''
      }`}
    >
      <span>{station.name}</span>
      {offScreen && offScreen.above > 0 && (
        <OffScreenIndicator
          count={offScreen.above}
          direction="up"
          onClick={() => onOffScreenClick?.('up')}
        />
      )}
      {offScreen && offScreen.below > 0 && (
        <OffScreenIndicator
          count={offScreen.below}
          direction="down"
          onClick={() => onOffScreenClick?.('down')}
        />
      )}
    </div>
  );
}
