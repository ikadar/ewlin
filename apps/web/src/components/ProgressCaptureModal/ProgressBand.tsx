import type { ReactElement } from 'react';
import { fmtTimeMin } from './timeUtils';

export interface ProgressBandProps {
  variant: 'in-progress' | 'done-past-end';
  slotStartMin: number;
  slotEndMin: number;
  nowMin: number;
  setupMinutes: number;
  slotVolumePct?: number;
  tileColor?: string;
}

function fmtDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function ProgressBand({
  variant,
  slotStartMin,
  slotEndMin,
  nowMin,
  setupMinutes,
  slotVolumePct,
  tileColor = '59,130,246',
}: ProgressBandProps): ReactElement {
  const duration = Math.max(1, slotEndMin - slotStartMin);
  const elapsed = Math.max(0, nowMin - slotStartMin);
  const remaining = Math.max(0, slotEndMin - nowMin);
  const pctFill = variant === 'done-past-end'
    ? 100
    : Math.min(100, Math.round((elapsed / duration) * 100));

  const volDone = slotVolumePct != null
    ? Math.round((elapsed / duration) * slotVolumePct)
    : Math.min(100, Math.round((elapsed / duration) * 100));

  const bg = variant === 'done-past-end'
    ? 'rgba(16,185,129, 0.22)'
    : `linear-gradient(to right, rgba(16,185,129, 0.22) ${pctFill}%, rgba(${tileColor}, 0.10) ${pctFill}%)`;

  const overdue = Math.max(0, nowMin - slotEndMin);

  let title: string;
  let sub: string;
  if (variant === 'done-past-end') {
    title = 'Tâche réputée terminée';
    sub = `Fin prévue à ${fmtTimeMin(slotEndMin)} — il y a ${fmtDuration(overdue)}`;
  } else {
    title = `Il est ${fmtTimeMin(nowMin)}, en théorie :`;
    if (slotVolumePct != null) {
      sub = `il me reste ${fmtDuration(remaining)} — j'en suis à ${volDone}% sur ${slotVolumePct}%`;
    } else {
      sub = `il me reste ${fmtDuration(remaining)} — j'en suis à ${volDone}%`;
    }
  }

  return (
    <div
      className="text-center py-4 px-5 border-b border-flux-border relative overflow-hidden"
      style={{ background: bg }}
      data-testid="pm-progress-band"
    >
      <div className="text-[14px] font-bold text-flux-text-primary relative z-10 mb-1">
        {title}
      </div>
      <div className="text-[11.5px] text-white/70 relative z-10">
        {sub}
      </div>
    </div>
  );
}
