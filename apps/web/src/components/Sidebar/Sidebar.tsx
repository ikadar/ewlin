import { useState, useRef, useEffect } from 'react';
import { CalendarDays, TowerControl, Settings, User, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SidebarButton } from './SidebarButton';
import { useAppSelector, useAppDispatch } from '../../store';
import { selectCurrentUser, selectIsAuthenticated, logout } from '../../store/slices/authSlice';
import { shouldUseMockMode } from '../../store/api/baseApi';

/**
 * Sidebar navigation component.
 * Provides top-level navigation between main application views.
 * Always visible on the left side of the screen.
 * REQ-07: Full viewport height with User/Settings at bottom.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isMock = shouldUseMockMode();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSettings = location.pathname.startsWith('/settings');
  const isFlux = location.pathname.startsWith('/flux');
  const isScheduler = !isSettings && !isFlux;

  // Close menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showUserMenu]);

  function handleLogout() {
    setShowUserMenu(false);
    dispatch(logout());
    navigate('/login', { replace: true });
  }

  function getUserInitials(): string {
    if (!currentUser?.displayName) return '?';
    return currentUser.displayName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

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
            icon={TowerControl}
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
          {isMock || !isAuthenticated ? (
            <SidebarButton
              icon={User}
              label="User"
              isDisabled
              testId="sidebar-user-button"
            />
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-zinc-300 hover:bg-white/15 hover:text-white transition-colors text-xs font-semibold"
                aria-label="User menu"
                data-testid="sidebar-user-button"
              >
                {getUserInitials()}
              </button>
              {showUserMenu && (
                <div className="absolute bottom-12 left-0 bg-flux-surface border border-flux-border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                  <div className="px-3 py-2 text-xs text-flux-text-muted border-b border-flux-border truncate">
                    {currentUser?.email}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-flux-text-secondary hover:bg-flux-hover transition-colors"
                    data-testid="sidebar-logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                    Kijelentkezés
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
