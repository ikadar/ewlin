import type { Station, StationCategory } from '@flux/types';
import { getDefaultCategoryWidth } from '../../utils/tileLabelResolver';
import { OffScreenIndicator } from './OffScreenIndicator';

export interface OffScreenInfo {
  /** Count of tiles above viewport */
  above: number;
  /** Count of tiles below viewport */
  below: number;
}

/** Group capacity information for display */
export interface GroupCapacityInfo {
  /** Group ID */
  groupId: string;
  /** Group name */
  groupName: string;
  /** Maximum concurrent tasks (null = unlimited) */
  maxConcurrent: number | null;
  /** Current number of concurrent tasks in the group */
  currentUsage: number;
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
  /** Group capacity information (REQ-18) */
  groupCapacity?: GroupCapacityInfo;
  /** Current display mode (for dynamic column width) */
  displayMode?: 'produit' | 'tirage';
  /** Station category (for columnWidth lookup) */
  category?: StationCategory;
}

/**
 * StationHeader - Individual station header cell.
 * Shows station name and optional off-screen indicators.
 */
export function StationHeader({
  station,
  offScreen,
  onOffScreenClick,
  isCollapsed: _isCollapsed = false,
  groupCapacity: _groupCapacity, // REQ-06: Group capacity display removed from header
  displayMode: _displayMode,
  category,
}: StationHeaderProps) {
  // Custom width: explicit DB value takes priority, then category-based default, then CSS w-60.
  const customWidth = category?.columnWidth ?? (category ? getDefaultCategoryWidth(category.name) : null);

  return (
    <div
      className={`${customWidth === null ? 'w-60' : ''} shrink-0 py-2 px-3 text-sm transition-[filter,opacity] duration-150 ease-out flex items-center justify-between`}
      style={customWidth !== null ? { width: `${customWidth}px` } : {}}
      data-testid={`station-header-${station.id}`}
    >
      <span className="font-medium text-zinc-300 truncate">{station.name}</span>
      <div className="flex items-center gap-1">
        {/* Off-screen indicators */}
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
    </div>
  );
}
