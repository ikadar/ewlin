/**
 * DryingTimeIndicator - Visual indicator for drying time during drag operations.
 *
 * Shows:
 * - Yellow vertical arrow from predecessor task end to drying end
 * - Dashed horizontal line at the "End of drying" position
 * - "End of drying" label
 *
 * v0.3.51: Drying Time Visualization
 */

export interface DryingTimeIndicatorProps {
  /** Y position of predecessor task end */
  predecessorEndY: number;
  /** Y position where drying time ends */
  dryingEndY: number;
  /** Whether the indicator should be visible */
  isVisible: boolean;
}

/**
 * Renders the drying time visualization during drag operations.
 * Uses yellow/gold color scheme to distinguish from constraint lines.
 */
export function DryingTimeIndicator({
  predecessorEndY,
  dryingEndY,
  isVisible,
}: DryingTimeIndicatorProps) {
  if (!isVisible) return null;

  const arrowHeight = dryingEndY - predecessorEndY;

  // Don't render if arrow would be too small or negative
  if (arrowHeight <= 0) return null;

  return (
    <>
      {/* Yellow vertical arrow line */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: `${predecessorEndY}px`,
          height: `${arrowHeight}px`,
          width: '2px',
          background: 'linear-gradient(to bottom, #eab308, #ca8a04)',
        }}
        data-testid="drying-time-arrow"
      />

      {/* Arrowhead at bottom */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: `${dryingEndY - 8}px`,
        }}
        data-testid="drying-time-arrowhead"
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M6 10L0 0H12L6 10Z" fill="#ca8a04" />
        </svg>
      </div>

      {/* Dashed horizontal line at drying end */}
      <div
        className="absolute left-0 right-0 z-20 pointer-events-none border-t-2 border-dashed border-yellow-600"
        style={{
          top: `${dryingEndY}px`,
        }}
        data-testid="drying-time-line"
      />

      {/* "End of drying" label */}
      <div
        className="absolute z-20 pointer-events-none text-xs text-yellow-500 font-medium whitespace-nowrap"
        style={{
          top: `${dryingEndY - 24}px`,
          right: '8px',
          textAlign: 'right',
        }}
        data-testid="drying-time-label"
      >
        <div>End of</div>
        <div>drying</div>
      </div>
    </>
  );
}
