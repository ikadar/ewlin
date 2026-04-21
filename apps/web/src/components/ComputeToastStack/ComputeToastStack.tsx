/**
 * ComputeToastStack — renders the unified compute-feedback stack.
 *
 * Validated in playground-compute-toaster.html:
 *   Top-Right · Compact · 4000ms auto-hide · max 3 visible
 *   5 types: info / success / error / progress / waze
 *
 * The stack is fixed-positioned and rendered once per app. All callers
 * share the same toaster instance via the useComputeToaster hook.
 */

import type { ComputeToast, ComputeToastType } from '../../hooks/useComputeToaster';
import { Info, CheckCircle2, AlertCircle, Snowflake, Loader2 } from 'lucide-react';

const TYPE_ACCENT: Record<ComputeToastType, string> = {
  info: 'border-l-blue-500',
  success: 'border-l-emerald-500',
  error: 'border-l-red-500',
  progress: 'border-l-violet-500',
  waze: 'border-l-amber-500',
};

const TYPE_TEXT: Record<ComputeToastType, string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
  progress: 'text-violet-400',
  waze: 'text-amber-400',
};

function TypeIcon({ type }: { type: ComputeToastType }) {
  const cls = `w-[14px] h-[14px] shrink-0 ${TYPE_TEXT[type]}`;
  if (type === 'progress') return <Loader2 className={`${cls} animate-spin`} />;
  if (type === 'success') return <CheckCircle2 className={cls} />;
  if (type === 'error') return <AlertCircle className={cls} />;
  if (type === 'waze') return <Snowflake className={cls} />;
  return <Info className={cls} />;
}

interface Props {
  toasts: ComputeToast[];
  onDismiss: (id: string) => void;
}

export function ComputeToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-6 z-[500] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto min-w-[260px] max-w-[340px] bg-flux-elevated border border-flux-border-light ${TYPE_ACCENT[t.type]} border-l-[3px] rounded-lg px-3 py-2.5 shadow-xl shadow-black/40 animate-in slide-in-from-top-2 fade-in duration-200`}
        >
          <div className="flex items-start gap-2.5">
            <TypeIcon type={t.type} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-flux-text-primary leading-tight">
                {t.title}
              </div>
              {t.detail && (
                <div className="text-[11px] text-flux-text-tertiary mt-0.5 leading-snug">
                  {t.detail}
                </div>
              )}
              {t.metrics && t.metrics.length > 0 && (
                <div className="flex gap-2.5 mt-1.5 font-mono text-[11px]">
                  {t.metrics.map((m, i) => (
                    <div key={i} className="flex flex-col gap-0">
                      <span className="text-[9px] uppercase tracking-wide text-flux-text-muted font-sans">
                        {m.label}
                      </span>
                      <span className={`font-semibold ${m.bad ? 'text-red-400' : 'text-emerald-400'}`}>
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {t.actions && t.actions.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {t.actions.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={a.onClick}
                      className={
                        a.variant === 'primary'
                          ? 'text-[10px] font-semibold px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/45 text-amber-400 transition-colors'
                          : 'text-[10px] font-semibold px-2.5 py-1 rounded bg-transparent text-flux-text-tertiary hover:text-flux-text-primary hover:bg-flux-hover border border-flux-border-light transition-colors'
                      }
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              {t.progress !== undefined && (
                <div className="mt-2 h-0.5 bg-white/5 rounded-sm overflow-hidden relative">
                  {t.progress < 0 ? (
                    <div className="absolute inset-y-0 w-1/3 bg-violet-500 rounded-sm animate-[progress-slide_1.2s_linear_infinite]" />
                  ) : (
                    <div
                      className="absolute inset-y-0 left-0 bg-violet-500 rounded-sm transition-[width] duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }}
                    />
                  )}
                </div>
              )}
            </div>
            {!t.pinned && (
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                aria-label="Fermer"
                className="text-flux-text-muted hover:text-flux-text-primary transition-colors -m-0.5 p-0.5 leading-none text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
