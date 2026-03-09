import { useMemo } from 'react';

export type FooterMode = 'default' | 'jobSelected' | 'quickPlacement' | 'picking' | 'jcfModal' | 'flux';

export interface ShortcutFooterProps {
  mode: FooterMode;
}

interface ShortcutItem {
  /** Individual key caps, rendered as separate <kbd> elements */
  keys: string[];
  label: string;
}

interface ModeConfig {
  modeLabel?: string;
  modeLabelClass?: string;
  shortcuts: ShortcutItem[];
}

const MODE_CONFIGS: Record<FooterMode, ModeConfig> = {
  default: {
    shortcuts: [
      { keys: ['Home'], label: 'Today' },
      { keys: ['PgUp', 'PgDn'], label: 'Scroll' },
      { keys: ['Alt', 'A'], label: 'Display' },
      { keys: ['Alt', 'K'], label: 'Commands' },
    ],
  },
  jobSelected: {
    shortcuts: [
      { keys: ['Esc'], label: 'Close' },
      { keys: ['Alt', 'Q'], label: 'Place' },
      { keys: ['Alt', 'D'], label: 'Departure' },
      { keys: ['Alt', '\u2191', '\u2193'], label: 'Navigate' },
      { keys: ['Alt', 'K'], label: 'Commands' },
    ],
  },
  quickPlacement: {
    modeLabel: '\u26A1 QUICK PLACEMENT',
    modeLabelClass: 'text-emerald-400',
    shortcuts: [
      { keys: ['Click'], label: 'Place' },
      { keys: ['Alt', '\u2191', '\u2193'], label: 'Switch Job' },
      { keys: ['Esc'], label: 'Exit' },
      { keys: ['Alt', 'K'], label: 'Commands' },
    ],
  },
  picking: {
    modeLabel: '\uD83C\uDFAF PICKING',
    modeLabelClass: 'text-amber-400',
    shortcuts: [
      { keys: ['Click'], label: 'Place' },
      { keys: ['Esc'], label: 'Cancel' },
      { keys: ['Alt', 'K'], label: 'Commands' },
    ],
  },
  jcfModal: {
    shortcuts: [
      { keys: ['\u2318', 'S'], label: 'Save' },
      { keys: ['Alt', '\u2190', '\u2191', '\u2193', '\u2192'], label: 'Navigate' },
      { keys: ['Tab'], label: 'Next Cell' },
      { keys: ['Esc'], label: 'Close' },
      { keys: ['Alt', 'K'], label: 'Commands' },
    ],
  },
  flux: {
    shortcuts: [
      { keys: ['Alt', 'F'], label: 'Search' },
      { keys: ['Alt', 'N'], label: 'New Job' },
      { keys: ['Alt', '\u2190', '\u2192'], label: 'Tabs' },
      { keys: ['Alt', 'K'], label: 'Commands' },
    ],
  },
};

const KBD_CLASS = 'inline-flex items-center justify-center min-w-[22px] min-h-[22px] px-1.5 py-0.5 rounded text-[11px] font-mono leading-none text-zinc-300 bg-gradient-to-b from-zinc-700 to-zinc-800 border border-zinc-600 border-b-zinc-500 shadow-[0_1px_0_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)]';

export function ShortcutFooter({ mode }: ShortcutFooterProps) {
  const config = useMemo(() => MODE_CONFIGS[mode], [mode]);

  return (
    <div
      className="shrink-0 h-10 flex items-center gap-5 px-5 bg-zinc-950/95 border-t border-zinc-800 z-40 transition-opacity duration-150"
      data-testid="shortcut-footer"
    >
      {config.modeLabel && (
        <span className={`text-xs font-bold tracking-wide ${config.modeLabelClass}`}>
          {config.modeLabel}
        </span>
      )}
      {config.shortcuts.map((item, i) => (
        <span key={`${mode}-${i}`} className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            {item.keys.map((k, j) => (
              <span key={j} className="flex items-center gap-1">
                {j > 0 && <span className="text-zinc-500 text-xs font-mono">+</span>}
                <kbd className={KBD_CLASS}>{k}</kbd>
              </span>
            ))}
          </span>
          <span className="text-zinc-500 text-[11px]">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
