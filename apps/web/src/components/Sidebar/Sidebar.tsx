import { LayoutGrid, Calendar, Settings, User, Users, Ruler } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
 * REQ-07: Full viewport height with User/Settings at bottom.
 */
export function Sidebar({ activeView = 'schedule', onNavigate }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <nav
      className="w-14 shrink-0 bg-zinc-900/50 border-r border-white/5 h-full"
      aria-label="Main navigation"
      data-testid="sidebar"
    >
      <div className="h-full flex flex-col">
        {/* Top navigation section */}
        <div className="flex flex-col items-center py-3 gap-2">
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
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section: Settings/User (REQ-07.3) */}
        <div className="flex flex-col items-center py-3 gap-2 border-t border-white/5">
          <SidebarButton
            icon={Users}
            label="Clients"
            onClick={() => navigate('/clients')}
          />
          <SidebarButton
            icon={Ruler}
            label="Formats"
            onClick={() => navigate('/formats')}
          />
          <SidebarButton
            icon={Settings}
            label="Templates"
            onClick={() => navigate('/templates')}
            testId="sidebar-settings-button"
          />
          <SidebarButton
            icon={User}
            label="User"
            isDisabled
            testId="sidebar-user-button"
          />
        </div>
      </div>
    </nav>
  );
}
