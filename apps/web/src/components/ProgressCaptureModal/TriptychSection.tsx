import type { ReactElement } from 'react';
import { fmtTimeMin } from './timeUtils';

export interface TriptychSectionProps {
  operatorName: string;
  machineName: string;
  slotStartMin: number;
  slotEndMin: number;
  slotVolumePct?: number;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function TriptychSection({
  operatorName,
  machineName,
  slotStartMin,
  slotEndMin,
  slotVolumePct,
}: TriptychSectionProps): ReactElement {
  const duration = Math.max(0, slotEndMin - slotStartMin);

  return (
    <div className="px-5 pb-4" data-testid="pm-triptych">
      <div className="flex border border-flux-border-light rounded-[6px] overflow-hidden">
        <Cell label="Opérateur" value={operatorName} sub={machineName} />
        <Cell
          label="Créneau"
          value={`${fmtTimeMin(slotStartMin)} → ${fmtTimeMin(slotEndMin)}`}
          sub={fmtDuration(duration)}
        />
        {slotVolumePct != null && (
          <Cell label="Volume" value={`${slotVolumePct}%`} sub="du total" />
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex-1 flex flex-col items-center py-[10px] px-1.5 gap-0.5 border-r border-flux-border last:border-r-0">
      <span className="text-[10px] font-semibold text-flux-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-[13px] font-bold text-flux-text-primary tabular-nums">{value}</span>
      <span className="text-[10px] text-flux-text-muted">{sub}</span>
    </div>
  );
}
