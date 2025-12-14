import { memo } from 'react';
import { cn } from '../../../lib/utils';
import type { Job, JobStatus } from '../../../types';
import { AlertTriangle } from 'lucide-react';

interface JobListItemProps {
  job: Job;
  isSelected: boolean;
  isLate: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  Draft: 'bg-gray-400',
  Planned: 'bg-blue-500',
  InProgress: 'bg-amber-500',
  Delayed: 'bg-red-500',
  Completed: 'bg-green-500',
  Cancelled: 'bg-gray-400',
};

export const JobListItem = memo(function JobListItem({
  job,
  isSelected,
  isLate,
  onClick,
}: JobListItemProps) {
  const statusColor = STATUS_COLORS[job.status];
  const isCancelled = job.status === 'Cancelled';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 border-b transition-colors',
        'hover:bg-muted/50 focus:outline-none focus:bg-muted/50',
        isSelected && 'bg-primary/10 hover:bg-primary/15 focus:bg-primary/15',
        isCancelled && 'opacity-60'
      )}
      aria-selected={isSelected}
      role="option"
    >
      <div className="flex items-start gap-2">
        {/* Status indicator */}
        <div
          className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', statusColor)}
          title={job.status}
        />

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-medium text-sm truncate',
                isCancelled && 'line-through'
              )}
            >
              {job.reference}
            </span>
            {isLate && (
              <AlertTriangle
                className="h-3.5 w-3.5 text-amber-500 shrink-0"
                aria-label="Late job"
              />
            )}
          </div>
          <div
            className={cn(
              'text-xs text-muted-foreground truncate',
              isCancelled && 'line-through'
            )}
          >
            {job.client}
          </div>
        </div>

        {/* Job color indicator */}
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ backgroundColor: job.color }}
        />
      </div>
    </button>
  );
});
