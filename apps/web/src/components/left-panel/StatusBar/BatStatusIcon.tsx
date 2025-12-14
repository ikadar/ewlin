import { memo } from 'react';
import { AlertTriangle, Circle, Check, Minus } from 'lucide-react';
import { cn } from '../../../lib/utils';

type BatStatus = 'awaiting' | 'sent' | 'approved' | 'noProof';

interface BatStatusIconProps {
  proofSentAt: string | null;
  proofApprovedAt: string | null;
  className?: string;
}

function getBatStatus(proofSentAt: string | null, proofApprovedAt: string | null): BatStatus {
  if (proofSentAt === 'NoProofRequired') {
    return 'noProof';
  }
  if (!proofSentAt || proofSentAt === 'AwaitingFile') {
    return 'awaiting';
  }
  if (proofApprovedAt) {
    return 'approved';
  }
  return 'sent';
}

const statusConfig: Record<BatStatus, { icon: typeof AlertTriangle; label: string; color: string }> = {
  awaiting: {
    icon: AlertTriangle,
    label: 'BAT: Awaiting file',
    color: 'text-amber-500',
  },
  sent: {
    icon: Circle,
    label: 'BAT: Sent, awaiting approval',
    color: 'text-blue-500',
  },
  approved: {
    icon: Check,
    label: 'BAT: Approved',
    color: 'text-green-500',
  },
  noProof: {
    icon: Minus,
    label: 'BAT: No proof required',
    color: 'text-muted-foreground',
  },
};

export const BatStatusIcon = memo(function BatStatusIcon({
  proofSentAt,
  proofApprovedAt,
  className,
}: BatStatusIconProps) {
  const status = getBatStatus(proofSentAt, proofApprovedAt);
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn('relative group', className)}
      title={config.label}
      data-testid="bat-status-icon"
      data-status={status}
    >
      <Icon className={cn('h-4 w-4', config.color)} />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {config.label}
      </div>
    </div>
  );
});
