import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { highlightMatch } from '../JcfAutocomplete/highlightMatch';
import { useLazyLoadSuggestions } from '../../hooks/useLazyLoadSuggestions';

export interface JcfPrecedencesAutocompleteProps {
  /** Current value — comma-separated element names (e.g., "INT,COUV") */
  value: string;
  /** Store value */
  onChange: (value: string) => void;
  /** All element names in the current table */
  elementNames: string[];
  /** Current element's name — excluded from suggestions (self-reference prevention) */
  currentElementName: string;
  /** HTML id for the input (cell ID for navigation) */
  id?: string;
  /** Additional CSS class */
  className?: string;
  /** Input CSS class override */
  inputClassName?: string;
  /** Table navigation delegation: Tab/Shift+Tab */
  onTabOut?: (
    e: React.KeyboardEvent,
    direction: 'forward' | 'backward',
  ) => void;
  /** Table navigation delegation: Alt+Arrow */
  onArrowNav?: (
    e: React.KeyboardEvent,
    direction: 'up' | 'down' | 'left' | 'right',
  ) => void;
}

/** Extract the text after the last comma (for filtering). */
function getFilterPart(value: string): string {
  if (!value) return '';
  const parts = value.split(',');
  return parts[parts.length - 1].trim();
}

/** Extract the committed (selected) element names from the comma list. */
function getSelectedElements(value: string): string[] {
  if (!value || value === '-') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Precedences autocomplete for the JCF Elements Table.
 *
 * Suggests other element names as predecessors. Supports multi-value
 * comma-separated input (e.g., "INT,COUV"). Excludes the current element
 * (self-reference prevention) and already-selected predecessors.
 *
 * No DSL/pretty conversion — values are plain comma-separated strings.
 * No session learning — suggestions come from the current elements list.
 */
export function JcfPrecedencesAutocomplete({
  value,
  onChange,
  elementNames,
  currentElementName,
  id,
  className,
  inputClassName,
  onTabOut,
  onArrowNav,
}: JcfPrecedencesAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  // Filter suggestions: exclude self and already-selected
  const filtered = useMemo(() => {
    const selected = getSelectedElements(value);
    const filterPart = getFilterPart(value);

    return elementNames.filter((name) => {
      if (name === currentElementName) return false;
      if (selected.includes(name)) return false;
      if (!filterPart) return true;
      return name.toLowerCase().includes(filterPart.toLowerCase());
    });
  }, [value, elementNames, currentElementName]);

  // Lazy load suggestions
  const { displayedItems, handleScroll, hasMore, resetDisplayCount } =
    useLazyLoadSuggestions({
      items: filtered,
      initialLimit: 10,
      maxLimit: 25,
    });

  // Reset highlight when input changes
  const resetHighlight = useCallback(() => {
    setHighlightedIndex(0);
    resetDisplayCount();
  }, [resetDisplayCount]);

  // Auto-scroll highlighted item into view (keyboard nav only)
  useEffect(() => {
    if (
      isKeyboardNavRef.current &&
      isOpen &&
      highlightedIndex >= 0 &&
      dropdownRef.current
    ) {
      const item = dropdownRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
      isKeyboardNavRef.current = false;
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filterText = getFilterPart(value);

  const handleSelect = useCallback(
    (selectedName: string) => {
      // Get committed elements (before the last comma)
      const parts = value ? value.split(',') : [];
      const hasComma = value.includes(',');
      const committed = hasComma
        ? parts
            .slice(0, -1)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const newValue = [...committed, selectedName].join(',');
      onChange(newValue);
      setIsOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      resetHighlight();
      if (!isOpen) setIsOpen(true);
    },
    [onChange, isOpen, resetHighlight],
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    resetHighlight();
  }, [resetHighlight]);

  const handleBlur = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Alt+Arrow — always delegate to table navigation
      if (e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        if (isOpen) setIsOpen(false);
        const directionMap: Record<
          string,
          'up' | 'down' | 'left' | 'right'
        > = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        onArrowNav?.(e, directionMap[e.key]);
        return;
      }

      // Tab / Shift+Tab — close dropdown, delegate to table
      // Note: onTabOut is responsible for calling e.preventDefault() if it handles navigation.
      // This allows native Tab to exit the table at boundaries.
      if (e.key === 'Tab') {
        if (isOpen) setIsOpen(false);
        if (onTabOut) {
          onTabOut(e, e.shiftKey ? 'backward' : 'forward');
        }
        return;
      }

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          setIsOpen(true);
          e.preventDefault();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          isKeyboardNavRef.current = true;
          setHighlightedIndex((prev) =>
            prev < displayedItems.length - 1 ? prev + 1 : prev,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          isKeyboardNavRef.current = true;
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayedItems[highlightedIndex]) {
            handleSelect(displayedItems[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation(); // Prevent modal close
          setIsOpen(false);
          break;
      }
    },
    [
      isOpen,
      displayedItems,
      highlightedIndex,
      handleSelect,
      onTabOut,
      onArrowNav,
    ],
  );

  // Default input styling at 13px base
  const defaultInputClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName ?? defaultInputClass}
        placeholder="ex: INT,COUV"
        data-testid={id ? `jcf-field-${id.replace('jcf-', '')}` : undefined}
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-[3px] bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg z-[30] max-h-[156px] overflow-y-auto"
          onScroll={handleScroll}
          data-testid={id ? `${id}-dropdown` : 'precedences-dropdown'}
        >
          {displayedItems.length > 0 ? (
            <>
              {displayedItems.map((name, index) => (
                <div
                  key={`${index}-${name}`}
                  className={`px-[10px] py-[5px] cursor-pointer font-mono text-[11px] ${
                    index === highlightedIndex
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-zinc-700 text-zinc-100'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleSelect(name);
                  }}
                >
                  {highlightMatch(
                    name,
                    filterText,
                    index === highlightedIndex,
                  )}
                </div>
              ))}
              {hasMore && (
                <div className="px-[10px] py-[5px] text-center text-zinc-500 text-[10px] border-t border-zinc-700">
                  ↓ Scroll pour plus de suggestions
                </div>
              )}
            </>
          ) : (
            <div className="px-[10px] py-[5px] text-zinc-500 text-[11px] italic">
              Aucun élément disponible
            </div>
          )}
        </div>
      )}
    </div>
  );
}
