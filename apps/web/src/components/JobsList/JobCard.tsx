import { memo, useCallback } from 'react';
import { Calendar, CalendarCheck } from 'lucide-react';

export type JobProblemType = 'late' | 'conflict' | null;

export interface JobCardProps {
  id: string;
  reference: string;
  client: string;
  description: string;
  /** Workshop exit date (departure), already formatted. */
  deadline?: string;
  /** BAT deadline, already formatted. Shown below the departure date when present. */
  batDeadline?: string;
  problemType?: JobProblemType;
  /** Whether all tasks are completed (distinct from problemType). */
  isCompleted?: boolean;
  /** Whether the job has at least one scheduled assignment. */
  isPlanified?: boolean;
  isSelected?: boolean;
  /** Dim this card because another job is selected (spotlight pattern). */
  dim?: boolean;
  bufferLabel?: string;
  /** JCF deadline priority tier: 0=Imperative, 1=Important, 2=Standard, 3=Flexible. */
  deadlinePriority?: number;
  onClick?: (jobId: string) => void;
}

type JobStatus = 'late' | 'conflict' | 'completed' | 'planified' | null;

export const JobCard = memo(function JobCard({
  id,
  reference,
  client,
  description,
  deadline,
  batDeadline,
  problemType,
  isCompleted = false,
  isPlanified = false,
  bufferLabel,
  deadlinePriority,
  isSelected = false,
  dim = false,
  onClick,
}: JobCardProps) {
  const handleClick = useCallback(() => {
    onClick?.(id);
  }, [onClick, id]);

  const status: JobStatus =
    problemType === 'late' ? 'late' :
    problemType === 'conflict' ? 'conflict' :
    isCompleted ? 'completed' :
    isPlanified ? 'planified' : null;

  const accentClass = (() => {
    if (status === 'late') return 'border-l-red-500';
    if (status === 'conflict') return 'border-l-amber-500';
    if (status === 'completed') return 'border-l-emerald-500';
    if (status === 'planified') return 'border-l-blue-500';
    return 'border-l-transparent';
  })();

  const selectedClass = isSelected ? 'bg-white/10' : 'hover:bg-white/5';
  const dimClass = (() => {
    if (isSelected) return '';
    if (dim) return 'opacity-[0.5] hover:opacity-100';
    if (status === 'completed') return 'opacity-[0.72] hover:opacity-100';
    return '';
  })();

  const refColor = (() => {
    if (status === 'late') return 'text-red-300';
    if (status === 'conflict') return 'text-amber-300';
    if (status === 'completed') return 'text-green-300';
    if (status === 'planified') return 'text-blue-300';
    return 'text-zinc-500';
  })();

  const descColor = status === 'late' || status === 'conflict' ? 'text-zinc-100' : 'text-zinc-300';

  const showBuffer = bufferLabel && status !== 'completed';

  const prioritySymbol = (() => {
    if (isCompleted || deadlinePriority == null) return null;
    switch (deadlinePriority) {
      case 0: return '!!!';
      case 1: return '!';
      case 2: return '+';
      case 3: return '=';
      case 4: return '-';
      default: return null;
    }
  })();

  const priorityColor = (() => {
    switch (deadlinePriority) {
      case 0: return 'text-red-500 font-bold';
      case 1: return 'text-red-400';
      case 2: return 'text-orange-400';
      case 3: return 'text-yellow-300';
      case 4: return 'text-zinc-400';
      default: return '';
    }
  })();

  return (
    <button
      type="button"
      className={`mx-2 mb-[6px] pl-[9px] pr-3 py-[3px] cursor-pointer transition-[background-color,opacity] duration-150 focus-visible:ring-1 focus-visible:ring-white/30 border-l-[3px] ${accentClass} ${selectedClass} ${dimClass} text-left w-[calc(100%-1rem)]`}
      onClick={handleClick}
      data-testid={`job-card-${id}`}
      data-status={status ?? 'normal'}
    >
      <div className="flex items-start gap-[10px]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[5px] overflow-hidden min-w-0">
            <span className={`font-mono text-[13px] font-medium shrink-0 ${refColor}`}>{reference}</span>
            <span className="text-zinc-600 shrink-0">·</span>
            <span className="text-zinc-400 text-[12px] truncate min-w-0 flex-1">{client}</span>
          </div>
          <div className={`truncate text-[12px] ${descColor}`}>{description}</div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          {deadline && (
            <div className="flex items-center gap-[4px] text-[10px] text-zinc-400">
              <Calendar className="w-[11px] h-[11px] text-zinc-500 shrink-0" />
              <span>{deadline}</span>
              {prioritySymbol && (
                <span className={`font-mono text-[12px] font-bold leading-none ${priorityColor}`}>
                  {prioritySymbol}
                </span>
              )}
            </div>
          )}
          {batDeadline && (
            <div className="flex items-center gap-[4px] text-[10px] text-zinc-400">
              <CalendarCheck className="w-[11px] h-[11px] text-zinc-500 shrink-0" />
              <span>{batDeadline}</span>
            </div>
          )}
          {showBuffer && (
            <span className={`text-[10px] font-medium ${bufferLabel!.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>
              {bufferLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
