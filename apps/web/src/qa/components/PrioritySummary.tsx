/**
 * Priority Summary Component
 *
 * Shows dots for each priority level with progress.
 * Example: P1: ●●○ 2/3  P2: ●○○ 1/2
 */

import { cn } from '@/utils/cn';
import { StatusDots } from './StatusDots';
import type { Priority, PriorityProgress } from '../types';

interface PrioritySummaryProps {
  byPriority: Record<Priority, PriorityProgress>;
}

const priorityColors: Record<Priority, string> = {
  P1: 'text-red-400',
  P2: 'text-orange-400',
  P3: 'text-yellow-400',
  P4: 'text-blue-400',
  P5: 'text-zinc-400',
};

export function PrioritySummary({ byPriority }: PrioritySummaryProps) {
  const priorities: Priority[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

  return (
    <div className="flex flex-col gap-1 px-3 py-2 border-b border-zinc-800 text-base">
      {priorities.map((p) => {
        const prog = byPriority[p];
        if (!prog || prog.total === 0) return null;
        return (
          <div key={p} className="flex items-center gap-1.5">
            <span className={cn('font-semibold w-6', priorityColors[p])}>{p}:</span>
            <StatusDots progress={prog} />
            <span className="text-zinc-500">
              {prog.ok}/{prog.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
