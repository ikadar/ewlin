import { memo } from 'react';
import { TAB_IDS, TAB_LABELS, type TabId } from '../FluxTable/fluxFilters';
import { KBD_CLASS } from '../ShortcutFooter/kbdStyles';

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
                'px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5',
                isActive
                  ? 'border-blue-500 text-white bg-flux-elevated'
                  : 'border-transparent text-flux-text-secondary hover:text-white hover:bg-flux-hover/50',
              ].join(' ')}
            >
              <span>{TAB_LABELS[tab]}</span>
              <span
                className="text-sm text-flux-text-muted"
                data-testid={`flux-tab-count-${tab}`}
              >
                ({counts[tab]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Keyboard hint bar */}
      <div
        className="flex items-center gap-5 shrink-0 pb-2"
        aria-hidden="true"
        data-testid="flux-keyboard-hints"
      >
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <kbd className={KBD_CLASS}>Alt</kbd>
            <span className="text-zinc-500 text-xs font-mono">+</span>
            <kbd className={KBD_CLASS}>←→</kbd>
          </span>
          <span className="text-zinc-500 text-[11px]">onglets</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <kbd className={KBD_CLASS}>Alt</kbd>
            <span className="text-zinc-500 text-xs font-mono">+</span>
            <kbd className={KBD_CLASS}>F</kbd>
          </span>
          <span className="text-zinc-500 text-[11px]">rechercher</span>
        </span>
      </div>
    </div>
  );
});
