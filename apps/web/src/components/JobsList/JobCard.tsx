import { memo, useCallback } from 'react';
import type { Task, TaskAssignment } from '@flux/types';
import { AlertCircle, Shuffle, Check } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

export type JobProblemType = 'late' | 'conflict' | null;

export interface JobCardProps {
  id: string;
  reference: string;
  client: string;
  description: string;
  tasks: Task[];
  assignments: TaskAssignment[];
  deadline?: string;
  problemType?: JobProblemType;
  /** Whether all tasks are completed (distinct from problemType). */
  isCompleted?: boolean;
  isSelected?: boolean;
  bufferLabel?: string;
  onClick?: (jobId: string) => void;
}

type JobStatus = 'late' | 'conflict' | 'completed' | null;

export const JobCard = memo(function JobCard({
  id,
  reference,
  client,
  description,
  tasks,
  assignments,
  deadline,
  problemType,
  isCompleted = false,
  bufferLabel,
  isSelected = false,
  onClick,
}: JobCardProps) {
  const handleClick = useCallback(() => {
    onClick?.(id);
  }, [onClick, id]);

  const status: JobStatus =
    problemType === 'late' ? 'late' :
    problemType === 'conflict' ? 'conflict' :
    isCompleted ? 'completed' : null;

  const accentClass = (() => {
    if (status === 'late') return 'border-l-red-500';
    if (status === 'conflict') return 'border-l-amber-500';
    if (status === 'completed') return 'border-l-emerald-500';
    return 'border-l-transparent';
  })();

  const selectedClass = isSelected ? 'bg-white/10' : 'hover:bg-white/5';
  const dimClass = status === 'completed' ? 'opacity-[0.72] hover:opacity-100' : '';

  const refColor = (() => {
    if (status === 'late') return 'text-red-300';
    if (status === 'conflict') return 'text-amber-300';
    if (status === 'completed') return 'text-green-300';
    return 'text-zinc-500';
  })();

  const descColor = status === 'late' || status === 'conflict' ? 'text-zinc-100' : 'text-zinc-300';

  const statusIcon = (() => {
    if (status === 'late') return <AlertCircle className="w-[14px] h-[14px] ml-auto shrink-0 text-red-400" />;
    if (status === 'conflict') return <Shuffle className="w-[14px] h-[14px] ml-auto shrink-0 text-amber-400" />;
    if (status === 'completed') return <Check className="w-[14px] h-[14px] ml-auto shrink-0 text-emerald-400" />;
    return null;
  })();

  const statusBadge = (() => {
    if (status === 'late') return <span className="text-[10px] font-medium text-red-400">En retard</span>;
    if (status === 'conflict') return <span className="text-[10px] font-medium text-amber-400">Conflit</span>;
    if (status === 'completed') return <span className="text-[10px] font-medium text-emerald-400">Terminé</span>;
    return null;
  })();

  return (
    <button
      type="button"
      className={`mx-2 mb-[2px] pl-[9px] pr-3 py-[5px] cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-white/30 border-l-[3px] ${accentClass} ${selectedClass} ${dimClass} text-left w-[calc(100%-1rem)]`}
      onClick={handleClick}
      data-testid={`job-card-${id}`}
      data-status={status ?? 'normal'}
    >
      <div className="flex items-center gap-[5px] mb-[1px] overflow-hidden min-w-0">
        <span className={`font-mono text-[13px] font-medium shrink-0 ${refColor}`}>{reference}</span>
        <span className="text-zinc-600 shrink-0">·</span>
        <span className="text-zinc-400 text-[12px] truncate min-w-0 flex-1">{client}</span>
        {statusIcon}
        {!status && deadline && (
          <span className="text-zinc-600 text-[10px] ml-auto shrink-0">{deadline}</span>
        )}
      </div>

      <div className={`truncate mb-[1px] text-[12px] ${descColor}`}>{description}</div>

      <div className="flex items-center justify-between gap-2">
        <ProgressBar tasks={tasks} assignments={assignments} />
        <div className="flex items-center gap-2">
          {statusBadge}
          {bufferLabel && status !== 'completed' && (
            <span className={`text-[10px] font-medium ${bufferLabel.startsWith('-') ? 'text-red-400' : 'text-emerald-400'}`}>
              {bufferLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
