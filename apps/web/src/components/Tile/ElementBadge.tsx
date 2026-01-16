export interface ElementBadgeProps {
  /** Element suffix to display (e.g., "couv", "int", "fin") */
  suffix: string;
}

/**
 * Badge displaying element suffix on tiles.
 * Only shown for multi-element jobs.
 */
export function ElementBadge({ suffix }: ElementBadgeProps) {
  return (
    <span
      className="bg-black/50 rounded-sm px-1 text-xs font-normal shrink-0"
      data-testid="element-badge"
    >
      {suffix.toLowerCase()}
    </span>
  );
}
