import type { OutsourcedProvider } from '@flux/types';
import { Building2 } from 'lucide-react';

export interface ProviderHeaderProps {
  /** Provider to display */
  provider: OutsourcedProvider;
  /** Whether this header is collapsed (during drag to another station) */
  isCollapsed?: boolean;
}

/**
 * ProviderHeader - Header cell for outsourced provider column.
 * Shows provider name with Building2 icon to distinguish from stations.
 */
export function ProviderHeader({
  provider,
  isCollapsed = false,
}: ProviderHeaderProps) {
  // Width: full (240px / w-60) or collapsed (120px / w-30)
  const widthClass = isCollapsed ? 'w-30' : 'w-60';

  return (
    <div
      className={`${widthClass} shrink-0 py-2 px-3 text-sm transition-all duration-150 ease-out flex flex-col border-l-2 border-dashed border-zinc-600`}
      data-testid={`provider-header-${provider.id}`}
    >
      {/* Top row: provider name and icon */}
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-zinc-500 shrink-0" data-testid="provider-icon" />
        <span className="font-medium text-zinc-300 truncate">{provider.name}</span>
      </div>

      {/* Bottom row: provider status */}
      {!isCollapsed && (
        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
          <span>Outsourced</span>
        </div>
      )}
    </div>
  );
}
