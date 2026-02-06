/**
 * Status Icon Component
 *
 * Shows an icon representing test status.
 */

import { Check, X, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { TestStatus } from '../types';

interface StatusIconProps {
  status: TestStatus;
  className?: string;
}

export function StatusIcon({ status, className }: StatusIconProps) {
  switch (status) {
    case 'ok':
      return <Check className={cn('w-4 h-4 text-emerald-500', className)} />;
    case 'ko':
      return <X className={cn('w-4 h-4 text-red-500', className)} />;
    case 'partial':
      return <AlertCircle className={cn('w-4 h-4 text-amber-500', className)} />;
    case 'untested':
    default:
      return <Circle className={cn('w-4 h-4 text-zinc-500', className)} />;
  }
}
