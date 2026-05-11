import type { ReactElement } from 'react';
import { Lock } from 'lucide-react';

export interface PredecessorInfo {
  jobReference: string;
  client: string;
  designation?: string;
  stationName: string;
  timeRange: string;
}

export interface PredecessorCardProps {
  predecessor: PredecessorInfo | null;
}

export function PredecessorCard({ predecessor }: PredecessorCardProps): ReactElement {
  return (
    <div className="flex flex-col items-center gap-3 py-5 px-5 border-b border-flux-border" data-testid="pm-future-blocked">
      <div className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-300">
        <Lock size={18} />
      </div>
      <div className="text-[13px] font-semibold text-flux-text-primary text-center">
        Cette tâche n'a pas encore commencé
      </div>
      <div className="text-[11.5px] text-flux-text-tertiary text-center leading-relaxed">
        L'avancement ne peut être renseigné que lorsque la tâche précédente est terminée.
      </div>

      {predecessor && (
        <>
          <div className="text-[10px] font-semibold text-flux-text-muted uppercase tracking-wide">
            Tâche précédente
          </div>
          <div className="w-full bg-white/[0.03] border border-flux-border-light rounded-[6px] overflow-hidden text-center">
            <div className="py-2.5 px-3.5">
              <div className="text-[13px] font-bold text-flux-text-primary">
                {predecessor.jobReference} · {predecessor.client}
              </div>
              {predecessor.designation && (
                <div className="text-[11px] text-flux-text-tertiary mt-0.5">
                  {predecessor.designation}
                </div>
              )}
            </div>
            <div className="flex border-t border-flux-border">
              <div className="flex-1 flex flex-col items-center py-[7px] px-1 border-r border-flux-border">
                <span className="text-[9px] font-semibold text-flux-text-muted uppercase">Station</span>
                <span className="text-[11.5px] font-bold text-flux-text-primary">{predecessor.stationName}</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-[7px] px-1">
                <span className="text-[9px] font-semibold text-flux-text-muted uppercase">Créneau</span>
                <span className="text-[11.5px] font-bold text-flux-text-primary">{predecessor.timeRange}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
