import { memo } from 'react';
import { Circle, CheckCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { PlatesStatus } from '../../../types';

interface PlatesStatusIconProps {
  status: PlatesStatus;
  className?: string;
}

const statusConfig: Record<PlatesStatus, { icon: typeof Circle; label: string; color: string }> = {
  Todo: {
    icon: Circle,
    label: 'Plates: Todo',
    color: 'text-muted-foreground',
  },
  Done: {
    icon: CheckCircle,
    label: 'Plates: Done',
    color: 'text-green-500',
  },
};

export const PlatesStatusIcon = memo(function PlatesStatusIcon({
  status,
  className,
}: PlatesStatusIconProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn('relative group', className)}
      title={config.label}
      data-testid="plates-status-icon"
      data-status={status}
    >
      <Icon className={cn('h-4 w-4', config.color)} />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {config.label}
      </div>
    </div>
  );
});
