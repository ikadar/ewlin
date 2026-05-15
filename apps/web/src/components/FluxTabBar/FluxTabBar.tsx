import { memo } from 'react';
import {
  FLUX_TAB_BAR,
  FLUX_TAB_BASE,
  FLUX_TAB_ACTIVE,
  FLUX_TAB_INACTIVE,
} from '../FluxStyledTable/styles';

interface FluxTabBarProps<T extends string> {
  tabs: { key: T; label: string }[];
  activeTab: T;
  counts: Record<T, number>;
  onTabChange: (tab: T) => void;
  ariaLabel?: string;
  testIdPrefix?: string;
}

function FluxTabBarInner<T extends string>({
  tabs,
  activeTab,
  counts,
  onTabChange,
  ariaLabel = 'Filtres',
  testIdPrefix = 'flux-tab',
}: FluxTabBarProps<T>) {
  return (
    <div className={FLUX_TAB_BAR} data-testid={`${testIdPrefix}-bar`}>
      <div className="flex items-end gap-0" role="tablist" aria-label={ariaLabel}>
        {tabs.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.key)}
              data-testid={`${testIdPrefix}-${tab.key}`}
              className={`${FLUX_TAB_BASE} ${isActive ? FLUX_TAB_ACTIVE : FLUX_TAB_INACTIVE}`}
            >
              <span>{tab.label}</span>
              <span
                className="text-sm text-flux-text-muted"
                data-testid={`${testIdPrefix}-count-${tab.key}`}
              >
                ({counts[tab.key]})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const FluxTabBar = memo(FluxTabBarInner) as typeof FluxTabBarInner;
