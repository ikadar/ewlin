import { memo } from 'react';
import { TAB_IDS, TAB_LABELS, type TabId } from '../FluxTable/fluxFilters';

interface FluxTabBarProps {
  activeTab: TabId;
  counts: Record<TabId, number>;
  onTabChange: (tab: TabId) => void;
}

/**
 * Tab bar for the Production Flow Dashboard.
 * 5 tabs with active/inactive visual state and dynamic count badges.
 * Includes a keyboard shortcut hint bar on the right.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md, sections 3.3, 3.4
 */
export const FluxTabBar = memo(function FluxTabBar({
  activeTab,
  counts,
  onTabChange,
}: FluxTabBarProps) {
  return (
    <div
      className="flex items-end justify-between border-b border-flux-border bg-flux-elevated px-4"
      data-testid="flux-tab-bar"
    >
      {/* Tabs */}
      <div className="flex items-end gap-0" role="tablist" aria-label="Filtres du tableau de flux">
        {TAB_IDS.map(tab => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab)}
              data-testid={`flux-tab-${tab}`}
              className={[
                'px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-blue-500 text-white bg-flux-hover'
                  : 'border-transparent text-flux-text-secondary hover:text-white hover:bg-flux-hover/50',
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
              <span
                className={[
                  'ml-1.5 px-1 py-0.5 rounded text-[10px] font-semibold',
                  isActive
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-flux-surface text-flux-text-muted',
                ].join(' ')}
                data-testid={`flux-tab-count-${tab}`}
              >
                {counts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Keyboard hint bar */}
      <div
        className="flex items-center gap-2 pb-2 shrink-0"
        style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
        aria-hidden="true"
        data-testid="flux-keyboard-hints"
      >
        <ShortcutHint keys={['Alt+←', 'Alt+→']} label="Tab" />
        <Divider />
        <ShortcutHint keys={['Alt+↑', 'Alt+↓']} label="Ligne" />
        <Divider />
        <ShortcutHint keys={['Alt+F']} label="Rech." />
        <Divider />
        <ShortcutHint keys={['Alt+N']} label="Nouveau" />
      </div>
    </div>
  );
});

function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center gap-1 text-flux-text-muted">
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && <span className="mr-1">/</span>}
          <kbd
            className="px-1 py-0.5 rounded border border-flux-border-light bg-flux-surface text-flux-text-tertiary"
            style={{ fontSize: '10px', fontFamily: 'inherit' }}
          >
            {k}
          </kbd>
        </span>
      ))}
      <span className="ml-1 text-flux-text-muted">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-flux-border-light">|</span>;
}
