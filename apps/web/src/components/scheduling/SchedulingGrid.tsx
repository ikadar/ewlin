import { useMemo } from 'react';
import { format, eachDayOfInterval } from 'date-fns';
import { cn } from '../../lib/utils';
import { useAppSelector } from '../../store/hooks';
import { TaskBlock } from './TaskBlock';
import type { Assignment, Station, OutsourcedProvider, Task, Job } from '../../types';

interface SchedulingGridProps {
  className?: string;
}

export function SchedulingGrid({ className }: SchedulingGridProps) {
  const gridView = useAppSelector((state) => state.ui.gridView);
  const snapshot = useAppSelector((state) => state.schedule.snapshot);
  const timeRange = useAppSelector((state) => state.ui.timeRange);

  const { days, hours, resources } = useMemo(() => {
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);

    const days = eachDayOfInterval({ start, end });
    const hours = Array.from({ length: 12 }, (_, i) => i + 6); // 6:00 - 17:00

    const resources =
      gridView === 'stations'
        ? (snapshot?.stations ?? [])
        : (snapshot?.providers ?? []);

    return { days, hours, resources };
  }, [timeRange, gridView, snapshot]);

  const assignmentsByResource = useMemo(() => {
    if (!snapshot) return new Map<string, Assignment[]>();

    const map = new Map<string, Assignment[]>();

    for (const assignment of snapshot.assignments) {
      // Find the task to determine which station it belongs to
      let task: Task | undefined;
      for (const job of snapshot.jobs) {
        task = job.tasks.find((t) => t.id === assignment.taskId);
        if (task) break;
      }

      if (!task) continue;

      // In station view, group by station; in provider view, group by provider
      const resourceId = gridView === 'stations' ? assignment.stationId : task.providerId;
      if (!resourceId) continue;

      if (!map.has(resourceId)) {
        map.set(resourceId, []);
      }
      map.get(resourceId)!.push(assignment);
    }

    return map;
  }, [snapshot, gridView]);

  // Helper to find task by assignment
  const findTaskAndJob = (assignment: Assignment): { task: Task; job: Job } | null => {
    if (!snapshot) return null;
    for (const job of snapshot.jobs) {
      const task = job.tasks.find((t) => t.id === assignment.taskId);
      if (task) return { task, job };
    }
    return null;
  };

  if (!snapshot) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Header with time axis */}
      <div className="flex border-b bg-muted/30">
        <div className="w-48 flex-shrink-0 border-r p-2 font-medium">
          {gridView === 'stations' ? 'Station' : 'Provider'}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="flex-shrink-0 border-r"
                style={{ width: `${hours.length * 60}px` }}
              >
                <div className="text-center py-1 border-b font-medium text-sm">
                  {format(day, 'EEE, MMM d')}
                </div>
                <div className="flex">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="w-[60px] text-center text-xs text-muted-foreground py-1 border-r last:border-r-0"
                    >
                      {hour}:00
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid body */}
      <div className="flex-1 overflow-auto">
        {resources.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            assignments={assignmentsByResource.get(resource.id) ?? []}
            days={days}
            hours={hours}
            gridView={gridView}
            findTaskAndJob={findTaskAndJob}
          />
        ))}
      </div>
    </div>
  );
}

interface ResourceRowProps {
  resource: Station | OutsourcedProvider;
  assignments: Assignment[];
  days: Date[];
  hours: number[];
  gridView: 'stations' | 'providers';
  findTaskAndJob: (assignment: Assignment) => { task: Task; job: Job } | null;
}

function ResourceRow({ resource, assignments, days, hours, gridView, findTaskAndJob }: ResourceRowProps) {
  const isStation = (r: Station | OutsourcedProvider): r is Station => 'categoryId' in r;

  const statusColor = useMemo(() => {
    if (isStation(resource)) {
      switch (resource.status) {
        case 'Available':
          return 'bg-green-50';
        case 'InUse':
          return 'bg-blue-50';
        case 'Maintenance':
          return 'bg-yellow-50';
        case 'OutOfService':
          return 'bg-red-50';
        default:
          return '';
      }
    } else {
      switch (resource.status) {
        case 'Active':
          return 'bg-green-50';
        case 'Inactive':
          return 'bg-yellow-50';
        default:
          return '';
      }
    }
  }, [resource]);

  const getSubtitle = () => {
    if (isStation(resource)) {
      return `Capacity: ${resource.capacity}`;
    }
    return `${resource.supportedActionTypes.length} actions`;
  };

  return (
    <div className="flex border-b hover:bg-muted/20">
      {/* Resource label */}
      <div
        className={cn(
          'w-48 flex-shrink-0 border-r p-2 flex items-center gap-2',
          statusColor
        )}
      >
        <div className="flex-1 truncate">
          <div className="font-medium text-sm truncate">{resource.name}</div>
          <div className="text-xs text-muted-foreground">
            {getSubtitle()}
          </div>
        </div>
      </div>

      {/* Time slots */}
      <div className="flex-1 relative" style={{ minHeight: '60px' }}>
        <div className="flex absolute inset-0">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-shrink-0 flex"
              style={{ width: `${hours.length * 60}px` }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="w-[60px] border-r border-dashed border-muted last:border-r-0"
                />
              ))}
            </div>
          ))}
        </div>

        {/* Task blocks */}
        {assignments.map((assignment) => {
          const result = findTaskAndJob(assignment);
          if (!result) return null;

          return (
            <TaskBlock
              key={assignment.id}
              assignment={assignment}
              task={result.task}
              job={result.job}
              startDate={new Date(days[0])}
              hourWidth={60}
              startHour={hours[0]}
            />
          );
        })}
      </div>
    </div>
  );
}
