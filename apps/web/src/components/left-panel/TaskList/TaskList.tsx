import { useCallback, useMemo, useState, useRef } from 'react';
import { cn } from '../../../lib/utils';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { scrollToTask, recallTask, reorderTasks } from '../../../store/uiSlice';
import { TaskListItem } from './TaskListItem';
import type { Task } from '../../../types';
import { ListTodo } from 'lucide-react';

interface TaskListProps {
  className?: string;
}

export function TaskList({ className }: TaskListProps) {
  const dispatch = useAppDispatch();

  const selectedJobId = useAppSelector((state) => state.ui.selectedJobId);
  const jobs = useAppSelector((state) => state.schedule.snapshot?.jobs ?? []);
  const assignments = useAppSelector(
    (state) => state.schedule.snapshot?.assignments ?? []
  );

  // Get selected job
  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId]);

  // Get task order overrides
  const taskOrderOverrides = useAppSelector(
    (state) => state.ui.taskOrderOverrides
  );

  // Get tasks sorted by sequence order (or override)
  const tasks = useMemo(() => {
    if (!selectedJob) return [];
    const jobTasks = [...selectedJob.tasks];

    // Check if there's an override for this job
    const override = selectedJobId ? taskOrderOverrides[selectedJobId] : null;
    if (override && override.length > 0) {
      // Sort by override order
      const orderMap = new Map(override.map((id, index) => [id, index]));
      return jobTasks.sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? a.sequenceOrder;
        const orderB = orderMap.get(b.id) ?? b.sequenceOrder;
        return orderA - orderB;
      });
    }

    // Default: sort by sequenceOrder
    return jobTasks.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [selectedJob, selectedJobId, taskOrderOverrides]);

  // Create set of scheduled task IDs for quick lookup
  const scheduledTaskIds = useMemo(() => {
    return new Set(assignments.map((a) => a.taskId));
  }, [assignments]);

  // Drag state for reordering
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const dragOverTaskIdRef = useRef<string | null>(null);

  const handleJumpTo = useCallback(
    (taskId: string) => {
      dispatch(scrollToTask(taskId));
    },
    [dispatch]
  );

  const handleRecall = useCallback(
    (taskId: string) => {
      dispatch(recallTask(taskId));
    },
    [dispatch]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0 || !selectedJobId) return;
      const newOrder = tasks.map((t) => t.id);
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      dispatch(reorderTasks({ jobId: selectedJobId, taskIds: newOrder }));
    },
    [dispatch, tasks, selectedJobId]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= tasks.length - 1 || !selectedJobId) return;
      const newOrder = tasks.map((t) => t.id);
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      dispatch(reorderTasks({ jobId: selectedJobId, taskIds: newOrder }));
    },
    [dispatch, tasks, selectedJobId]
  );

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedTaskId && dragOverTaskIdRef.current && selectedJobId) {
      const draggedIndex = tasks.findIndex((t) => t.id === draggedTaskId);
      const targetIndex = tasks.findIndex((t) => t.id === dragOverTaskIdRef.current);

      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        const newOrder = tasks.map((t) => t.id);
        // Remove dragged item
        newOrder.splice(draggedIndex, 1);
        // Insert at target position
        newOrder.splice(targetIndex, 0, draggedTaskId);
        dispatch(reorderTasks({ jobId: selectedJobId, taskIds: newOrder }));
      }
    }
    setDraggedTaskId(null);
    dragOverTaskIdRef.current = null;
  }, [draggedTaskId, tasks, selectedJobId, dispatch]);

  const handleDragOver = useCallback((taskId: string) => {
    dragOverTaskIdRef.current = taskId;
  }, []);

  // Empty state: no job selected
  if (!selectedJobId) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-4 text-center', className)}>
        <ListTodo className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Select a job to see its tasks
        </p>
      </div>
    );
  }

  // Empty state: job has no tasks
  if (tasks.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-4 text-center', className)}>
        <ListTodo className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          No tasks defined for this job
        </p>
      </div>
    );
  }

  const scheduledCount = tasks.filter((t) => scheduledTaskIds.has(t.id)).length;
  const jobColor = selectedJob?.color ?? '#6B7280';

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">Tasks</span>
        <span className="text-xs text-muted-foreground">
          {scheduledCount} of {tasks.length} scheduled
        </span>
      </div>

      {/* Task list */}
      <div
        role="list"
        aria-label="Task list"
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {tasks.map((task: Task, index: number) => {
          const isScheduled = scheduledTaskIds.has(task.id);
          return (
            <TaskListItem
              key={task.id}
              task={task}
              isScheduled={isScheduled}
              jobColor={jobColor}
              onJumpTo={() => handleJumpTo(task.id)}
              onRecall={() => handleRecall(task.id)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              canMoveUp={index > 0 && !isScheduled}
              canMoveDown={index < tasks.length - 1 && !isScheduled}
              isDragging={draggedTaskId === task.id}
              onDragStart={() => handleDragStart(task.id)}
              onDragEnd={handleDragEnd}
              onDragOver={() => handleDragOver(task.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
