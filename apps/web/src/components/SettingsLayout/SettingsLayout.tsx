import { Outlet } from 'react-router-dom';
import { SettingsSubmenu } from './SettingsSubmenu';

/**
 * Layout wrapper for all /settings/* routes.
 * Renders the SettingsSubmenu on the left and the active settings page on the right.
 */
export function SettingsLayout() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <SettingsSubmenu />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
