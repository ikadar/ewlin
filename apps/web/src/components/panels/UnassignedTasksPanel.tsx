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
    const unassignedTasks = snapshot.tasks.filter(
      (t) =>
        !assignedTaskIds.has(t.id) &&
        t.status !== 'Completed' &&
        t.status !== 'Cancelled' &&
        t.status !== 'Failed'
    );

    // Group by job
    const jobMap = new Map<string, { job: Job; tasks: Task[] }>();

    for (const task of unassignedTasks) {
      const job = snapshot.jobs.find((j) => j.id === task.jobId);
      if (!job) continue;

      if (!jobMap.has(job.id)) {
        jobMap.set(job.id, { job, tasks: [] });
      }
      jobMap.get(job.id)!.tasks.push(task);
    }

    return Array.from(jobMap.values()).sort(
      (a, b) => new Date(a.job.deadline).getTime() - new Date(b.job.deadline).getTime()
    );
  }, [snapshot]);

  const handleTaskClick = (task: Task) => {
    dispatch(
      setSelectedTask({
        taskId: task.id,
        task,
      })
    );
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
                  <span className="font-medium text-sm">{job.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(job.deadline), 'MMM d')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
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
                      <span className="flex-1 truncate">{task.type}</span>
                      <span className="text-muted-foreground text-xs">
                        {task.duration}m
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
