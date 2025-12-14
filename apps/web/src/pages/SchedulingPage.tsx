import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchSnapshot } from '../store/scheduleSlice';
import { MainLayout } from '../components/layout';
import { SchedulingGrid } from '../components/scheduling/SchedulingGrid';
import { UnassignedTasksPanel } from '../components/panels/UnassignedTasksPanel';
import { TaskDetailPanel } from '../components/panels/TaskDetailPanel';
import { CrudPanel } from '../components/crud/CrudPanel';

export function SchedulingPage() {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((state) => state.schedule.loading);
  const error = useAppSelector((state) => state.schedule.error);
  const timeRange = useAppSelector((state) => state.ui.timeRange);

  useEffect(() => {
    const range = `${timeRange.start}/${timeRange.end}`;
    dispatch(fetchSnapshot(range));
  }, [dispatch, timeRange]);

  // Left panel content - Jobs context (placeholder until v0.3.3)
  const leftContent = (
    <div className="space-y-4">
      <UnassignedTasksPanel className="rounded-md border" />
    </div>
  );

  // Center content - Scheduling Grid and CRUD Panel
  const centerContent = (
    <div className="flex flex-col h-full">
      {/* Scheduling Grid (top ~60%) */}
      <div className="flex-[6] border-b overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">Loading schedule...</p>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-destructive">Error: {error}</p>
          </div>
        ) : (
          <SchedulingGrid className="h-full" />
        )}
      </div>

      {/* CRUD Panel (bottom ~40%) */}
      <div className="flex-[4] overflow-hidden">
        <CrudPanel className="h-full rounded-none border-0" />
      </div>
    </div>
  );

  // Right panel content - Schedule health (placeholder until v0.3.9/v0.3.10)
  const rightContent = (
    <div className="space-y-4">
      <TaskDetailPanel className="rounded-md border" />
    </div>
  );

  return (
    <MainLayout
      leftPanelContent={leftContent}
      centerContent={centerContent}
      rightPanelContent={rightContent}
    />
  );
}
