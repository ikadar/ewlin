import { Loader, Check, Clock, RefreshCw } from 'lucide-react';
import type { ReactElement } from 'react';

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'pending-save' }
  | { kind: 'saved' }
  | { kind: 'pending-replan'; countdown: number }
  | { kind: 'replanned' };

export interface DebounceStatusBarProps {
  state: SaveState;
}

export function DebounceStatusBar({ state }: DebounceStatusBarProps): ReactElement | null {
  if (state.kind === 'idle') return null;

  const configs = {
    'pending-save': { icon: <Loader size={12} />, text: 'Enregistrement…', cls: 'text-zinc-500 bg-white/[0.03]' },
    saved:          { icon: <Check size={12} />,  text: 'Enregistré',     cls: 'text-emerald-300 bg-emerald-500/[0.06]' },
    'pending-replan': { icon: <Clock size={12} />, text: `Recalcul dans ${state.kind === 'pending-replan' ? state.countdown : 0}s…`, cls: 'text-zinc-500 bg-blue-500/[0.06]' },
    replanned:      { icon: <RefreshCw size={12} />, text: 'Planning recalculé', cls: 'text-blue-400 bg-blue-500/[0.08]' },
  } as const;

  const c = configs[state.kind];
  return (
    <div
      className={`flex items-center justify-center gap-1.5 py-1.5 px-5 text-[10px] font-semibold ${c.cls}`}
      data-testid="mobile-debounce-bar"
    >
      {c.icon}
      {c.text}
    </div>
  );
}
