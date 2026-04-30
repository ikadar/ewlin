import { Outlet } from 'react-router-dom';
import { HistorySubmenu } from './HistorySubmenu';

/**
 * Layout wrapper for `/historique/*` — the audit + archives umbrella.
 * Mirrors SettingsLayout: a w-72 submenu on the left, the active
 * page on the right.
 */
export function HistoryLayout() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <HistorySubmenu />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
