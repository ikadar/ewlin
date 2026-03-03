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
      className="flex items-end justify-between border-b border-flux-border bg-flux-surface px-4"
      data-testid="flux-tab-bar"
    >
      {/* Tabs */}
      <div className="flex items-end gap-0 overflow-x-auto" role="tablist" aria-label="Filtres du tableau de flux">
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
                'px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-blue-500 text-white bg-flux-elevated'
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
        className="flex items-center gap-1 text-sm text-gray-500 shrink-0 pb-2"
        aria-hidden="true"
        data-testid="flux-keyboard-hints"
      >
        <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm font-mono">Alt</kbd>
        <span>+</span>
        <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm font-mono">↕</kbd>
        <span>naviguer</span>
        <span className="mx-1 text-gray-600">|</span>
        <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm font-mono">Alt</kbd>
        <span>+</span>
        <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm font-mono">↔</kbd>
        <span>onglets</span>
        <span className="mx-1 text-gray-600">|</span>
        <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm font-mono">Alt</kbd>
        <span>+</span>
        <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-sm font-mono">F</kbd>
        <span>rechercher</span>
      </div>
    </div>
  );
});
