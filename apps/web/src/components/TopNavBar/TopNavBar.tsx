import { Crosshair, Minus, Plus, User, Settings } from 'lucide-react';
import { ZOOM_LEVELS } from './constants';

export interface TopNavBarProps {
  /** Whether Quick Placement mode is active */
  isQuickPlacementMode: boolean;
  /** Callback to toggle Quick Placement mode */
  onToggleQuickPlacement: () => void;
  /** Whether Quick Placement can be enabled (requires selected job) */
  canEnableQuickPlacement: boolean;
  /** Current pixels per hour value */
  pixelsPerHour: number;
  /** Callback when zoom level changes */
  onZoomChange: (pixelsPerHour: number) => void;
}

/**
 * TopNavBar - Horizontal navigation bar at the top of the screen.
 * Contains logo, Quick Placement toggle, zoom control, and user/settings placeholders.
 */
export function TopNavBar({
  isQuickPlacementMode,
  onToggleQuickPlacement,
  canEnableQuickPlacement,
  pixelsPerHour,
  onZoomChange,
}: TopNavBarProps) {
  // Find current zoom level index
  const currentZoomIndex = ZOOM_LEVELS.findIndex((z) => z.pixelsPerHour === pixelsPerHour);
  const currentZoomLabel = currentZoomIndex >= 0 ? ZOOM_LEVELS[currentZoomIndex].label : '100%';

  // Zoom handlers
  const handleZoomIn = () => {
    const nextIndex = Math.min(currentZoomIndex + 1, ZOOM_LEVELS.length - 1);
    onZoomChange(ZOOM_LEVELS[nextIndex].pixelsPerHour);
  };

  const handleZoomOut = () => {
    const nextIndex = Math.max(currentZoomIndex - 1, 0);
    onZoomChange(ZOOM_LEVELS[nextIndex].pixelsPerHour);
  };

  const canZoomIn = currentZoomIndex < ZOOM_LEVELS.length - 1;
  const canZoomOut = currentZoomIndex > 0;

  return (
    <nav
      className="h-12 bg-zinc-900 border-b border-white/5 flex items-center justify-between px-4 shrink-0"
      data-testid="top-nav-bar"
    >
      {/* Left section: Logo */}
      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold text-zinc-100" data-testid="nav-logo">
          Flux
        </span>
      </div>

      {/* Center section: Quick Placement + Zoom */}
      <div className="flex items-center gap-6">
        {/* Quick Placement toggle */}
        <button
          onClick={onToggleQuickPlacement}
          disabled={!canEnableQuickPlacement}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${
              !canEnableQuickPlacement
                ? 'text-zinc-600 cursor-not-allowed'
                : isQuickPlacementMode
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }
          `}
          data-testid="quick-placement-button"
          title={canEnableQuickPlacement ? 'Toggle Quick Placement (Alt+Q)' : 'Select a job first'}
        >
          <Crosshair className="w-4 h-4" />
          <span>Quick Place</span>
        </button>

        {/* Zoom control */}
        <div className="flex items-center gap-1" data-testid="zoom-control">
          <button
            onClick={handleZoomOut}
            disabled={!canZoomOut}
            className={`
              p-1.5 rounded transition-colors
              ${canZoomOut ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}
            `}
            data-testid="zoom-out-button"
            title="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span
            className="w-12 text-center text-sm text-zinc-300 font-medium"
            data-testid="zoom-level"
          >
            {currentZoomLabel}
          </span>
          <button
            onClick={handleZoomIn}
            disabled={!canZoomIn}
            className={`
              p-1.5 rounded transition-colors
              ${canZoomIn ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}
            `}
            data-testid="zoom-in-button"
            title="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right section: User/Settings placeholders */}
      <div className="flex items-center gap-2">
        <button
          disabled
          className="p-2 text-zinc-600 cursor-not-allowed"
          data-testid="user-button"
          title="User (coming soon)"
        >
          <User className="w-5 h-5" />
        </button>
        <button
          disabled
          className="p-2 text-zinc-600 cursor-not-allowed"
          data-testid="settings-button"
          title="Settings (coming soon)"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
