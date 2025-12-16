import { ChevronUp, ChevronDown } from 'lucide-react';

export interface OffScreenIndicatorProps {
  /** Number of off-screen tiles */
  count: number;
  /** Direction of off-screen tiles */
  direction: 'up' | 'down';
  /** Click handler */
  onClick?: () => void;
}

/**
 * OffScreenIndicator - Shows count of tiles above or below viewport.
 * Displays a chevron icon and count number.
 */
export function OffScreenIndicator({
  count,
  direction,
  onClick,
}: OffScreenIndicatorProps) {
  if (count <= 0) {
    return null;
  }

  const Icon = direction === 'up' ? ChevronUp : ChevronDown;

  return (
    <div
      className="flex items-center gap-1 text-xs text-zinc-500 cursor-pointer hover:text-zinc-400"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      title={`${count} tile${count > 1 ? 's' : ''} ${direction === 'up' ? 'above' : 'below'}`}
    >
      <Icon className="w-3 h-3" />
      <span>{count}</span>
    </div>
  );
}
