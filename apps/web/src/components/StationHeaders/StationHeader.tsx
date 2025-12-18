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
  /** Whether this station has tiles that can be compacted */
  hasTiles?: boolean;
  /** Whether compact operation is in progress for this station */
  isCompacting?: boolean;
  /** Callback when compact button is clicked */
  onCompact?: (stationId: string) => void;
}

/**
 * Compress/minimize icon for compact button.
 */
function CompressIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Vertical arrows pointing inward */}
      <path d="M12 3v6" />
      <path d="M9 6l3-3 3 3" />
      <path d="M12 21v-6" />
      <path d="M9 18l3 3 3-3" />
      {/* Horizontal lines representing compressed content */}
      <path d="M4 12h16" />
    </svg>
  );
}

/**
 * Loading spinner for compact button.
 */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * StationHeader - Individual station header cell.
 * Shows station name, compact button, and optional off-screen indicators.
 */
export function StationHeader({
  station,
  offScreen,
  onOffScreenClick,
  isCollapsed = false,
  hasTiles = false,
  isCompacting = false,
  onCompact,
}: StationHeaderProps) {
  const _hasIndicator = offScreen && (offScreen.above > 0 || offScreen.below > 0);

  // Width: full (240px / w-60) or collapsed (120px / w-30)
  const widthClass = isCollapsed ? 'w-30' : 'w-60';

  // Compact button is disabled when no tiles or during loading
  const isCompactDisabled = !hasTiles || isCompacting;

  const handleCompactClick = () => {
    if (!isCompactDisabled && onCompact) {
      onCompact(station.id);
    }
  };

  const getCompactButtonTitle = () => {
    if (isCompacting) return 'Compacting...';
    if (hasTiles) return 'Compact station';
    return 'No tiles to compact';
  };

  return (
    <div
      className={`${widthClass} shrink-0 py-2 px-3 text-sm font-medium text-zinc-300 transition-all duration-150 ease-out flex items-center justify-between`}
      data-testid={`station-header-${station.id}`}
    >
      <span className="truncate">{station.name}</span>
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
        {/* Compact button */}
        {onCompact && !isCollapsed && (
          <button
            type="button"
            onClick={handleCompactClick}
            disabled={isCompactDisabled}
            className={`p-1 rounded transition-colors ${
              isCompactDisabled
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
            }`}
            title={getCompactButtonTitle()}
            data-testid={`compact-button-${station.id}`}
          >
            {isCompacting ? <Spinner /> : <CompressIcon />}
          </button>
        )}
      </div>
    </div>
  );
}
