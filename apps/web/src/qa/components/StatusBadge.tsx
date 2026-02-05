/**
 * Status Badge Component
 *
 * Shows a colored badge representing test status.
 */

import { cn } from '@/utils/cn';
import type { TestStatus } from '../types';

interface StatusBadgeProps {
  status: TestStatus;
  className?: string;
}

const statusConfig: Record<TestStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-emerald-500/20 text-emerald-400' },
  ko: { label: 'KO', className: 'bg-red-500/20 text-red-400' },
  partial: { label: 'Partial', className: 'bg-amber-500/20 text-amber-400' },
  untested: { label: 'Untested', className: 'bg-zinc-500/20 text-zinc-400' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-base font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
