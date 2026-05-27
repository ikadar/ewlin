import { useState, useCallback, type ReactElement } from 'react';
import { IdentitySection } from '../ProgressCaptureModal/IdentitySection';
import { TriptychSection } from '../ProgressCaptureModal/TriptychSection';
import { ProgressBand } from '../ProgressCaptureModal/ProgressBand';
import { NonLinearStepper } from '../ProgressCaptureModal/NonLinearStepper';
import { ConfirmOntimeButton } from './ConfirmOntimeButton';
import { HeartbeatOverlay } from './HeartbeatOverlay';
import { DebounceStatusBar } from './DebounceStatusBar';
import { useDebouncedSave } from './useDebouncedSave';
import { deriveCardState } from './useCardState';
import { isoToMinFromMidnight } from '../Tile/saisieMath';
import type { TaskAssignment, ScheduleSnapshot, Task, InternalTask } from '@flux/types';

export interface TaskCardProps {
  assignment: TaskAssignment;
  snapshot: ScheduleSnapshot;
  mode: 'operator' | 'station';
}

export function TaskCard({ assignment, snapshot, mode }: TaskCardProps): ReactElement {
  const [acknowledged, setAcknowledged] = useState(false);
  const [now] = useState(() => new Date());

  const task = snapshot.tasks.find(t => t.id === assignment.taskId) as InternalTask | undefined;
  const element = task ? snapshot.elements.find(e => e.id === task.elementId) : undefined;
  const job = element ? snapshot.jobs.find(j => j.id === (element as { jobId: string }).jobId) : undefined;
  const station = snapshot.stations.find(s => s.id === assignment.targetId);

  const setupMin = task?.type === 'Internal' ? task.duration.setupMinutes : 0;
  const runMin = task?.type === 'Internal' ? task.duration.runMinutes : 0;
  const durationMin = setupMin + runMin;

  const slotStartMin = isoToMinFromMidnight(assignment.scheduledStart);
  const slotEndMin = isoToMinFromMidnight(assignment.scheduledEnd);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const { state: cardState, inEndZone, thresholdMin } = deriveCardState(
    assignment.scheduledStart, assignment.scheduledEnd, durationMin, now, assignment.isCompleted,
  );

  const timeRemainingMin = Math.max(0, slotEndMin - nowMin);
  const showBand = cardState === 'en-cours' || cardState === 'fin-proche';
  const showStepper = showBand;

  const operatorNames = (assignment.operators ?? [])
    .map(op => snapshot.operators.find(o => o.id === op.operatorId))
    .filter(Boolean)
    .map(o => o!);
  const firstOp = operatorNames[0];
  const operatorName = firstOp ? `${firstOp.firstName} ${firstOp.lastName}` : '?';
  const operatorInitials = firstOp ? `${firstOp.firstName[0]}.${firstOp.lastName[0]}` : '?';

  const { saveState, trigger: triggerSave } = useDebouncedSave(assignment.taskId);

  const handleTimeChange = useCallback((timeMin: number) => {
    setAcknowledged(true);
    triggerSave(timeMin);
  }, [triggerSave]);

  const handleConfirmOntime = useCallback(() => {
    setAcknowledged(true);
    triggerSave(slotEndMin);
  }, [triggerSave, slotEndMin]);

  const stepperLabel = cardState === 'fin-proche' ? 'Je finirai à :' : 'À quelle heure pensez-vous terminer ?';
  const slotVolumePct = element ? (element as { volumePct?: number }).volumePct : undefined;

  return (
    <div
      className="bg-flux-elevated border border-flux-border-light rounded-[14px] flex flex-col flex-1 min-h-0 overflow-hidden relative"
      style={{ viewTransitionName: 'vt-active' }}
      data-testid="mobile-task-card"
    >
      <HeartbeatOverlay
        timeRemainingMin={timeRemainingMin}
        thresholdMin={thresholdMin}
        active={inEndZone && !acknowledged}
      />

      <IdentitySection
        jobReference={job?.reference ?? '?'}
        client={job?.client ?? '?'}
        designation={job?.designation}
      />

      <TriptychSection
        operatorName={mode === 'station' ? operatorInitials : operatorName}
        machineName={station?.name ?? '?'}
        slotStartMin={slotStartMin}
        slotEndMin={slotEndMin}
        slotVolumePct={slotVolumePct}
        variant={mode === 'operator' ? 'mobile-operator' : 'mobile-station'}
      />

      {cardState === 'attente' && (
        <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-500">
          Commence dans {timeRemainingMin > 60
            ? `${Math.floor(timeRemainingMin / 60)}h${String(timeRemainingMin % 60).padStart(2, '0')}min`
            : `${timeRemainingMin} min`}
        </div>
      )}

      {showBand && (
        <ProgressBand
          variant="in-progress"
          slotStartMin={slotStartMin}
          slotEndMin={slotEndMin}
          nowMin={nowMin}
          setupMinutes={setupMin}
          slotVolumePct={slotVolumePct}
        />
      )}

      {showStepper && (
        <>
          <NonLinearStepper
            plannedEndMin={slotEndMin}
            nowMin={nowMin}
            label={stepperLabel}
            onTimeChange={handleTimeChange}
            showBlockedButton={cardState === 'fin-proche'}
          />
          {inEndZone && !acknowledged && (
            <ConfirmOntimeButton onClick={handleConfirmOntime} />
          )}
        </>
      )}

      <DebounceStatusBar state={saveState} />
    </div>
  );
}
