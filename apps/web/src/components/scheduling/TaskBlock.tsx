import { useMemo } from 'react';
import { differenceInMinutes, startOfDay, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSelectedTask } from '../../store/uiSlice';
import type { Assignment, Task, Job } from '../../types';

interface TaskBlockProps {
  assignment: Assignment;
  task: Task;
  job?: Job;
  startDate: Date;
  hourWidth: number;
  startHour: number;
}

export function TaskBlock({
  assignment,
  task,
  job,
  startDate,
  hourWidth,
  startHour,
}: TaskBlockProps) {
  const dispatch = useAppDispatch();
  const selectedTask = useAppSelector((state) => state.ui.selectedTask);

  const isSelected = selectedTask?.taskId === task.id;

  const { left, width } = useMemo(() => {
    const schedStart = parseISO(assignment.scheduledStart);
    const schedEnd = parseISO(assignment.scheduledEnd);
    const gridStart = startOfDay(startDate);

    // Calculate position relative to grid start
    const minutesFromStart = differenceInMinutes(schedStart, gridStart) - startHour * 60;
    const durationMinutes = differenceInMinutes(schedEnd, schedStart);

    // Convert to pixels (1 hour = hourWidth pixels)
    const pixelsPerMinute = hourWidth / 60;

    return {
      left: minutesFromStart * pixelsPerMinute,
      width: Math.max(durationMinutes * pixelsPerMinute, 30), // Minimum 30px width
    };
  }, [assignment, startDate, hourWidth, startHour]);

  const statusColor = useMemo(() => {
    switch (task.status) {
      case 'Assigned':
        return 'bg-blue-500';
      case 'Executing':
        return 'bg-green-500';
      case 'Completed':
        return 'bg-gray-400';
      case 'Cancelled':
      case 'Failed':
        return 'bg-red-500';
      default:
        return 'bg-blue-400';
    }
  }, [task.status]);

  const handleClick = () => {
    dispatch(
      setSelectedTask({
        taskId: task.id,
        task,
        job,
        assignment,
      })
    );
  };

  const getTaskLabel = () => {
    if (task.type === 'internal') {
      return task.stationName ?? 'Internal';
    }
    return task.providerName ?? task.actionType ?? 'Outsourced';
  };

  const getTaskDuration = () => {
    if (task.type === 'internal') {
      return task.totalMinutes;
    }
    return (task.durationOpenDays ?? 0) * 8 * 60; // Convert days to minutes for display
  };

  // Only render if within visible bounds
  if (left < 0 && left + width < 0) return null;

  return (
    <div
      onClick={handleClick}
      className={cn(
        'absolute top-1 bottom-1 rounded px-2 py-1 cursor-pointer transition-all',
        'text-white text-xs overflow-hidden',
        'hover:ring-2 hover:ring-offset-1 hover:ring-primary',
        statusColor,
        isSelected && 'ring-2 ring-offset-1 ring-primary'
      )}
      style={{
        left: `${Math.max(left, 0)}px`,
        width: `${width}px`,
        backgroundColor: job?.color,
      }}
      title={`${job?.reference ?? 'Unknown Job'} - ${getTaskLabel()} (${getTaskDuration()}min)`}
    >
      <div className="font-medium truncate">{job?.reference}</div>
      <div className="truncate opacity-80">{getTaskLabel()}</div>
    </div>
  );
}
