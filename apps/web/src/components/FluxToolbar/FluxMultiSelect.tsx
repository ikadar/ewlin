import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export interface FluxMultiSelectOption<V extends string | number = string> {
  value: V;
  label: string;
  /** Optional CSS class applied to a 7px swatch dot rendered before the label. */
  dotClassName?: string;
}

interface FluxMultiSelectProps<V extends string | number> {
  label: string;
  options: ReadonlyArray<FluxMultiSelectOption<V>>;
  values: ReadonlySet<V>;
  onChange: (next: ReadonlySet<V>) => void;
  /** Show a search box at the top of the dropdown. */
  searchable?: boolean;
  /** Optional ARIA label / data-testid suffix. Defaults to `label`. */
  testId?: string;
}

export function FluxMultiSelect<V extends string | number>({
  label,
  options,
  values,
  onChange,
  searchable = false,
  testId,
}: FluxMultiSelectProps<V>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, minWidth: 0 });

  const hasValue = values.size > 0;
  const tid = testId ?? label.toLowerCase().replace(/\s+/g, '-');

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const t = searchTerm.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(t));
  }, [options, searchTerm]);

  const open = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: Math.max(rect.width, 220),
      });
    }
    setSearchTerm('');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
  }, []);

  const toggle = useCallback((v: V) => {
    const next = new Set(values);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  }, [values, onChange]);

  const selectAllVisible = useCallback(() => {
    const next = new Set(values);
    filtered.forEach(o => next.add(o.value));
    onChange(next);
  }, [filtered, values, onChange]);

  const clearAll = useCallback(() => {
    onChange(new Set<V>());
  }, [onChange]);

  // Click-outside
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

  // Escape closes; focus search on open
  useEffect(() => {
    if (!isOpen) return;
    if (searchable) searchInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, searchable, close]);

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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={hasValue ? 'text-flux-text-primary' : 'text-flux-text-tertiary'}>
          {label}
        </span>
        {hasValue ? (
          <>
            <span className="bg-blue-500 text-white px-1.5 rounded-full text-[11px] font-semibold min-w-[18px] text-center leading-[16px]">
              {values.size}
            </span>
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Effacer ${label}`}
              className="text-flux-text-tertiary hover:text-flux-text-primary inline-flex items-center"
              onClick={e => { e.stopPropagation(); clearAll(); }}
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
          className="fixed z-50 bg-flux-elevated border border-flux-border-light rounded-md shadow-2xl flex flex-col max-h-[320px]"
          style={{ top: dropdownStyle.top, left: dropdownStyle.left, minWidth: dropdownStyle.minWidth }}
          data-testid={`flux-filter-${tid}-dropdown`}
        >
          {searchable && (
            <div className="p-2 border-b border-flux-border">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher…"
                className="w-full px-2 py-1 text-xs bg-flux-base border border-flux-border-light rounded text-flux-text-primary outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="overflow-y-auto py-1 flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-flux-text-muted text-center">Aucun résultat</div>
            ) : filtered.map(opt => {
              const checked = values.has(opt.value);
              return (
                <label
                  key={String(opt.value)}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-flux-hover text-xs text-flux-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    className="w-3.5 h-3.5 accent-blue-500 cursor-pointer flex-shrink-0"
                  />
                  {opt.dotClassName && (
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dotClassName}`} />
                  )}
                  <span className="flex-1 truncate">{opt.label}</span>
                </label>
              );
            })}
          </div>

          <div className="px-2 py-1.5 border-t border-flux-border flex justify-between gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-[11px] text-flux-text-tertiary hover:text-flux-text-primary px-1 py-0.5 rounded hover:bg-flux-hover"
              disabled={filtered.length === 0}
            >
              Tout sélect.
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-flux-text-tertiary hover:text-flux-text-primary px-1 py-0.5 rounded hover:bg-flux-hover"
              disabled={!hasValue}
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
