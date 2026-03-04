import { CalendarDays, Gauge, Settings, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarButton } from './SidebarButton';

/**
 * Sidebar navigation component.
 * Provides top-level navigation between main application views.
 * Always visible on the left side of the screen.
 * REQ-07: Full viewport height with User/Settings at bottom.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettings = location.pathname.startsWith('/settings');
  const isFlux = location.pathname.startsWith('/flux');
  const isScheduler = !isSettings && !isFlux;

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
            icon={CalendarDays}
            label="Planificateur"
            isActive={isScheduler}
            onClick={() => navigate('/')}
          />
          <SidebarButton
            icon={Gauge}
            label="Flux de production"
            isActive={isFlux}
            onClick={() => navigate('/flux')}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section: Settings/User (REQ-07.3) */}
        <div className="flex flex-col items-center py-3 gap-2 border-t border-white/5">
          <SidebarButton
            icon={Settings}
            label="Settings"
            isActive={isSettings}
            onClick={() => navigate('/settings/stations')}
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
