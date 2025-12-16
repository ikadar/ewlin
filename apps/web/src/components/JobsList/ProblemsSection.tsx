import type { ReactNode } from 'react';

export interface ProblemsSectionProps {
  /** Number of problems */
  count: number;
  /** Job cards to display */
  children: ReactNode;
}

/**
 * Section for problematic jobs (late, conflicts).
 * Shows "PROBLÈMES" header with count badge.
 */
export function ProblemsSection({ count, children }: ProblemsSectionProps) {
  if (count === 0) return null;

  return (
    <section>
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-red-400/80 uppercase tracking-wider">
          Problèmes
        </span>
        <span className="text-[11px] text-zinc-600">{count}</span>
      </div>
      {children}
    </section>
  );
}
