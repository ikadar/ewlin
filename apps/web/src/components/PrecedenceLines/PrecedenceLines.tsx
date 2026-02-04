/**
 * PrecedenceLines - Visual indicators for task precedence constraints during drag.
 *
 * Shows two horizontal lines in the station column:
 * - Purple line: Earliest possible start (predecessor end + dry time)
 * - Orange line: Latest possible start (successor start - task duration)
 *
 * REQ-10: Precedence Constraint Visualization
 */

export interface PrecedenceLinesProps {
  /** Y position for earliest possible start line (purple) */
  earliestY: number | null;
  /** Y position for latest possible start line (orange) */
  latestY: number | null;
  /** Whether the lines should be visible */
  isVisible: boolean;
}

/**
 * Renders constraint lines during drag operations.
 * Uses glow effect similar to PlacementIndicator for visibility.
 */
export function PrecedenceLines({ earliestY, latestY, isVisible }: PrecedenceLinesProps) {
  if (!isVisible) return null;

  return (
    <>
      {/* Purple line - Earliest possible start (predecessor constraint) */}
      {earliestY !== null && (
        <div
          className="absolute left-0 right-0 h-1 bg-purple-500 z-30 pointer-events-none"
          style={{
            top: `${earliestY}px`,
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.8)',
          }}
          data-testid="precedence-line-earliest"
        />
      )}

      {/* Orange line - Latest possible start (successor constraint) */}
      {latestY !== null && (
        <div
          className="absolute left-0 right-0 h-1 bg-orange-500 z-30 pointer-events-none"
          style={{
            top: `${latestY}px`,
            boxShadow: '0 0 12px rgba(249, 115, 22, 0.8)',
          }}
          data-testid="precedence-line-latest"
        />
      )}
    </>
  );
}
