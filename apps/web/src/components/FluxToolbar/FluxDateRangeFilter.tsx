import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

interface FluxDateRangeFilterProps {
  label: string;
  /** ISO YYYY-MM-DD or null. */
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
  testId?: string;
}

function fmtIsoToShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function summarize(from: string | null, to: string | null): string {
  if (from && to) return `${fmtIsoToShort(from)} → ${fmtIsoToShort(to)}`;
  if (from)       return `dès ${fmtIsoToShort(from)}`;
  if (to)         return `jusqu'au ${fmtIsoToShort(to)}`;
  return '';
}

export function FluxDateRangeFilter({
  label,
  from,
  to,
  onChange,
  testId,
}: FluxDateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0 });

  const hasValue = !!from || !!to;
  const tid = testId ?? label.toLowerCase().replace(/\s+/g, '-');

  const open = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropdownStyle({ top: rect.bottom + 4, left: rect.left });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close() : open())}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[32px] bg-flux-base border rounded text-xs whitespace-nowrap transition-colors ${
          hasValue
            ? 'border-blue-500 text-flux-text-primary'
            : 'border-flux-border-light text-flux-text-tertiary hover:border-flux-text-tertiary'
        }`}
        data-testid={`flux-filter-${tid}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className={hasValue ? 'text-flux-text-primary' : 'text-flux-text-tertiary'}>
          {label}
        </span>
        {hasValue ? (
          <>
            <span className="text-[11px] text-flux-text-secondary">{summarize(from, to)}</span>
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Effacer ${label}`}
              className="text-flux-text-tertiary hover:text-flux-text-primary inline-flex items-center"
              onClick={e => { e.stopPropagation(); onChange(null, null); }}
            >
              <X className="w-3 h-3" />
            </span>
          </>
        ) : (
          <ChevronDown className="w-3 h-3 text-flux-text-tertiary" />
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-flux-elevated border border-flux-border-light rounded-md shadow-2xl p-3 flex flex-col gap-3"
          style={{ top: dropdownStyle.top, left: dropdownStyle.left }}
          data-testid={`flux-filter-${tid}-dropdown`}
        >
          <div className="w-[182px]">
            <label htmlFor={`flux-${tid}-from`} className="block text-xs leading-[13px] text-zinc-500 mb-[3px]">
              Du
            </label>
            <input
              id={`flux-${tid}-from`}
              type="date"
              value={from ?? ''}
              onChange={e => onChange(e.target.value || null, to)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-[13px] leading-[15px] text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              aria-label={`${label} — début`}
            />
          </div>
          <div className="w-[182px]">
            <label htmlFor={`flux-${tid}-to`} className="block text-xs leading-[13px] text-zinc-500 mb-[3px]">
              Au
            </label>
            <input
              id={`flux-${tid}-to`}
              type="date"
              value={to ?? ''}
              onChange={e => onChange(from, e.target.value || null)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-[13px] leading-[15px] text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
              aria-label={`${label} — fin`}
            />
          </div>
          <div className="flex justify-end pt-2 border-t border-flux-border">
            <button
              type="button"
              onClick={() => onChange(null, null)}
              disabled={!hasValue}
              className="text-xs text-flux-text-tertiary hover:text-flux-text-primary px-2 py-1 rounded hover:bg-flux-hover disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Effacer
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
