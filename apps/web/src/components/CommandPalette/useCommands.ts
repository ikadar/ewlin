import { useMemo } from 'react';

export interface Command {
  id: string;
  label: string;
  category: 'Navigation' | 'Actions' | 'Affichage' | 'Aide';
  shortcut?: string;
  keywords?: string;
  icon?: string;
  action: () => void;
}

interface UseCommandsOptions {
  selectedJobId: string | null;
  isQuickPlacementMode: boolean;
  onJumpToToday: () => void;
  onJumpToDeparture: () => void;
  onPrevJob: () => void;
  onNextJob: () => void;
  onNavigateScheduler: () => void;
  onNavigateFlux: () => void;
  onToggleQuickPlacement: () => void;
  onEditJob: () => void;
  onNewJob: () => void;
  onSearchJobs: () => void;
  onToggleDisplayMode: () => void;
  onToggleSidebar: () => void;
  onShowAllShortcuts: () => void;
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

export function useCommands(options: UseCommandsOptions): Command[] {
  return useMemo(() => {
    const commands: Command[] = [
      // Navigation
      { id: 'go-today', label: "Aller à aujourd'hui", category: 'Navigation', shortcut: 'Home', keywords: 'today aujourdhui scroll', icon: 'calendar', action: options.onJumpToToday },
      { id: 'go-departure', label: 'Aller au départ', category: 'Navigation', shortcut: 'Alt+D', keywords: 'departure depart deadline echeance', icon: 'truck', action: options.onJumpToDeparture },
      { id: 'prev-job', label: 'Job précédent', category: 'Navigation', shortcut: 'Alt+\u2191', keywords: 'navigate precedent haut', icon: 'arrow-up', action: options.onPrevJob },
      { id: 'next-job', label: 'Job suivant', category: 'Navigation', shortcut: 'Alt+\u2193', keywords: 'navigate suivant bas', icon: 'arrow-down', action: options.onNextJob },
      { id: 'go-scheduler', label: 'Aller au Planning', category: 'Navigation', keywords: 'scheduler planning grille', icon: 'layout-grid', action: options.onNavigateScheduler },
      { id: 'go-flux', label: 'Aller au Flux', category: 'Navigation', keywords: 'flux tableau dashboard', icon: 'table', action: options.onNavigateFlux },

      // Actions
      { id: 'quick-placement', label: options.isQuickPlacementMode ? 'Quitter le placement rapide' : 'Mode placement rapide', category: 'Actions', shortcut: 'Alt+Q', keywords: 'place assign quick rapide placement', icon: 'zap', action: options.onToggleQuickPlacement },
      { id: 'edit-job', label: 'Modifier le job', category: 'Actions', shortcut: 'Alt+E', keywords: 'edit modifier job formulaire', icon: 'pencil', action: options.onEditJob },
      { id: 'new-job', label: 'Nouveau job', category: 'Actions', shortcut: 'Alt+N', keywords: 'create creer nouveau job', icon: 'plus', action: options.onNewJob },
      { id: 'search-jobs', label: 'Rechercher des jobs', category: 'Actions', shortcut: 'Alt+F', keywords: 'search chercher rechercher filtrer', icon: 'search', action: options.onSearchJobs },

      // Affichage
      { id: 'toggle-display', label: 'Basculer PRODUIT/TIRAGE', category: 'Affichage', shortcut: 'Alt+A', keywords: 'display mode produit tirage affichage basculer', icon: 'eye', action: options.onToggleDisplayMode },
      { id: 'toggle-sidebar', label: 'Afficher/masquer le panneau latéral', category: 'Affichage', shortcut: 'Alt+B', keywords: 'sidebar panneau lateral masquer afficher', icon: 'panel-left', action: options.onToggleSidebar },

      // Aide
      { id: 'show-shortcuts', label: 'Afficher tous les raccourcis', category: 'Aide', shortcut: '?', keywords: 'aide help raccourcis clavier shortcuts', icon: 'keyboard', action: options.onShowAllShortcuts },
    ];

    return commands;
  }, [options]);
}
