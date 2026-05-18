import { useMemo, type ReactElement } from 'react';
import { TaskCard } from './TaskCard';
import { GracePeek } from './GracePeek';
import { NextPeek } from './NextPeek';
import { Clock } from 'lucide-react';
import { isoToMinFromMidnight } from '../Tile/saisieMath';
import { fmtTimeMin } from '../ProgressCaptureModal/timeUtils';
import './transitions.css';
import type { TaskAssignment, ScheduleSnapshot, InternalTask } from '@flux/types';

export interface TaskCardStackProps {
  assignments: TaskAssignment[];
  snapshot: ScheduleSnapshot;
  mode: 'operator' | 'station';
}

function resolveTaskInfo(assignment: TaskAssignment, snapshot: ScheduleSnapshot) {
  const task = snapshot.tasks.find(t => t.id === assignment.taskId) as InternalTask | undefined;
  const element = task ? snapshot.elements.find(e => e.id === task.elementId) : undefined;
  const job = element ? snapshot.jobs.find(j => j.id === (element as { jobId: string }).jobId) : undefined;
  const station = snapshot.stations.find(s => s.id === assignment.targetId);
  return { task, element, job, station };
}

export function TaskCardStack({ assignments, snapshot, mode }: TaskCardStackProps): ReactElement {
  const now = useMemo(() => new Date(), []);
  const nowMs = now.getTime();

  const current = assignments.find(a => {
    const s = new Date(a.scheduledStart).getTime();
    const e = new Date(a.scheduledEnd).getTime();
    return s <= nowMs && nowMs < e && !a.isCompleted;
  });

  const graceCandidate = !current ? assignments.find(a => {
    const e = new Date(a.scheduledEnd).getTime();
    return (a.isCompleted || nowMs >= e) && nowMs < e + 5 * 60 * 1000;
  }) : undefined;

  const active = current ?? assignments.find(a => {
    return new Date(a.scheduledStart).getTime() > nowMs && !a.isCompleted;
  });

  const nextAfterActive = active ? assignments.find(a => {
    return a.id !== active.id
      && new Date(a.scheduledStart).getTime() >= new Date(active.scheduledEnd).getTime()
      && !a.isCompleted;
  }) : undefined;

  if (!active && !graceCandidate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <Clock size={32} className="text-zinc-600" />
        <div className="text-[14px] font-medium text-zinc-400">Fin de journée</div>
        <div className="text-[12px] text-zinc-500">Aucune tâche planifiée.</div>
      </div>
    );
  }

  const graceInfo = graceCandidate ? resolveTaskInfo(graceCandidate, snapshot) : null;
  const nextInfo = nextAfterActive ? resolveTaskInfo(nextAfterActive, snapshot) : null;

  const handleNotDone = () => {
    // TODO: wire markTaskNotCompleted mutation
    console.log('[Mobile] Not done pressed for', graceCandidate?.taskId);
  };

  return (
    <div className="flex-1 flex flex-col p-3.5 gap-2.5 overflow-hidden">
      {graceInfo && graceCandidate && (
        <GracePeek
          jobRef={graceInfo.job?.reference ?? '?'}
          designation={graceInfo.job?.designation ?? ''}
          stationName={graceInfo.station?.name ?? '?'}
          slotStart={fmtTimeMin(isoToMinFromMidnight(graceCandidate.scheduledStart))}
          slotEnd={fmtTimeMin(isoToMinFromMidnight(graceCandidate.scheduledEnd))}
          scheduledEnd={graceCandidate.scheduledEnd}
          onNotDone={handleNotDone}
        />
      )}

      {active && (
        <TaskCard
          assignment={active}
          snapshot={snapshot}
          mode={mode}
        />
      )}

      {nextInfo && nextAfterActive && (
        <NextPeek
          jobRef={nextInfo.job?.reference ?? '?'}
          designation={nextInfo.job?.designation ?? ''}
          stationName={nextInfo.station?.name ?? '?'}
          slotStart={fmtTimeMin(isoToMinFromMidnight(nextAfterActive.scheduledStart))}
          slotEnd={fmtTimeMin(isoToMinFromMidnight(nextAfterActive.scheduledEnd))}
        />
      )}
    </div>
  );
}
