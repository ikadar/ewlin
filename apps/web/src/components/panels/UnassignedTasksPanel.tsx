import { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setSelectedTask } from '../../store/uiSlice';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import type { Task, Job } from '../../types';

interface UnassignedTasksPanelProps {
  className?: string;
}

export function UnassignedTasksPanel({ className }: UnassignedTasksPanelProps) {
  const snapshot = useAppSelector((state) => state.schedule.snapshot);
  const selectedTask = useAppSelector((state) => state.ui.selectedTask);
  const dispatch = useAppDispatch();

  const unassignedTasksByJob = useMemo(() => {
    if (!snapshot) return [];

    // Get tasks that are not assigned (no assignment record)
    const assignedTaskIds = new Set(snapshot.assignments.map((a) => a.taskId));

    // Collect unassigned tasks grouped by job
    const jobsWithUnassigned: { job: Job; tasks: Task[] }[] = [];

    for (const job of snapshot.jobs) {
      const unassignedTasks = job.tasks.filter(
        (t) =>
          !assignedTaskIds.has(t.id) &&
          t.status !== 'Completed' &&
          t.status !== 'Cancelled'
      );

      if (unassignedTasks.length > 0) {
        jobsWithUnassigned.push({ job, tasks: unassignedTasks });
      }
    }

    return jobsWithUnassigned.sort(
      (a, b) => new Date(a.job.workshopExitDate).getTime() - new Date(b.job.workshopExitDate).getTime()
    );
  }, [snapshot]);

  const handleTaskClick = (task: Task, job: Job) => {
    dispatch(
      setSelectedTask({
        taskId: task.id,
        task,
        job,
      })
    );
  };

  const getTaskLabel = (task: Task) => {
    if (task.type === 'internal') {
      return task.stationName ?? 'Internal';
    }
    return task.providerName ?? task.actionType ?? 'Outsourced';
  };

  const getTaskDuration = (task: Task) => {
    if (task.type === 'internal') {
      return `${task.totalMinutes}m`;
    }
    return `${task.durationOpenDays ?? 0}d`;
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-base">Unassigned Tasks</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        {unassignedTasksByJob.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No unassigned tasks
          </div>
        ) : (
          <div className="divide-y">
            {unassignedTasksByJob.map(({ job, tasks }) => (
              <div key={job.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{job.reference}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(job.workshopExitDate), 'MMM d')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task, job)}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded cursor-pointer text-sm',
                        'hover:bg-muted transition-colors',
                        selectedTask?.taskId === task.id && 'bg-muted ring-1 ring-primary'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          task.status === 'Ready' ? 'bg-green-500' : 'bg-yellow-500'
                        )}
                      />
                      <span className="flex-1 truncate">{getTaskLabel(task)}</span>
                      <span className="text-muted-foreground text-xs">
                        {getTaskDuration(task)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
