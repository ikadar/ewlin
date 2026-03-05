/**
 * Expected Result Item Component
 *
 * Displays a single expected result with OK/KO buttons.
 */

import { Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ExpectedResult, ResultStatus } from '../types';

interface ExpectedResultItemProps {
  result: ExpectedResult;
  status: ResultStatus;
  onStatusChange: (status: ResultStatus) => void;
}

export function ExpectedResultItem({
  result,
  status,
  onStatusChange,
}: ExpectedResultItemProps) {
  const handleOkClick = () => {
    onStatusChange(status === 'ok' ? 'untested' : 'ok');
  };

  const handleKoClick = () => {
    onStatusChange(status === 'ko' ? 'untested' : 'ko');
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg transition-colors',
        status === 'ok' && 'bg-emerald-500/10',
        status === 'ko' && 'bg-red-500/10',
        status === 'untested' && 'bg-zinc-800/50'
      )}
    >
      {/* OK/KO buttons */}
      <div className="flex gap-1 shrink-0">
        <button
          onClick={handleOkClick}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center transition-colors',
            status === 'ok'
              ? 'bg-emerald-500 text-white'
              : 'bg-zinc-700 hover:bg-emerald-500/50 text-zinc-300'
          )}
          title="Mark as OK"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleKoClick}
          className={cn(
            'w-7 h-7 rounded flex items-center justify-center transition-colors',
            status === 'ko'
              ? 'bg-red-500 text-white'
              : 'bg-zinc-700 hover:bg-red-500/50 text-zinc-300'
          )}
          title="Mark as KO"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Result text */}
      <span
        className={cn(
          'flex-1 text-base pt-1',
          status === 'ok' && 'text-emerald-300',
          status === 'ko' && 'text-red-300',
          status === 'untested' && 'text-zinc-300'
        )}
      >
        {result.text}
      </span>
    </div>
  );
}
