/**
 * PlacementIndicator - Visual indicator for Quick Placement Mode.
 * Shows a glowing white line at the placement position.
 */

export interface PlacementIndicatorProps {
  /** Vertical position in pixels */
  y: number;
  /** Whether the indicator is visible */
  isVisible: boolean;
}

/**
 * A glowing white line that indicates where a tile will be placed.
 * Used in Quick Placement Mode to show the snap position.
 */
export function PlacementIndicator({ y, isVisible }: PlacementIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div
      className="absolute left-0 right-0 h-1 bg-white z-30 pointer-events-none"
      style={{
        top: `${y}px`,
        boxShadow: '0 0 12px rgba(255, 255, 255, 0.8)',
      }}
      data-testid="placement-indicator"
    />
  );
}
