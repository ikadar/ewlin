import type { ReactElement } from 'react';

export interface NextPeekProps {
  jobRef: string;
  designation: string;
  stationName: string;
  slotStart: string;
  slotEnd: string;
}

export function NextPeek({ jobRef, designation, stationName, slotStart, slotEnd }: NextPeekProps): ReactElement {
  return (
    <div
      className="bg-flux-elevated border border-flux-border border-b-0 rounded-t-[14px] px-4 py-3 flex flex-col gap-1 flex-shrink-0"
      style={{ viewTransitionName: 'vt-peek' }}
      data-testid="mobile-next-peek"
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500">Suivant</span>
      <span className="text-[12px] font-semibold text-zinc-400">{jobRef} · {designation}</span>
      <span className="text-[11px] text-zinc-500">{stationName} · {slotStart} – {slotEnd}</span>
    </div>
  );
}
