import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type FocusKind = 'operator' | 'station';

export interface FocusSelectorItem {
  id: string;
  name: string;
  /** Role (operators) or category name (stations). Shown muted after the name. */
  subtitle?: string;
}

export interface FocusSelectorProps {
  operators: FocusSelectorItem[];
  stations: FocusSelectorItem[];
  currentKind: FocusKind;
  currentId: string;
  onSelect: (kind: FocusKind, id: string) => void;
}

interface Row {
  kind: FocusKind;
  item: FocusSelectorItem;
}

/**
 * FocusSelector — dropdown showing operators and stations in two sections.
 * Keyboard: Escape closes; Arrow up/down navigates; Enter selects.
 * Click outside closes. No search, no avatars, no extra chrome.
 */
export function FocusSelector({
  operators,
  stations,
  currentKind,
  currentId,
  onSelect,
}: FocusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rows: Row[] = [
    ...operators.map((item) => ({ kind: 'operator' as FocusKind, item })),
    ...stations.map((item) => ({ kind: 'station' as FocusKind, item })),
  ];

  const current = (currentKind === 'operator' ? operators : stations).find((x) => x.id === currentId);

  const close = useCallback(() => setIsOpen(false), []);

  const open = useCallback(() => {
    const currentRowIndex = rows.findIndex((r) => r.kind === currentKind && r.item.id === currentId);
    setHighlightIndex(currentRowIndex >= 0 ? currentRowIndex : 0);
    setIsOpen(true);
  }, [rows, currentKind, currentId]);

  const select = useCallback(
    (kind: FocusKind, id: string) => {
      onSelect(kind, id);
      close();
    },
    [onSelect, close],
  );

  // Click outside closes
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, close]);

  // Escape closes (captured on document so it works from the trigger too)
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  // Scroll highlighted into view on keyboard nav
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-row-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  const handleButtonKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) open();
    }
  };

  const handleListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[highlightIndex];
      if (row) select(row.kind, row.item.id);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleButtonKey}
        className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 flex items-center justify-between gap-2 text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-testid="focus-selector-trigger"
      >
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium text-zinc-300 truncate">{current?.name ?? '—'}</span>
          {current?.subtitle && (
            <span className="text-xs text-zinc-500 truncate">{current.subtitle}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded shadow-lg z-50 max-h-[60vh] overflow-y-auto focus:outline-none"
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKey}
          data-testid="focus-selector-dropdown"
        >
          {operators.length > 0 && (
            <div
              className="sticky top-0 bg-zinc-900 px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-500 font-semibold border-b border-zinc-800"
            >
              Opérateurs
            </div>
          )}
          {operators.map((op, idx) => {
            const rowIndex = idx;
            const isActive = currentKind === 'operator' && currentId === op.id;
            const isHighlighted = rowIndex === highlightIndex;
            return (
              <button
                type="button"
                key={`op-${op.id}`}
                data-row-index={rowIndex}
                onMouseEnter={() => setHighlightIndex(rowIndex)}
                onClick={() => select('operator', op.id)}
                className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left ${
                  isHighlighted ? 'bg-zinc-800' : ''
                } ${isActive ? 'text-blue-400' : 'text-zinc-100'}`}
                data-testid={`focus-selector-operator-${op.id}`}
              >
                <span className="font-medium text-zinc-300 truncate">{op.name}</span>
                {op.subtitle && <span className="text-xs text-zinc-500 truncate">{op.subtitle}</span>}
              </button>
            );
          })}

          {stations.length > 0 && (
            <div
              className="sticky top-0 bg-zinc-900 px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-500 font-semibold border-b border-zinc-800"
            >
              Stations
            </div>
          )}
          {stations.map((st, idx) => {
            const rowIndex = operators.length + idx;
            const isActive = currentKind === 'station' && currentId === st.id;
            const isHighlighted = rowIndex === highlightIndex;
            return (
              <button
                type="button"
                key={`st-${st.id}`}
                data-row-index={rowIndex}
                onMouseEnter={() => setHighlightIndex(rowIndex)}
                onClick={() => select('station', st.id)}
                className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left ${
                  isHighlighted ? 'bg-zinc-800' : ''
                } ${isActive ? 'text-blue-400' : 'text-zinc-100'}`}
                data-testid={`focus-selector-station-${st.id}`}
              >
                <span className="font-medium text-zinc-300 truncate">{st.name}</span>
                {st.subtitle && <span className="text-xs text-zinc-500 truncate">{st.subtitle}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
