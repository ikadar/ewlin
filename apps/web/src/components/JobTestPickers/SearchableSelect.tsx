/**
 * SearchableSelect — button trigger + portal popover with optional search.
 *
 * Mirrors the visual + keyboard contract of {@link JcfPrioritySelect}
 * (button styled like an input + ChevronDown + portal dropdown + ↑↓ Enter
 * Esc nav + click-outside close), but exposes a `searchable` prop and
 * supports rich option labels (`sublabel`) for entity pickers.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  /** Optional renderer for the trigger label area. Receives the resolved option. */
  renderTrigger?: (opt: SearchableOption | null) => React.ReactNode;
}

export const SearchableSelect = memo(function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner…',
  searchable = false,
  disabled = false,
  ariaLabel,
  renderTrigger,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filterText, setFilterText] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0, minWidth: 0 });

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!searchable || !filterText.trim()) return options;
    const q = filterText.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [options, searchable, filterText]);

  const open = useCallback(() => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPopoverStyle({
        top: rect.bottom + 2,
        left: rect.left,
        minWidth: Math.max(rect.width, 220),
      });
    }
    setActiveIndex(options.findIndex((o) => o.value === value));
    setFilterText('');
    setIsOpen(true);
  }, [disabled, options, value]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
      setIsOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  // Click-outside close
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, close]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const opt = filtered[activeIndex];
        if (opt) handleSelect(opt.value);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, activeIndex, handleSelect, close]);

  // Auto-focus search input when popover opens
  useLayoutEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const list = dropdownRef.current?.querySelector('[data-options-list]') as HTMLElement | null;
    const item = list?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, activeIndex]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={isOpen ? close : open}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`w-full px-3 py-2 bg-flux-base border border-flux-border-light rounded text-flux-text-primary text-left flex items-center justify-between gap-2 hover:border-flux-text-tertiary focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${isOpen ? 'border-blue-500' : ''}`}
      >
        <span className="flex-1 min-w-0 truncate">
          {renderTrigger ? renderTrigger(selected) : (selected?.label ?? <span className="text-flux-text-muted">{placeholder}</span>)}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-flux-text-tertiary shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            data-portal-popover
            className="fixed z-[200] bg-flux-elevated border border-flux-border-light rounded shadow-2xl py-1 max-h-72 overflow-hidden flex flex-col"
            style={{
              top: popoverStyle.top,
              left: popoverStyle.left,
              minWidth: popoverStyle.minWidth,
            }}
          >
            {searchable && (
              <div className="px-2 py-1.5 border-b border-flux-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-flux-text-tertiary" strokeWidth={2} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={filterText}
                    onChange={(e) => {
                      setFilterText(e.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Rechercher…"
                    className="w-full pl-7 pr-2 py-1 bg-flux-base border border-flux-border rounded text-sm text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-flux-text-muted text-sm italic">Aucun résultat</div>
            ) : (
              <div data-options-list className="overflow-y-auto">
                {filtered.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full text-left px-3 py-1.5 flex flex-col gap-0.5 ${
                        isActive ? 'bg-flux-hover' : ''
                      } ${isSelected ? 'text-blue-400' : 'text-flux-text-primary'}`}
                    >
                      <span className="text-sm leading-tight">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-xs font-mono text-flux-text-tertiary">{opt.sublabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
});
