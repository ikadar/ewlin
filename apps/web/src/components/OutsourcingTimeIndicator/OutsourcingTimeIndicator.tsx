/**
 * OutsourcingTimeIndicator - Visual indicator for outsourcing time during drag operations.
 *
 * Shows:
 * - Cyan vertical arrow from outsourced task departure to return
 * - Dashed horizontal line at the "End of outsourcing" position
 * - "Fin outsourcing" label
 *
 * v0.5.13: Outsourcing Drag Visualization
 */

export interface OutsourcingTimeIndicatorProps {
  /** Y position of outsourced task departure */
  departureY: number;
  /** Y position where outsourced task returns */
  returnY: number;
  /** Whether the indicator should be visible */
  isVisible: boolean;
}

/**
 * Renders the outsourcing time visualization during drag operations.
 * Uses cyan/teal color scheme to distinguish from drying time (yellow).
 */
export function OutsourcingTimeIndicator({
  departureY,
  returnY,
  isVisible,
}: OutsourcingTimeIndicatorProps) {
  if (!isVisible) return null;

  const arrowHeight = returnY - departureY;

  // Don't render if arrow would be too small or negative
  if (arrowHeight <= 0) return null;

  return (
    <>
      {/* Cyan vertical arrow line */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: `${departureY}px`,
          height: `${arrowHeight}px`,
          width: '2px',
          background: 'linear-gradient(to bottom, #06b6d4, #0891b2)',
        }}
        data-testid="outsourcing-time-arrow"
      />

      {/* Arrowhead at bottom */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: `${returnY - 8}px`,
        }}
        data-testid="outsourcing-time-arrowhead"
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M6 10L0 0H12L6 10Z" fill="#0891b2" />
        </svg>
      </div>

      {/* Dashed horizontal line at return time */}
      <div
        className="absolute left-0 right-0 z-20 pointer-events-none border-t-2 border-dashed border-cyan-600"
        style={{
          top: `${returnY}px`,
        }}
        data-testid="outsourcing-time-line"
      />

      {/* "Fin outsourcing" label */}
      <div
        className="absolute z-20 pointer-events-none text-xs text-cyan-500 font-medium whitespace-nowrap"
        style={{
          top: `${returnY - 24}px`,
          right: '8px',
          textAlign: 'right',
        }}
        data-testid="outsourcing-time-label"
      >
        <div>Fin</div>
        <div>outsourcing</div>
      </div>
    </>
  );
}
