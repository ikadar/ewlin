import { Timer } from 'lucide-react';

/**
 * DryTimeLabel component displays the "+4h drying" label between printing tasks
 * and their successors in the JobDetailsPanel task list.
 */
export function DryTimeLabel() {
  return (
    <div
      className="flex items-center justify-center gap-1.5 py-1.5 text-xs text-amber-400/80"
      data-testid="dry-time-label"
    >
      <div className="flex-1 h-px bg-amber-400/30" />
      <Timer className="w-3 h-3" />
      <span>+4h drying</span>
      <div className="flex-1 h-px bg-amber-400/30" />
    </div>
  );
}
