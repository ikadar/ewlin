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
import { useReportSaisieMutation } from '../store';

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

export function SaisieModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaisieOpenParams | null>(null);
  const [reportSaisie] = useReportSaisieMutation();

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

  // Blocking callbacks — wired to APIs when available.
  // TODO: wire to real RTK mutations in next phase.
  const handleBlockPrerequisite = useCallback(async () => {
    // POST /scenarios/prod/saisie/{taskId}/defer — not yet implemented
    // eslint-disable-next-line no-console
    console.warn('[SaisieModal] Block prerequisite: backend endpoint not yet available');
  }, []);

  const handleBlockMachine = useCallback(async () => {
    if (!state) return;
    // TODO: PUT /stations/{stationId} with appended scheduleException
    // eslint-disable-next-line no-console
    console.warn('[SaisieModal] Block machine: will add 1h maintenance on', state.stationId);
  }, [state]);

  const handleBlockAbsence = useCallback(async () => {
    if (!state) return;
    // TODO: PUT /operators/{operatorId} with appended absence
    // eslint-disable-next-line no-console
    console.warn('[SaisieModal] Block absence: will add 1h absence for', state.operatorId);
  }, [state]);

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
