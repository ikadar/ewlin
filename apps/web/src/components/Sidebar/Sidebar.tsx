import { LayoutGrid, Calendar, Settings } from 'lucide-react';
import { SidebarButton } from './SidebarButton';

export interface SidebarProps {
  /** Currently active view */
  activeView?: 'schedule' | 'calendar' | 'settings';
  /** Callback when a navigation item is clicked */
  onNavigate?: (view: 'schedule' | 'calendar' | 'settings') => void;
}

/**
 * Sidebar navigation component.
 * Provides top-level navigation between main application views.
 * Always visible on the left side of the screen.
 */
export function Sidebar({ activeView = 'schedule', onNavigate }: SidebarProps) {
  return (
    <aside
      className="w-14 shrink-0 bg-zinc-900/50 border-r border-white/5"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="h-full flex flex-col items-center py-3 gap-2">
      <SidebarButton
        icon={LayoutGrid}
        label="Scheduling view"
        isActive={activeView === 'schedule'}
        onClick={() => onNavigate?.('schedule')}
      />
      <SidebarButton
        icon={Calendar}
        label="Calendar view"
        isActive={activeView === 'calendar'}
        onClick={() => onNavigate?.('calendar')}
      />
      <SidebarButton
        icon={Settings}
        label="Settings"
        isActive={activeView === 'settings'}
        isDisabled
      />
      </div>
    </aside>
  );
}
