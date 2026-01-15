/**
 * PrecedenceLines - Visual indicators for task precedence constraints during drag.
 *
 * Shows two horizontal lines in the station column:
 * - Purple line: Earliest possible start (predecessor end + dry time)
 * - Orange line: Latest possible start (successor start - task duration)
 *
 * REQ-10: Precedence Constraint Visualization
 * v0.3.56: Added contextual labels showing constraining task and effective time
 */

/** Label info for a precedence constraint line */
export interface PrecedenceLabel {
  /** Name of the constraining task */
  taskName: string;
  /** Effective time (HH:MM format) */
  time: string;
}

export interface PrecedenceLinesProps {
  /** Y position for earliest possible start line (purple) */
  earliestY: number | null;
  /** Y position for latest possible start line (orange) */
  latestY: number | null;
  /** Whether the lines should be visible */
  isVisible: boolean;
  /** v0.3.56: Label for earliest constraint (predecessor info) */
  earliestLabel?: PrecedenceLabel | null;
  /** v0.3.56: Label for latest constraint (successor info) */
  latestLabel?: PrecedenceLabel | null;
}

/**
 * Renders constraint lines during drag operations.
 * Uses glow effect similar to PlacementIndicator for visibility.
 * v0.3.56: Now includes contextual labels above/below lines.
 */
export function PrecedenceLines({
  earliestY,
  latestY,
  isVisible,
  earliestLabel,
  latestLabel,
}: PrecedenceLinesProps) {
  if (!isVisible) return null;

  return (
    <>
      {/* Purple line - Earliest possible start (predecessor constraint) */}
      {earliestY !== null && (
        <div
          className="absolute left-0 right-0 z-30 pointer-events-none"
          style={{ top: `${earliestY}px` }}
        >
          {/* v0.3.56: Label above the line */}
          {earliestLabel && (
            <div
              className="absolute left-1 -translate-y-full pb-1"
              data-testid="precedence-label-earliest"
            >
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-200 whitespace-nowrap">
                ↑ {earliestLabel.taskName} · {earliestLabel.time}
              </span>
            </div>
          )}
          {/* The line itself */}
          <div
            className="h-1 bg-purple-500"
            style={{ boxShadow: '0 0 12px rgba(168, 85, 247, 0.8)' }}
            data-testid="precedence-line-earliest"
          />
        </div>
      )}

      {/* Orange line - Latest possible start (successor constraint) */}
      {latestY !== null && (
        <div
          className="absolute left-0 right-0 z-30 pointer-events-none"
          style={{ top: `${latestY}px` }}
        >
          {/* The line itself */}
          <div
            className="h-1 bg-orange-500"
            style={{ boxShadow: '0 0 12px rgba(249, 115, 22, 0.8)' }}
            data-testid="precedence-line-latest"
          />
          {/* v0.3.56: Label below the line */}
          {latestLabel && (
            <div
              className="absolute left-1 pt-1"
              data-testid="precedence-label-latest"
            >
              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/80 text-orange-200 whitespace-nowrap">
                ↓ {latestLabel.taskName} · {latestLabel.time}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
