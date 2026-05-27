import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, Sparkles, RefreshCw, Play } from 'lucide-react';
import { useScenarioMode } from '../../contexts/ScenarioContext';
import type { ComputeBarPhase } from '../../contexts/AutoRecomputeContext';

const SUCCESS_HIDE_MS = 4_000;
const OPTIMIZED_HIDE_MS = 6_000;

type EnvPalette = {
  base: string;
  fill: string;
  progressBar: string;
};

const PALETTES: Record<'preprod' | 'prod', EnvPalette & { baseActive: string }> = {
  preprod: {
    base: 'bg-emerald-500/[0.06] border-b-emerald-500/35 text-emerald-300',
    baseActive: 'bg-emerald-500/[0.12] border-b-emerald-500/35 text-emerald-300',
    fill: 'bg-emerald-500/[0.18]',
    progressBar: 'bg-emerald-300',
  },
  prod: {
    base: 'bg-amber-500/[0.06] border-b-amber-500/35 text-amber-300',
    baseActive: 'bg-amber-500/[0.12] border-b-amber-500/35 text-amber-300',
    fill: 'bg-amber-500/[0.18]',
    progressBar: 'bg-amber-300',
  },
};

const ERROR_CLASSES = 'bg-red-500/[0.12] border-b-red-500/35 text-red-300';

interface Props {
  phase: ComputeBarPhase;
  onFlush: () => void;
  onRetry: () => void;
}

export function ComputeBar({ phase, onFlush, onRetry }: Props) {
  const { mode } = useScenarioMode();
  const palette = PALETTES[mode];

  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearHideTimer();

    if (phase.type === 'idle') {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (phase.type === 'succeeded') {
      hideTimerRef.current = setTimeout(() => setVisible(false), SUCCESS_HIDE_MS);
    } else if (phase.type === 'optimized') {
      hideTimerRef.current = setTimeout(() => setVisible(false), OPTIMIZED_HIDE_MS);
    }

    return clearHideTimer;
  }, [phase, clearHideTimer]);

  const fillKey = phase.type === 'pending' ? phase.fireAt : 0;
  const fillDurationS = phase.type === 'pending'
    ? Math.max(1, Math.ceil((phase.fireAt - Date.now()) / 1000))
    : 0;

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    if (phase.type === 'pending') {
      el.style.transition = 'none';
      el.style.transform = 'scaleX(0)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `transform ${fillDurationS}s linear`;
          el.style.transform = 'scaleX(1)';
        });
      });
    } else {
      el.style.transition = 'none';
      el.style.transform = 'scaleX(0)';
    }
  }, [phase.type, fillKey, fillDurationS]);

  const baseStyle = phase.type === 'failed'
    ? ERROR_CLASSES
    : phase.type === 'pending'
      ? palette.base
      : palette.baseActive;

  return (
    <div className="overflow-hidden">
      <div
        className={`relative flex items-center justify-between gap-3 px-4 py-1.5 text-[11.5px] border-b transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] ${baseStyle} ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 h-0 py-0 border-b-0'
        }`}
        role="status"
        aria-live="polite"
      >
        {/* Pending fill overlay */}
        <div
          ref={fillRef}
          className={`absolute inset-0 origin-left ${palette.fill}`}
          style={{ transform: 'scaleX(0)', zIndex: 0 }}
        />

        {/* Content — above the fill */}
        <div className="relative z-10 flex items-center gap-2">
          <PhaseIcon type={phase.type} />
          <PhaseText phase={phase} />
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          {phase.type === 'optimized' && phase.metrics.length > 0 && (
            <div className="flex gap-3 font-mono text-[11px]">
              {phase.metrics.map((m, i) => (
                <div key={i} className="flex flex-col items-end gap-0">
                  <span className="font-sans text-[9px] uppercase tracking-wide opacity-50">
                    {m.label}
                  </span>
                  <span className={`font-semibold ${m.bad ? 'text-red-400' : 'text-emerald-400'}`}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {phase.type === 'pending' && (
            <button
              type="button"
              onClick={onFlush}
              className="border border-current px-2.5 py-0.5 text-[11px] flex items-center gap-1.5 hover:bg-white/5 transition-colors"
            >
              <Play className="w-3 h-3" />
              <span>Recompute maintenant</span>
            </button>
          )}
          {phase.type === 'failed' && (
            <button
              type="button"
              onClick={onRetry}
              className="border border-current px-2.5 py-0.5 text-[11px] flex items-center gap-1.5 hover:bg-white/5 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Réessayer</span>
            </button>
          )}
        </div>

        {/* Indeterminate progress track for computing state */}
        {phase.type === 'computing' && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden z-10">
            <div
              className={`absolute inset-y-0 w-1/3 rounded-sm ${palette.progressBar} animate-[compute-bar-slide_1.2s_linear_infinite]`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseIcon({ type }: { type: ComputeBarPhase['type'] }) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (type) {
    case 'pending':
      return <Clock className={cls} />;
    case 'computing':
      return <Loader2 className={`${cls} animate-spin`} />;
    case 'succeeded':
      return <CheckCircle2 className={cls} />;
    case 'failed':
      return <AlertCircle className={cls} />;
    case 'optimized':
      return <Sparkles className={cls} />;
    default:
      return null;
  }
}

function PhaseText({ phase }: { phase: ComputeBarPhase }) {
  switch (phase.type) {
    case 'pending':
      return (
        <span>
          <strong className="font-semibold">Recalcul dans {phase.remainingS} s</strong>
          <span className="opacity-70"> · Les modifications récentes seront groupées.</span>
        </span>
      );
    case 'computing':
      return (
        <span>
          <strong className="font-semibold">Recalcul en cours</strong>
          {phase.reason && <span className="opacity-70"> · {phase.reason}</span>}
        </span>
      );
    case 'succeeded':
      return (
        <span>
          <strong className="font-semibold">Recalcul terminé</strong>
          <span className="opacity-70"> · Optimisation en arrière-plan…</span>
        </span>
      );
    case 'failed':
      return (
        <span>
          <strong className="font-semibold">Recalcul échoué</strong>
          <span className="opacity-70"> · {phase.error}</span>
        </span>
      );
    case 'optimized':
      return (
        <span>
          <strong className="font-semibold">Optimisation auto appliquée</strong>
          <span className="opacity-70"> · Le LNS a trouvé une meilleure organisation.</span>
        </span>
      );
    default:
      return null;
  }
}
