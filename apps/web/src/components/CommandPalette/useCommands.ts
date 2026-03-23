import { useMemo } from 'react';

export interface Command {
  id: string;
  label: string;
  category: 'Navigation' | 'Actions' | 'Affichage' | 'Grille' | 'Job selectionne' | 'Jobs';
  shortcut?: string;
  keywords?: string;
  icon?: string;
  action: () => void;
}

/** Zone definition for the static shortcut reference grid */
export interface ShortcutZone {
  id: string;
  title: string;
  shortcuts: { label: string; keys: string[] }[];
}

export interface UseCommandsOptions {
  // Shared (always available)
  onNavigateScheduler: () => void;
  onNavigateFlux: () => void;
  onNewJob: () => void;
  onSearchJobs: () => void;
  onSmartCompact: () => void;
  onEvaluateSchedule: () => void;

  // Scheduler-specific (optional — omitted when called from non-scheduler pages)
  selectedJobId?: string | null;
  onJumpToToday?: () => void;
  onJumpToDeparture?: () => void;
  onPrevJob?: () => void;
  onNextJob?: () => void;
  onEditJob?: () => void;
  onToggleDisplayMode?: () => void;
  onToggleSidebar?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onOpenSaveLoad?: () => void;
  onClearJobAssignments?: () => void;
  onClearAllAssignments?: () => void;
  onAsapPlacement?: () => void;
  onAlapPlacement?: () => void;
  onAutoPlaceAll?: () => void;
}

const RECENT_KEY = 'flux-recent-commands';
const MAX_RECENT = 3;

export function getRecentCommandIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentCommand(commandId: string): void {
  try {
    const recent = getRecentCommandIds().filter(id => id !== commandId);
    recent.unshift(commandId);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

/** Static shortcut zones for the reference card grid */
export const SHORTCUT_ZONES: ShortcutZone[] = [
  {
    id: 'navigation',
    title: 'Navigation',
    shortcuts: [
      { label: "Aller à aujourd'hui", keys: ['Home'] },
      { label: 'Aller au départ', keys: ['Alt', 'D'] },
      { label: 'Job précédent', keys: ['Alt', '\u2191'] },
      { label: 'Job suivant', keys: ['Alt', '\u2193'] },
      { label: 'Aller au Planning', keys: ['Alt', 'P'] },
      { label: 'Aller au Flux', keys: ['Alt', 'X'] },
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    shortcuts: [
      { label: 'Modifier le job', keys: ['Alt', 'E'] },
      { label: 'Nouveau job', keys: ['Alt', 'N'] },
      { label: 'Rechercher des jobs', keys: ['Alt', 'F'] },
    ],
  },
  {
    id: 'display',
    title: 'Affichage',
    shortcuts: [
      { label: 'PRODUIT / TIRAGE', keys: ['Alt', 'A'] },
      { label: 'Panneau latéral', keys: ['Alt', 'B'] },
    ],
  },
  {
    id: 'grid',
    title: 'Grille',
    shortcuts: [
      { label: 'Jour suivant', keys: ['PgDn'] },
      { label: 'Jour précédent', keys: ['PgUp'] },
      { label: 'Zoom +', keys: ['Ctrl', '+'] },
      { label: 'Zoom -', keys: ['Ctrl', '-'] },
    ],
  },
  {
    id: 'job-context',
    title: 'Job selectionne',
    shortcuts: [
      { label: 'Voir le depart', keys: ['Alt', 'D'] },
      { label: 'Modifier ce job', keys: ['Alt', 'E'] },
      { label: 'Tache terminee', keys: ['Space'] },
      { label: 'Auto-place ASAP', keys: ['Alt+P', 'S'] },
      { label: 'Auto-place ALAP', keys: ['Alt+P', 'L'] },
      { label: 'Effacer toutes les tuiles', keys: ['Alt', 'Z'] },
      { label: 'Effacer toutes les tuiles (global)', keys: ['Ctrl', 'Alt', 'Z'] },
    ],
  },
  {
    id: 'compaction',
    title: 'Compaction',
    shortcuts: [
      { label: 'Smart Compaction', keys: ['Ctrl', 'Alt', 'C'] },
    ],
  },
  {
    id: 'system',
    title: 'Systeme',
    shortcuts: [
      { label: 'Command Center', keys: ['Alt', 'K'] },
    ],
  },
];

export function useCommands(options: UseCommandsOptions): Command[] {
  const {
    selectedJobId,
    onNavigateScheduler,
    onNavigateFlux,
    onNewJob,
    onSearchJobs,
    onSmartCompact,
    onEvaluateSchedule,
    onJumpToToday,
    onJumpToDeparture,
    onPrevJob,
    onNextJob,
    onEditJob,
    onToggleDisplayMode,
    onToggleSidebar,
    onZoomIn,
    onZoomOut,
    onOpenSaveLoad,
    onClearJobAssignments,
    onClearAllAssignments,
    onAsapPlacement,
    onAlapPlacement,
    onAutoPlaceAll,
  } = options;

  return useMemo(() => {
    const commands: Command[] = [
      // Navigation (shared)
      { id: 'go-scheduler', label: 'Aller au Planning', category: 'Navigation', shortcut: 'Alt+P', keywords: 'scheduler planning grille', icon: 'layout-grid', action: onNavigateScheduler },
      { id: 'go-flux', label: 'Aller au Flux', category: 'Navigation', shortcut: 'Alt+X', keywords: 'flux tableau dashboard', icon: 'table', action: onNavigateFlux },

      // Actions (shared)
      { id: 'new-job', label: 'Nouveau job', category: 'Actions', shortcut: 'Alt+N', keywords: 'create creer nouveau job', icon: 'plus', action: onNewJob },
      { id: 'search-jobs', label: 'Rechercher des jobs', category: 'Actions', shortcut: 'Alt+F', keywords: 'search chercher rechercher filtrer', icon: 'search', action: onSearchJobs },

      // Smart Compaction (shared)
      { id: 'smart-compact', label: 'Smart Compaction', category: 'Actions', shortcut: 'Ctrl+Alt+C', keywords: 'compact smart similarity reorder optimize compacter', action: onSmartCompact },
      { id: 'evaluate-schedule', label: 'Évaluation du planning', category: 'Actions', shortcut: 'Ctrl+Alt+E', keywords: 'évaluation score calage délai retard evaluate scoring', icon: 'sparkles', action: onEvaluateSchedule },

    ];

    // Scheduler-specific: Navigation
    if (onJumpToToday) {
      commands.push({ id: 'go-today', label: "Aller a aujourd'hui", category: 'Navigation', shortcut: 'Home', keywords: 'today aujourdhui scroll', icon: 'calendar', action: onJumpToToday });
    }
    if (onJumpToDeparture) {
      commands.push({ id: 'go-departure', label: 'Aller au départ', category: 'Navigation', shortcut: 'Alt+D', keywords: 'departure depart deadline echeance', icon: 'truck', action: onJumpToDeparture });
    }
    if (onPrevJob) {
      commands.push({ id: 'prev-job', label: 'Job précédent', category: 'Navigation', shortcut: 'Alt+\u2191', keywords: 'navigate precedent haut', icon: 'arrow-up', action: onPrevJob });
    }
    if (onNextJob) {
      commands.push({ id: 'next-job', label: 'Job suivant', category: 'Navigation', shortcut: 'Alt+\u2193', keywords: 'navigate suivant bas', icon: 'arrow-down', action: onNextJob });
    }

    // Scheduler-specific: Actions
    if (onEditJob) {
      commands.push({ id: 'edit-job', label: 'Modifier le job', category: 'Actions', shortcut: 'Alt+E', keywords: 'edit modifier job formulaire', icon: 'pencil', action: onEditJob });
    }
    if (onClearJobAssignments) {
      commands.push({ id: 'clear-job-tiles', label: 'Effacer toutes les tuiles', category: 'Job selectionne', shortcut: 'Alt+Z', keywords: 'effacer supprimer tuiles désplanifier rappeler clear remove tiles unschedule recall', icon: 'trash-2', action: onClearJobAssignments });
    }
    if (onClearAllAssignments) {
      commands.push({ id: 'clear-all-tiles', label: 'Effacer toutes les tuiles (global)', category: 'Actions', shortcut: 'Ctrl+Alt+Z', keywords: 'effacer tout désplanifier masse rappeler global réinitialiser clear all unschedule mass recall global reset', icon: 'trash-2', action: onClearAllAssignments });
    }
    if (onAsapPlacement) {
      commands.push({ id: 'asap-placement', label: 'Auto-place ASAP', category: 'Job selectionne', shortcut: 'Alt+P S', keywords: 'asap auto place schedule earliest soon precedence', icon: 'fast-forward', action: onAsapPlacement });
    }
    if (onAlapPlacement) {
      commands.push({ id: 'alap-placement', label: 'Auto-place ALAP', category: 'Job selectionne', shortcut: 'Alt+P L', keywords: 'alap latest deadline backward auto place', icon: 'rewind', action: onAlapPlacement });
    }
    if (onAutoPlaceAll) {
      commands.push({ id: 'auto-place-all', label: 'Auto-place all (V1)', category: 'Actions', shortcut: 'Ctrl+Alt+P', keywords: 'auto place all global fbi dynamic cr schedule everything', icon: 'zap', action: onAutoPlaceAll });
    }

    // Scheduler-specific: Affichage
    if (onToggleDisplayMode) {
      commands.push({ id: 'toggle-display', label: 'Basculer PRODUIT/TIRAGE', category: 'Affichage', shortcut: 'Alt+A', keywords: 'display mode produit tirage affichage basculer', icon: 'eye', action: onToggleDisplayMode });
    }
    if (onToggleSidebar) {
      commands.push({ id: 'toggle-sidebar', label: 'Afficher/masquer le panneau lateral', category: 'Affichage', shortcut: 'Alt+B', keywords: 'sidebar panneau lateral masquer afficher', icon: 'panel-left', action: onToggleSidebar });
    }

    // Scheduler-specific: Grille (zoom)
    if (onZoomIn) {
      commands.push({ id: 'zoom-in', label: 'Zoom +', category: 'Grille', shortcut: 'Ctrl++', keywords: 'zoom agrandir plus', icon: 'zoom-in', action: onZoomIn });
    }
    if (onZoomOut) {
      commands.push({ id: 'zoom-out', label: 'Zoom -', category: 'Grille', shortcut: 'Ctrl+-', keywords: 'zoom reduire moins', icon: 'zoom-out', action: onZoomOut });
    }

    // Scheduler-specific: Actions (save/load)
    if (onOpenSaveLoad) {
      commands.push({ id: 'save-load', label: 'Sauvegardes', category: 'Actions', keywords: 'save load sauvegarder charger sauvegarde', icon: 'save', action: onOpenSaveLoad });
    }

    return commands;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, onNavigateScheduler, onNavigateFlux, onNewJob, onSearchJobs, onSmartCompact, onEvaluateSchedule, onJumpToToday, onJumpToDeparture, onPrevJob, onNextJob, onEditJob, onClearJobAssignments, onClearAllAssignments, onAsapPlacement, onAlapPlacement, onAutoPlaceAll, onToggleDisplayMode, onToggleSidebar, onZoomIn, onZoomOut, onOpenSaveLoad]);
}
