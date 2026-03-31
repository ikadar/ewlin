import { useState } from 'react';
import { Check, X, Clock, Loader2, ChevronRight } from 'lucide-react';
import type { ChatToolCall } from '@flux/types';

interface Props {
  toolCall: ChatToolCall;
}

const statusIcons = {
  pending: Clock,
  executed: Check,
  failed: X,
  cancelled: X,
} as const;

const statusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  executed: 'text-green-400 bg-green-400/10 border-green-400/20',
  failed: 'text-red-400 bg-red-400/10 border-red-400/20',
  cancelled: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
} as const;

const toolLabels: Record<string, string> = {
  get_schedule_summary: 'Read schedule',
  lookup_station: 'Lookup station',
  search_jobs: 'Search jobs',
  list_saved_schedules: 'List snapshots',
  get_job_dependencies: 'Get dependencies',
  update_task_duration: 'Update duration',
  add_station_exception: 'Station exception',
  complete_tasks: 'Complete tasks',
  complete_tasks_before: 'Complete before time',
  unassign_tasks: 'Unassign tasks',
  auto_place: 'Auto-place all',
  smart_compact: 'Smart compact',
  delete_job: 'Delete job',
  assign_task: 'Assign task',
  reschedule_task: 'Reschedule task',
  split_task: 'Split task',
  fuse_task: 'Fuse task',
  set_job_dependencies: 'Set dependencies',
  remove_job_dependency: 'Remove dependency',
  update_element_prerequisite: 'Update prerequisite',
  update_job: 'Update job',
  update_outsourced_task_status: 'Outsourced status',
  save_schedule: 'Save schedule',
  load_schedule: 'Load schedule',
  auto_place_job_asap: 'ASAP placement',
  auto_place_job_alap: 'ALAP placement',
  extend_task_and_replan: 'Extend & replan',
};

export function ChatToolCallBadge({ toolCall }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = statusIcons[toolCall.status] ?? Loader2;
  const colors = statusColors[toolCall.status] ?? statusColors.pending;
  const label = toolLabels[toolCall.toolName] ?? toolCall.toolName;
  const hasDetails = toolCall.result != null || toolCall.input != null;

  return (
    <div className="my-0.5">
      <button
        type="button"
        onClick={() => hasDetails && setIsOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border transition-colors ${colors} ${hasDetails ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
        data-testid={`tool-badge-${toolCall.toolName}`}
      >
        <Icon className="w-3 h-3" />
        <span>{label}</span>
        {hasDetails && (
          <ChevronRight
            className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {isOpen && hasDetails && (
        <div className="mt-1 ml-1 p-2 rounded bg-zinc-950 border border-zinc-800 text-[11px] leading-relaxed font-mono text-zinc-400 max-h-48 overflow-auto">
          {toolCall.result && (
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.result, null, 2)}
            </pre>
          )}
          {!toolCall.result && toolCall.input && (
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
