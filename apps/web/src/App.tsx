import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Sidebar, JobsList, JobDetailsPanel, DateStrip, SchedulingGrid } from './components';
import { DragPreview, snapToGrid, yPositionToTime, formatTime } from './components/DragPreview';
import { getSnapshot } from './mock';
import type { StationDropData } from './components/StationColumns';
import type { Task, Job } from '@flux/types';

/** Data attached to draggable task tiles */
export interface TaskDragData {
  type: 'task';
  task: Task;
  job: Job;
}

function App() {
  const snapshot = getSnapshot();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);

  // Configure pointer sensor with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Create lookup maps
  const jobMap = useMemo(() => {
    const map = new Map<string, Job>();
    snapshot.jobs.forEach((job) => map.set(job.id, job));
    return map;
  }, [snapshot.jobs]);

  // Find selected job
  const selectedJob = selectedJobId ? jobMap.get(selectedJobId) || null : null;

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as TaskDragData | undefined;
    if (data?.type === 'task') {
      setActiveTask(data.task);
      setActiveJob(data.job);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset active state
    setActiveTask(null);
    setActiveJob(null);

    // If not dropped on a valid target, do nothing
    if (!over) return;

    // Get drop data
    const dropData = over.data.current as StationDropData | undefined;
    const dragData = active.data.current as TaskDragData | undefined;

    if (dropData?.type !== 'station-column' || dragData?.type !== 'task') return;

    // Verify the task belongs to this station
    if (dragData.task.type !== 'Internal' || dragData.task.stationId !== dropData.stationId) {
      console.log('Invalid drop: task does not belong to this station');
      return;
    }

    // Calculate the drop position relative to the column
    // For now, use a placeholder - in v0.3.14 we'll calculate based on cursor position
    const startHour = 6;
    const rawY = 200; // Placeholder - will be calculated from event in v0.3.14
    const snappedY = snapToGrid(rawY);
    const dropTime = yPositionToTime(snappedY, startHour);

    // Log the drop info (actual assignment creation in v0.3.14)
    console.log('Drop info:', {
      taskId: dragData.task.id,
      stationId: dropData.stationId,
      snappedY,
      dropTime: formatTime(dropTime),
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen bg-zinc-950 text-zinc-100 flex overflow-hidden">
        <Sidebar />
        <JobsList
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          lateJobs={snapshot.lateJobs}
          conflicts={snapshot.conflicts}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
        <JobDetailsPanel
          job={selectedJob}
          tasks={snapshot.tasks}
          assignments={snapshot.assignments}
          stations={snapshot.stations}
        />
        <DateStrip
          startDate={(() => {
            const today = new Date();
            today.setDate(today.getDate() - 6); // Start 6 days before today
            return today;
          })()}
          dayCount={21}
        />
        <SchedulingGrid
          stations={snapshot.stations}
          categories={snapshot.categories}
          jobs={snapshot.jobs}
          tasks={snapshot.tasks}
          assignments={snapshot.assignments}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
        />
      </div>

      {/* Drag overlay - shows preview of dragged tile */}
      <DragOverlay dropAnimation={null}>
        {activeTask && activeJob && (
          <DragPreview task={activeTask} job={activeJob} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
