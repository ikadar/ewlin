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
import { applyMinToDate, computeExpectedAtNowPct, isoToMinFromMidnight } from '../components/Tile/saisieMath';
import { useReportSaisieMutation } from '../store';

interface SaisieOpenParams {
  assignment: TaskAssignment;
  taskDuration: { setupMinutes: number; runMinutes?: number };
  job: { reference: string; client: string };
  machineName: string;
  now: Date;
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

  // Modal-side derived values — recomputed from `state` while open. Cheap.
  const slotStartMin = state ? isoToMinFromMidnight(state.assignment.scheduledStart) : 0;
  const slotEndMin = state ? isoToMinFromMidnight(state.assignment.scheduledEnd) : 0;
  const nowMin = state ? state.now.getHours() * 60 + state.now.getMinutes() : 0;
  const cumulBeforeSlotPct = state?.assignment.cumulativePositionPct ?? 0;
  const slotVolumePct = state?.assignment.slotVolumePct ?? 100;
  const expectedAtNowPct = state
    ? computeExpectedAtNowPct(
        state.assignment.scheduledStart,
        state.assignment.scheduledEnd,
        state.taskDuration.setupMinutes,
        state.taskDuration.runMinutes ?? 0,
        state.now.getTime(),
        slotVolumePct,
      )
    : 0;

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
          slotStartMin={slotStartMin}
          slotEndMin={slotEndMin}
          cumulBeforeSlotPct={cumulBeforeSlotPct}
          slotVolumePct={slotVolumePct}
          expectedAtNowPct={expectedAtNowPct}
          nowMin={nowMin}
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
