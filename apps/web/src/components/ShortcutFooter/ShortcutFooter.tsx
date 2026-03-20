import { useMemo } from 'react';
import { KBD_CLASS } from './kbdStyles';

export type FooterMode = 'default' | 'jobSelected' | 'picking' | 'jcfModal' | 'flux';

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
      { keys: ['Home'], label: "Aujourd'hui" },
      { keys: ['PgUp', 'PgDn'], label: 'Défiler' },
      { keys: ['Ctrl', '+', '-'], label: 'Zoom' },
      { keys: ['Alt', 'A'], label: 'Affichage' },
      { keys: ['Alt', 'K'], label: 'Commandes' },
    ],
  },
  jobSelected: {
    shortcuts: [
      { keys: ['Click'], label: 'Saisir tuile' },
      { keys: ['Esc'], label: 'Fermer' },
      { keys: ['Alt', 'D'], label: 'Départ' },
      { keys: ['Alt', '\u2191', '\u2193'], label: 'Naviguer' },
      { keys: ['Alt', 'P', 'S'], label: 'ASAP' },
      { keys: ['Alt', 'P', 'L'], label: 'ALAP' },
      { keys: ['Alt', 'Z'], label: 'Effacer tuiles' },
      { keys: ['Alt', 'K'], label: 'Commandes' },
    ],
  },
  picking: {
    modeLabel: '\uD83C\uDFAF PLACEMENT',
    modeLabelClass: 'text-amber-400',
    shortcuts: [
      { keys: ['Click'], label: 'Placer' },
      { keys: ['Esc'], label: 'Annuler' },
      { keys: ['Alt', 'K'], label: 'Commandes' },
    ],
  },
  jcfModal: {
    shortcuts: [
      { keys: ['\u2318', 'S'], label: 'Sauvegarder' },
      { keys: ['Alt', '\u2190', '\u2191', '\u2193', '\u2192'], label: 'Naviguer' },
      { keys: ['Tab'], label: 'Cellule suiv.' },
      { keys: ['Esc'], label: 'Fermer' },
      { keys: ['Alt', 'K'], label: 'Commandes' },
    ],
  },
  flux: {
    shortcuts: [
      { keys: ['Alt', 'F'], label: 'Rechercher' },
      { keys: ['Alt', 'N'], label: 'Nouveau job' },
      { keys: ['Alt', '\u2190', '\u2192'], label: 'Onglets' },
      { keys: ['Alt', 'K'], label: 'Commandes' },
    ],
  },
};

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
