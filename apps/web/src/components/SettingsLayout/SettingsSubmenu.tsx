import { NavLink } from 'react-router-dom';
import { useHasPermission } from '../../hooks/useHasPermission';

type SettingsItem = { label: string; path: string };

const ADMIN_ITEMS: SettingsItem[] = [
  { label: 'Utilisateurs',               path: '/settings/users' },
  { label: 'Groupes',                    path: '/settings/user-groups' },
];

const WORKSHOP_ITEMS: SettingsItem[] = [
  { label: 'Stations',                    path: '/settings/stations' },
  { label: 'Opérateurs',                  path: '/settings/operators' },
  { label: 'Catégories de stations',      path: '/settings/station-categories' },
];

const PARTNERS_ITEMS: SettingsItem[] = [
  { label: 'Sous-traitants',              path: '/settings/providers' },
  { label: 'Transporteurs',              path: '/settings/shippers' },
  { label: 'Clients',                     path: '/settings/clients' },
  { label: 'Référents',                  path: '/settings/referents' },
];

const PRESETS_ITEMS: SettingsItem[] = [
  { label: 'Formats',                     path: '/settings/formats' },
  { label: 'Impressions',                 path: '/settings/impression-presets' },
  { label: 'Surfacages',                  path: '/settings/surfacage-presets' },
  { label: 'Formats feuille (Impositions)', path: '/settings/feuille-formats' },
  { label: 'Templates',                   path: '/settings/templates' },
];

const PLANNING_ITEMS: SettingsItem[] = [
  { label: 'Safety Zone',                 path: '/settings/safety-zone' },
  { label: 'Écart de précédence',         path: '/settings/precedence-gap' },
  { label: 'Délai papier',                path: '/settings/paper-lead-time' },
  { label: 'Délai forme',                 path: '/settings/forme-lead-time' },
  { label: 'Délai plaques',              path: '/settings/plate-lead-time' },
];

const TOOLS_ITEMS: SettingsItem[] = [
  { label: 'QR codes plannings focus',    path: '/settings/qr-codes-focus' },
];

const TESTS_ITEMS: SettingsItem[] = [
  { label: 'Tests',                       path: '/settings/tests' },
];

function SettingsSection({ title, items }: { title: string; items: SettingsItem[] }) {
  return (
    <>
      <p className="text-xs font-medium text-flux-text-tertiary uppercase tracking-wider px-2 mb-2">
        {title}
      </p>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
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
      <div className="my-3 border-t border-flux-border" />
    </>
  );
}

export function SettingsSubmenu() {
  const canAdmin = useHasPermission('admin.users');

  return (
    <div className="w-72 shrink-0 bg-flux-surface border-r border-flux-border overflow-y-auto">
      <div className="p-3">
        {canAdmin && <SettingsSection title="Administration" items={ADMIN_ITEMS} />}
        <SettingsSection title="Atelier" items={WORKSHOP_ITEMS} />
        <SettingsSection title="Partenaires" items={PARTNERS_ITEMS} />
        <SettingsSection title="Presets de production" items={PRESETS_ITEMS} />
        <SettingsSection title="Planification" items={PLANNING_ITEMS} />
        <SettingsSection title="Outils" items={TOOLS_ITEMS} />
        <SettingsSection title="Tests" items={TESTS_ITEMS} />
      </div>
    </div>
  );
}
