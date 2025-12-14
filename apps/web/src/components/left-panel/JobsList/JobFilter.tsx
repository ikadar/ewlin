import { useCallback } from 'react';
import { cn } from '../../../lib/utils';
import { Search, X } from 'lucide-react';

interface JobFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function JobFilter({ value, onChange, className }: JobFilterProps) {
  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter jobs..."
        className={cn(
          'w-full h-9 pl-8 pr-8 text-sm',
          'bg-background border rounded-md',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
        )}
        aria-label="Filter jobs"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'h-5 w-5 flex items-center justify-center',
            'rounded-sm hover:bg-muted transition-colors'
          )}
          aria-label="Clear filter"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
