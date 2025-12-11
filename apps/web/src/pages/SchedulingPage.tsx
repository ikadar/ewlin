import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchSnapshot } from '../store/scheduleSlice';
import { Header } from '../components/layout/Header';
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

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
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

        {/* Right sidebar */}
        <div className="w-72 border-l flex flex-col">
          {/* Unassigned Tasks (top half) */}
          <div className="flex-1 border-b overflow-hidden">
            <UnassignedTasksPanel className="h-full rounded-none border-0" />
          </div>

          {/* Task Detail (bottom half) */}
          <div className="flex-1 overflow-hidden">
            <TaskDetailPanel className="h-full rounded-none border-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
