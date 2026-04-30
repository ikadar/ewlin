import { NavLink } from 'react-router-dom';
import { ClipboardCheck, Archive } from 'lucide-react';

const HISTORY_ITEMS = [
  { label: "Journal d'audit",  path: '/historique/journal',  icon: ClipboardCheck },
  { label: 'Archives',          path: '/historique/archives', icon: Archive },
];

/**
 * Submenu panel for /historique/*. Width matches the SettingsSubmenu
 * (w-72) so the visual rhythm of the bottom-section menus stays
 * consistent.
 *
 * Two entries today (Audit + Archives) but the namespace can host
 * future read-only "history-style" tools (compute log replay, engine
 * version diff browser, …) without re-introducing them as top-level
 * sidebar entries.
 */
export function HistorySubmenu() {
  return (
    <div className="w-72 shrink-0 bg-flux-surface border-r border-flux-border overflow-y-auto">
      <div className="p-3">
        <p className="text-xs font-medium text-flux-text-tertiary uppercase tracking-wider px-2 mb-2">
          Historique &amp; audit
        </p>
        <nav className="flex flex-col gap-1">
          {HISTORY_ITEMS.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-flux-hover text-white'
                    : 'text-flux-text-secondary hover:text-white hover:bg-flux-surface'
                }`
              }
            >
              <Icon size={14} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
