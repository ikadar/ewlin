/**
 * SaisieModalProvider — single ProgressCaptureModal mount per layout.
 *
 * Tile / TileSegment / TaskTile call `useSaisieModal().open({...})` instead
 * of holding their own local modal state. The right-click menu's "Saisir
 * l'avancement" option calls the same hook, so both paths converge on a
 * single instance and stay structurally consistent.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { TaskAssignment } from '@flux/types';
import { ProgressCaptureModal } from '../components/ProgressCaptureModal/ProgressCaptureModal';
import type { PredecessorInfo } from '../components/ProgressCaptureModal/PredecessorCard';
import { applyMinToDate } from '../components/Tile/saisieMath';
import {
  useReportSaisieMutation,
  useGetOperatorsQuery,
  useUpdateOperatorMutation,
  useGetStationsQuery,
  useUpdateStationMutation,
  useCreateProductionEventMutation,
} from '../store';

export interface SaisieOpenParams {
  assignment: TaskAssignment;
  taskDuration: { setupMinutes: number; runMinutes?: number };
  job: { reference: string; client: string; designation?: string };
  machineName: string;
  operatorName: string;
  operatorId: string;
  stationId: string;
  now: Date;
  slotVolumePct?: number;
  tileColor?: string;
  predecessorInfo?: PredecessorInfo | null;
}

interface SaisieModalApi {
  open: (params: SaisieOpenParams) => void;
}

const SaisieModalContext = createContext<SaisieModalApi | null>(null);

const BLOCK_DURATION_MS = 60 * 60 * 1000; // 1h

function toNaiveLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function SaisieModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaisieOpenParams | null>(null);
  const [reportSaisie] = useReportSaisieMutation();
  const [updateOperator] = useUpdateOperatorMutation();
  const [updateStation] = useUpdateStationMutation();
  const [createProductionEvent] = useCreateProductionEventMutation();
  const { data: operators } = useGetOperatorsQuery();
  const { data: stations } = useGetStationsQuery();

  const open = useCallback((params: SaisieOpenParams) => setState(params), []);
  const close = useCallback(() => setState(null), []);

  const api = useMemo<SaisieModalApi>(() => ({ open }), [open]);

  const handleSave = useCallback(
    async (estimatedEndMin: number) => {
      if (!state) return;
      const iso = applyMinToDate(state.assignment.scheduledStart, estimatedEndMin);
      await reportSaisie({ taskId: state.assignment.taskId, estimatedEndTime: iso }).unwrap();
    },
    [state, reportSaisie],
  );

  const handleBlockMachine = useCallback(async () => {
    if (!state) return;
    const station = stations?.find((s) => s.id === state.stationId);
    if (!station) return;
    const now = new Date();
    const endAt = new Date(now.getTime() + BLOCK_DURATION_MS);
    const existing = station.scheduleExceptions ?? [];
    await updateStation({
      id: state.stationId,
      body: {
        name: station.name,
        status: station.status,
        operatingSchedule: station.operatingSchedule,
        scheduleExceptions: [
          ...existing,
          { startAt: toNaiveLocal(now), endAt: toNaiveLocal(endAt), reason: "Panne déclarée par opérateur" },
        ],
        stationGroupIds: ((station as Record<string, unknown>).stationGroupIds as string[] | undefined) ?? [],
      },
    }).unwrap();
    createProductionEvent({
      taskId: state.assignment.taskId,
      jobInternalId: state.assignment.jobId,
      type: 'panne_machine',
      operatorId: state.operatorId,
      stationId: state.stationId,
    }).catch(() => {});
  }, [state, stations, updateStation, createProductionEvent]);

  const handleBlockAbsence = useCallback(async () => {
    if (!state) return;
    const operator = operators?.find((o) => o.id === state.operatorId);
    if (!operator) return;
    const now = new Date();
    const endAt = new Date(now.getTime() + BLOCK_DURATION_MS);
    const existing = operator.absences ?? [];
    await updateOperator({
      id: state.operatorId,
      body: {
        firstName: operator.firstName,
        lastName: operator.lastName,
        absences: [
          ...existing,
          { startAt: toNaiveLocal(now), endAt: toNaiveLocal(endAt), reason: "Absence déclarée par opérateur" },
        ],
      },
    }).unwrap();
    createProductionEvent({
      taskId: state.assignment.taskId,
      jobInternalId: state.assignment.jobId,
      type: 'absence',
      operatorId: state.operatorId,
      stationId: state.stationId,
    }).catch(() => {});
  }, [state, operators, updateOperator, createProductionEvent]);

  return (
    <SaisieModalContext.Provider value={api}>
      {children}
      {state && (
        <ProgressCaptureModal
          isOpen={true}
          onClose={close}
          onSave={handleSave}
          job={state.job}
          machineName={state.machineName}
          operatorName={state.operatorName}
          scheduledStart={state.assignment.scheduledStart}
          scheduledEnd={state.assignment.scheduledEnd}
          now={state.now}
          setupMinutes={state.taskDuration.setupMinutes}
          slotVolumePct={state.slotVolumePct}
          tileColor={state.tileColor}
          onBlockPrerequisite={undefined}
          onBlockMachine={handleBlockMachine}
          onBlockAbsence={handleBlockAbsence}
          predecessorInfo={state.predecessorInfo}
        />
      )}
    </SaisieModalContext.Provider>
  );
}

/**
 * Returns the saisie modal API. Throws if no provider is mounted upstream.
 * Mount `<SaisieModalProvider>` at layout level (RootLayout, FocusLayout).
 */
export function useSaisieModal(): SaisieModalApi {
  const ctx = useContext(SaisieModalContext);
  if (!ctx) {
    throw new Error('useSaisieModal must be used inside <SaisieModalProvider>');
  }
  return ctx;
}
