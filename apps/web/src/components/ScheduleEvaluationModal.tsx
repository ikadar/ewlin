import { useMemo } from 'react';
import { X, Compass, Clock } from 'lucide-react';
import { useGetSnapshotQuery } from '../store';
import { computeScheduleScore } from '../utils/scheduleScoring';
import { COMPACT_HORIZONS } from '../constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function clrPct(v: number): string {
  if (v >= 85) return 'text-emerald-400';
  if (v >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function clrLate(v: number): string {
  if (v === 0) return 'text-emerald-400';
  if (v <= 3) return 'text-amber-400';
  return 'text-red-400';
}

function clrHours(v: number): string {
  if (v === 0) return 'text-emerald-400';
  if (v <= 8) return 'text-amber-400';
  return 'text-red-400';
}

export function ScheduleEvaluationModal({ isOpen, onClose }: Props) {
  const { data: snapshot } = useGetSnapshotQuery();

  const score = useMemo(() => {
    if (!snapshot) return null;
    return computeScheduleScore(snapshot);
  }, [snapshot]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const ts = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="bg-flux-elevated border border-flux-border rounded-lg shadow-xl"
        style={{ maxWidth: '52rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-flux-border">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-amber-400" />
            <h2 className="text-flux-text-primary font-semibold text-sm">
              Évaluation du planning
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-flux-text-tertiary">
              <Clock size={12} /> {ts}
            </span>
            <button
              onClick={onClose}
              className="text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {!score ? (
            <p className="text-flux-text-secondary text-xs text-center py-8">
              Aucune donnée disponible
            </p>
          ) : (
            <div className="flex gap-3">
              {/* Left column — Deadlines */}
              <div className="bg-white/[0.02] rounded-lg p-4" style={{ minWidth: '10rem' }}>
                {/* Hero */}
                <div className="text-center mb-3 pb-3 border-b border-white/[0.06]">
                  <div className={`text-3xl font-bold tabular-nums ${clrPct(score.onTimePercent)}`}>
                    {score.onTimePercent}
                    <span className="text-sm font-normal text-zinc-500"> %</span>
                  </div>
                  <div className="text-[10px] font-semibold text-flux-text-tertiary uppercase tracking-wider mt-1">
                    Jobs à l'heure
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-flux-text-secondary">En retard</span>
                    <span className={`text-xs font-semibold tabular-nums ${clrLate(score.lateJobCount)}`}>
                      {score.lateJobCount}
                      <span className="text-[10px] text-zinc-500 font-normal"> / {score.totalJobs}</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-flux-text-secondary">Retard moy.</span>
                    <span className={`text-xs font-semibold tabular-nums ${clrHours(score.avgLatenessHours)}`}>
                      {score.avgLatenessHours}
                      <span className="text-[10px] text-zinc-500 font-normal"> h</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-flux-text-secondary">Retard max</span>
                    <span className={`text-xs font-semibold tabular-nums ${clrHours(score.maxLatenessHours)}`}>
                      {score.maxLatenessHours}
                      <span className="text-[10px] text-zinc-500 font-normal"> h</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Horizon columns — Changeovers */}
              {COMPACT_HORIZONS.map((h) => {
                const sim = score.similarityByHorizon[h.hours];
                return (
                  <div key={h.hours} className="flex-1 bg-white/[0.02] rounded-lg p-4 min-w-0">
                    {/* Hero */}
                    <div className="text-center mb-3 pb-3 border-b border-white/[0.06]">
                      <div className="text-3xl font-bold tabular-nums text-flux-text-primary">
                        {sim.total}
                        <span className="text-sm font-normal text-zinc-500"> pts</span>
                      </div>
                      <div className="text-[10px] font-semibold text-flux-text-tertiary uppercase tracking-wider mt-1">
                        {h.label}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-flux-text-secondary">Impr.</span>
                        <span className="text-xs font-semibold tabular-nums text-flux-text-primary">
                          {sim.printing}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-flux-text-secondary">Finit.</span>
                        <span className="text-xs font-semibold tabular-nums text-flux-text-primary">
                          {sim.finishing}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-flux-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
