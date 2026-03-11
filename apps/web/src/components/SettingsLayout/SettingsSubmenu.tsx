import { NavLink } from 'react-router-dom';

const SETTINGS_ITEMS = [
  { label: 'Stations',                    path: '/settings/stations' },
  { label: 'Catégories de stations',      path: '/settings/station-categories' },
  { label: 'Sous-traitants',              path: '/settings/providers' },
  { label: 'Transporteurs',              path: '/settings/shippers' },
  { label: 'Clients',                     path: '/settings/clients' },
  { label: 'Formats',                     path: '/settings/formats' },
  { label: 'Impressions',                 path: '/settings/impression-presets' },
  { label: 'Surfacages',                  path: '/settings/surfacage-presets' },
  { label: 'Formats feuille (Impositions)', path: '/settings/feuille-formats' },
  { label: 'Templates',                   path: '/settings/templates' },
];

/**
 * Settings submenu panel — displayed instead of the JobsList when in settings mode.
 * Width matches the JobsList panel (w-72).
 */
export function SettingsSubmenu() {
  return (
    <div className="w-72 shrink-0 bg-flux-surface border-r border-flux-border overflow-y-auto">
      <div className="p-3">
        <p className="text-xs font-medium text-flux-text-tertiary uppercase tracking-wider px-2 mb-2">
          Settings
        </p>
        <nav className="flex flex-col gap-1">
          {SETTINGS_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-flux-hover text-white'
                    : 'text-flux-text-secondary hover:text-white hover:bg-flux-surface'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
