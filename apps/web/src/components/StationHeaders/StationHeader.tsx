import { Link, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { Station, StationCategory } from '@flux/types';
import { getDefaultCategoryWidth } from '../../utils/tileLabelResolver';
import { OffScreenIndicator } from './OffScreenIndicator';
import { StationSettingsButton } from './StationSettingsButton';
import { useScenarioMode } from '../../contexts/ScenarioContext';

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
  displayMode: _displayMode,
  category,
}: StationHeaderProps) {
  const location = useLocation();
  const { mode } = useScenarioMode();
  // Custom width: explicit DB value takes priority, then category-based default, then CSS w-60.
  const customWidth = category?.columnWidth ?? (category ? getDefaultCategoryWidth(category.name) : null);

  return (
    <div
      className={`group ${customWidth === null ? 'w-60' : ''} shrink-0 py-2 px-3 text-sm transition-[filter,opacity] duration-150 ease-out flex items-center justify-between gap-2`}
      style={customWidth !== null ? { width: `${customWidth}px` } : {}}
      data-testid={`station-header-${station.id}`}
    >
      <span className="font-medium text-zinc-300 truncate min-w-0">{station.name}</span>
      <div className="flex items-center gap-1 shrink-0">
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
        {mode !== 'prod' && (
          <StationSettingsButton stationId={station.id} stationLabel={station.name} />
        )}
        {mode === 'prod' && (
          <Link
            to={`/focus/station/${station.id}${location.search}`}
            aria-label={`Ouvrir la vue focus de ${station.name}`}
            className="text-zinc-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-zinc-200"
            data-testid={`station-header-focus-link-${station.id}`}
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
