import type { ReactElement } from 'react';
import { fmtTimeMin } from './timeUtils';

export interface TriptychSectionProps {
  operatorName: string;
  machineName: string;
  slotStartMin: number;
  slotEndMin: number;
  slotVolumePct?: number;
  variant?: 'modal' | 'mobile-operator' | 'mobile-station';
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
  variant = 'modal',
}: TriptychSectionProps): ReactElement {
  const duration = Math.max(0, slotEndMin - slotStartMin);
  const isMobile = variant === 'mobile-operator' || variant === 'mobile-station';

  const firstCell = variant === 'mobile-operator'
    ? <Cell label="Machine" value={machineName} />
    : variant === 'mobile-station'
      ? <Cell label="Opérateur" value={operatorName} />
      : <Cell label="Opérateur" value={operatorName} sub={machineName} />;

  const slotValue = isMobile
    ? <>{fmtTimeMin(slotStartMin)}<br />→ {fmtTimeMin(slotEndMin)}</>
    : <>{fmtTimeMin(slotStartMin)} → {fmtTimeMin(slotEndMin)}</>;

  return (
    <div className="px-5 pb-4" data-testid="pm-triptych">
      <div className="flex border border-flux-border-light rounded-[6px] overflow-hidden">
        {firstCell}
        <div className="flex-1 flex flex-col items-center py-[10px] px-1.5 gap-0.5 border-r border-flux-border last:border-r-0">
          <span className="text-[10px] font-semibold text-flux-text-muted uppercase tracking-wide">Créneau</span>
          <span className="text-[13px] font-bold text-flux-text-primary tabular-nums">{slotValue}</span>
          {!isMobile && <span className="text-[10px] text-flux-text-muted">{fmtDuration(duration)}</span>}
        </div>
        {slotVolumePct != null && (
          <Cell label="Volume" value={`${Number(slotVolumePct.toFixed(1))}%`} sub="du total" />
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center py-[10px] px-1.5 gap-0.5 border-r border-flux-border last:border-r-0">
      <span className="text-[10px] font-semibold text-flux-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-[13px] font-bold text-flux-text-primary tabular-nums">{value}</span>
      {sub && <span className="text-[10px] text-flux-text-muted">{sub}</span>}
    </div>
  );
}
