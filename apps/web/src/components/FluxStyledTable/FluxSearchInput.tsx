import { type RefObject } from 'react';
import { Search } from 'lucide-react';

interface FluxSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  resultCount?: number;
  totalCount?: number;
  countLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function FluxSearchInput({
  value,
  onChange,
  placeholder = 'Rechercher... (/)',
  ariaLabel = 'Rechercher',
  resultCount,
  totalCount,
  countLabel = 'résultat',
  inputRef,
}: FluxSearchInputProps) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <div className="relative flex-1 max-w-md">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
        />
      </div>
      {resultCount != null && (
        <span className="text-flux-text-tertiary text-sm">
          {resultCount} {countLabel}{resultCount !== 1 ? 's' : ''}
          {value && totalCount != null && ` / ${totalCount}`}
        </span>
      )}
    </div>
  );
}
