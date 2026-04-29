import { X } from 'lucide-react';

interface FluxDateRangeFilterProps {
  label: string;
  /** ISO YYYY-MM-DD or null. */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  testId?: string;
}

export function FluxDateRangeFilter({
  label,
  from,
  to,
  onChange,
  testId,
}: FluxDateRangeFilterProps) {
  const hasValue = !!from || !!to;
  const tid = testId ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 bg-flux-base border rounded transition-colors ${
        hasValue ? 'border-blue-500' : 'border-flux-border-light'
      }`}
      data-testid={`flux-filter-${tid}`}
    >
      <span
        className={`text-[11px] mr-1 ${hasValue ? 'text-flux-text-primary' : 'text-flux-text-tertiary'}`}
      >
        {label}
      </span>
      <input
        type="date"
        value={from ?? ''}
        onChange={e => onChange(e.target.value || null, to)}
        className="bg-transparent border-none text-xs text-flux-text-primary outline-none py-0.5 [color-scheme:dark]"
        aria-label={`${label} — début`}
      />
      <span className="text-flux-text-muted text-[11px]">→</span>
      <input
        type="date"
        value={to ?? ''}
        onChange={e => onChange(from, e.target.value || null)}
        className="bg-transparent border-none text-xs text-flux-text-primary outline-none py-0.5 [color-scheme:dark]"
        aria-label={`${label} — fin`}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-flux-text-tertiary hover:text-flux-text-primary inline-flex items-center"
          aria-label={`Effacer ${label}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
