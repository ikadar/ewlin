import { AlertCircle, Shuffle } from 'lucide-react';
import { ProgressDots } from './ProgressDots';

export type JobProblemType = 'late' | 'conflict' | null;

export interface JobCardProps {
  /** Job ID */
  id: string;
  /** Job reference number */
  reference: string;
  /** Client name */
  client: string;
  /** Job description */
  description: string;
  /** Total number of tasks */
  taskCount: number;
  /** Number of completed tasks */
  completedTaskCount: number;
  /** Deadline date string (e.g., "17/12") */
  deadline?: string;
  /** Problem type if any */
  problemType?: JobProblemType;
  /** Whether the job is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Individual job card with reference, client, description, and progress dots.
 * Supports normal, late, conflict, and selected states.
 */
export function JobCard({
  id,
  reference,
  client,
  description,
  taskCount,
  completedTaskCount,
  deadline,
  problemType,
  isSelected = false,
  onClick,
}: JobCardProps) {
  const baseClasses = 'mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors';

  const stateClasses = (() => {
    if (problemType === 'late') {
      return isSelected
        ? 'bg-red-500/20 border border-red-500/30'
        : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15';
    }
    if (problemType === 'conflict') {
      return isSelected
        ? 'bg-amber-500/20 border border-amber-500/30'
        : 'bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15';
    }
    return isSelected
      ? 'bg-white/10 border border-white/10'
      : 'hover:bg-white/5';
  })();

  const referenceColor = (() => {
    if (problemType === 'late') return 'text-red-300';
    if (problemType === 'conflict') return 'text-amber-300';
    return 'text-zinc-500';
  })();

  const ProblemIcon = problemType === 'late' ? AlertCircle : problemType === 'conflict' ? Shuffle : null;
  const iconColor = problemType === 'late' ? 'text-red-400' : 'text-amber-400';

  return (
    <div
      className={`${baseClasses} ${stateClasses}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      data-testid={`job-card-${id}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Header row: reference · client + date/icon */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`font-mono text-[13px] ${referenceColor}`}>{reference}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400 truncate">{client}</span>
        {ProblemIcon ? (
          <ProblemIcon className={`w-4 h-4 ml-auto ${iconColor}`} />
        ) : deadline ? (
          <span className="text-zinc-600 text-xs ml-auto">{deadline}</span>
        ) : null}
      </div>

      {/* Description */}
      <div className={`truncate mb-1.5 ${problemType ? 'text-zinc-100' : 'text-zinc-300'}`}>
        {description}
      </div>

      {/* Footer: progress dots (left) + badge (right) */}
      <div className="flex items-center justify-between">
        <ProgressDots total={taskCount} completed={completedTaskCount} />
        {problemType === 'late' && (
          <span className="text-xs font-medium text-red-400">En retard</span>
        )}
        {problemType === 'conflict' && (
          <span className="text-xs font-medium text-amber-400">Conflit</span>
        )}
      </div>
    </div>
  );
}
