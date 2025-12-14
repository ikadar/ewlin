import { memo } from 'react';
import { Package, ShoppingCart, Truck, PackageCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PaperPurchaseStatus } from '../../../types';

interface PaperStatusIconProps {
  status: PaperPurchaseStatus;
  className?: string;
}

const statusConfig: Record<PaperPurchaseStatus, { icon: typeof Package; label: string; color: string }> = {
  InStock: {
    icon: PackageCheck,
    label: 'Paper: In stock',
    color: 'text-green-500',
  },
  ToOrder: {
    icon: ShoppingCart,
    label: 'Paper: To order',
    color: 'text-amber-500',
  },
  Ordered: {
    icon: Truck,
    label: 'Paper: Ordered',
    color: 'text-blue-500',
  },
  Received: {
    icon: PackageCheck,
    label: 'Paper: Received',
    color: 'text-green-500',
  },
};

export const PaperStatusIcon = memo(function PaperStatusIcon({
  status,
  className,
}: PaperStatusIconProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn('relative group', className)}
      title={config.label}
      data-testid="paper-status-icon"
      data-status={status}
    >
      <Icon className={cn('h-4 w-4', config.color)} />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {config.label}
      </div>
    </div>
  );
});
