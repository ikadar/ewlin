export interface ProgressDotsProps {
  /** Total number of tasks */
  total: number;
  /** Number of completed tasks */
  completed: number;
}

/**
 * Progress dots showing task completion status.
 * Filled green dots = completed, outline dots = pending.
 */
export function ProgressDots({ total, completed }: ProgressDotsProps) {
  if (total === 0) return null;

  return (
    <div className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < completed
              ? 'bg-emerald-500'
              : 'border border-zinc-700'
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
