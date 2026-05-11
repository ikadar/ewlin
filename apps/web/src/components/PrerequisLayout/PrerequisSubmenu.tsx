import { NavLink, useLocation } from 'react-router-dom';

const PREREQUIS_ITEMS = [
  { label: 'Papier',  path: '/prerequis/papier' },
  { label: 'Formes',  path: '/prerequis/formes' },
  { label: 'BAT',     path: '/prerequis/bat' },
  { label: 'Plaques', path: '/prerequis/plaques' },
];

const MAGASIN_ITEMS = [
  { label: 'Expéditions', path: '/logistique' },
];

const ACTIVITE_ITEMS = [
  { label: 'Rapport de production', path: '/rapport-production' },
];

type SectionProps = {
  title: string;
  items: { label: string; path: string }[];
  preserveSearch?: boolean;
};

function Section({ title, items, preserveSearch }: SectionProps) {
  const { search } = useLocation();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-flux-hover text-white'
        : 'text-flux-text-secondary hover:text-white hover:bg-flux-surface'
    }`;

  return (
    <>
      <p className="text-xs font-medium text-flux-text-tertiary uppercase tracking-wider px-2 mb-2">
        {title}
      </p>
      <nav className="flex flex-col gap-1">
        {items.map(({ label, path }) => (
          <NavLink
            key={path}
            to={preserveSearch ? { pathname: path, search } : path}
            className={linkClass}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function PrerequisSubmenu() {
  return (
    <div className="w-72 shrink-0 bg-flux-surface border-r border-flux-border overflow-y-auto">
      <div className="p-3">
        <Section title="Prérequis" items={PREREQUIS_ITEMS} preserveSearch />

        <div className="my-3 border-t border-flux-border" />
        <Section title="Magasin et expéditions" items={MAGASIN_ITEMS} />

        <div className="my-3 border-t border-flux-border" />
        <Section title="Activité" items={ACTIVITE_ITEMS} />
      </div>
    </div>
  );
}
