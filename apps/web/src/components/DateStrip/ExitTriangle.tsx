export interface ExitTriangleProps {
  /** Optional custom class for styling */
  className?: string;
}

/**
 * ExitTriangle - Gray right-angled triangle in the bottom-right corner.
 *
 * Indicates the workshop exit date for the selected job.
 * One leg along the bottom edge, one leg along the right edge.
 * Creates a "corner fold" appearance.
 */
export function ExitTriangle({ className = '' }: ExitTriangleProps) {
  return (
    <div
      className={`absolute bottom-0 right-0 pointer-events-none ${className}`}
      data-testid="exit-triangle"
    >
      {/* Right-angled triangle in bottom-right corner */}
      <div
        className="w-0 h-0 border-b-[10px] border-l-[10px] border-b-zinc-400 border-l-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
