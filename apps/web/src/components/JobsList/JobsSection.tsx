import type { ReactNode } from 'react';

export interface JobsSectionProps {
  /** Job cards to display */
  children: ReactNode;
}

/**
 * Section for normal jobs.
 * Shows "TRAVAUX" header.
 */
export function JobsSection({ children }: JobsSectionProps) {
  return (
    <section>
      <div className="px-3 py-2 mt-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          Travaux
        </span>
      </div>
      {children}
    </section>
  );
}
