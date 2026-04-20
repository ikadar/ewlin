import { memo } from 'react';
import type { Collapse, CollapseKind } from './collapseConfig';

export interface CollapseBandProps {
  collapse: Collapse;
  /** Y position (px) where the band starts. Computed by parent via collapse-aware timeToYPosition. */
  topPx: number;
}

const KIND_LABEL: Record<CollapseKind, string> = {
  night: 'Nuit',
  weekend: 'Weekend',
  closure: 'Fermeture',
  pause: 'Pause',
};

/**
 * CollapseBand — full-width "Corner" variant per 2026-04-20 spec.
 * Flat zinc-900 background, per-kind leading glyph, 12px chip with
 * kind label + duration + "from → to". Non-interactive (the band
 * just marks folded time; no expand affordance).
 */
export const CollapseBand = memo(function CollapseBand({
  collapse,
  topPx,
}: CollapseBandProps) {
  return (
    <div
      data-testid="collapse-band"
      data-kind={collapse.kind}
      className="absolute left-0 right-0 z-20 overflow-hidden bg-zinc-900 border-y border-white/10 shadow-[inset_0_8px_12px_-8px_rgba(0,0,0,0.6),inset_0_-8px_12px_-8px_rgba(0,0,0,0.6)]"
      style={{ top: `${topPx}px`, height: `${collapse.heightPx}px` }}
    >
      {/* Sticky-left wrapper — keeps the chip + glyph visible regardless of how
          far the user has scrolled horizontally. The wrapper height matches the
          band so the chip vertically centers without translate hacks. */}
      <div
        className="sticky top-0 h-full flex items-center pl-3 pointer-events-none"
        style={{ left: 0, width: 'fit-content' }}
      >
        <div className="inline-flex items-center gap-[9px] bg-zinc-800 border border-white/10 rounded-xl px-3 py-1 shadow">
          {/* Leading glyph — colored per category */}
          <span
            aria-hidden
            className={`flex items-center justify-center w-4 h-4 ${
              {
                night: 'text-blue-300',
                weekend: 'text-violet-300',
                closure: 'text-amber-300',
                pause: 'text-zinc-400',
              }[collapse.kind]
            }`}
          >
            <KindGlyph kind={collapse.kind} />
          </span>
          <span className="text-[12px] font-semibold text-zinc-200 tracking-wide">
            {KIND_LABEL[collapse.kind]}
          </span>
          <span className="font-mono text-[12px] font-medium text-zinc-300 pl-2 border-l border-white/10">
            {formatDuration(collapse.durationHours)}
          </span>
          <span className="font-mono text-[10px] text-zinc-500 pl-1">
            {formatRange(collapse.from, collapse.to)}
          </span>
        </div>
      </div>
    </div>
  );
});

function KindGlyph({ kind }: { kind: CollapseKind }) {
  switch (kind) {
    case 'night':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path d="M11 2a7 7 0 1 0 3 11A5 5 0 0 1 11 2z" fill="currentColor" />
        </svg>
      );
    case 'weekend':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <rect x="1.5" y="3" width="5.5" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <rect x="9" y="3" width="5.5" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1.5" y1="6" x2="7" y2="6" stroke="currentColor" strokeWidth="1.2" />
          <line x1="9" y1="6" x2="14.5" y2="6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'closure':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2.5" y="7" width="11" height="7" rx="1" fill="currentColor" />
        </svg>
      );
    case 'pause':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
          <rect x="4" y="3" width="2.4" height="10" rx="0.5" fill="currentColor" />
          <rect x="9.6" y="3" width="2.4" height="10" rx="0.5" fill="currentColor" />
        </svg>
      );
  }
}

function formatDuration(h: number): string {
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const r = Math.round(h - d * 24);
  return r === 0 ? `${d}d` : `${d}d ${r}h`;
}

const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function formatRange(from: Date, to: Date): string {
  const fd = DAY_NAMES_FR[from.getDay()];
  const td = DAY_NAMES_FR[to.getDay()];
  const fh = pad2(from.getHours()) + ':' + pad2(from.getMinutes());
  const th = pad2(to.getHours()) + ':' + pad2(to.getMinutes());
  return `${fd} ${fh} → ${td} ${th}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}
