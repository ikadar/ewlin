import type { ReactElement } from 'react';
import { useGraceCountdown, fmtGraceTimer } from './useGraceCountdown';

export interface GracePeekProps {
  jobRef: string;
  designation: string;
  stationName: string;
  slotStart: string;
  slotEnd: string;
  scheduledEnd: string;
  onNotDone: () => void;
}

export function GracePeek({
  jobRef, designation, stationName, slotStart, slotEnd,
  scheduledEnd, onNotDone,
}: GracePeekProps): ReactElement {
  const remaining = useGraceCountdown(scheduledEnd);

  if (remaining <= 0) return <></>;

  return (
    <div
      className="bg-flux-elevated border border-flux-border border-t-0 rounded-b-[14px] px-4 pt-2.5 pb-3 flex flex-col gap-1 flex-shrink-0"
      style={{ viewTransitionName: 'vt-grace' }}
      data-testid="mobile-grace-peek"
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500">Précédent</span>
      <span className="text-[12px] font-semibold text-zinc-400">{jobRef} · {designation}</span>
      <span className="text-[11px] text-zinc-500">{stationName} · {slotStart} – {slotEnd}</span>
      <button
        type="button"
        onClick={onNotDone}
        className="mt-2 w-full py-2 rounded-lg border border-amber-400/35 bg-amber-400/10 text-[12px] font-semibold text-amber-300 active:bg-amber-400/20 active:scale-[0.98] transition-all"
        data-testid="mobile-not-done-btn"
      >
        Je n'ai pas fini · {fmtGraceTimer(remaining)}
      </button>
    </div>
  );
}
