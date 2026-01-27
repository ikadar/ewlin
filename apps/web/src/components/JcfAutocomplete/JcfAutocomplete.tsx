import { useState, useRef, useEffect } from 'react';
import { highlightMatch } from './highlightMatch';
import { useLazyLoadSuggestions } from '../../hooks/useLazyLoadSuggestions';

export interface Suggestion {
  label: string;
  value: string;
  category?: string;
}

export interface JcfAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: Suggestion[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  onSelect?: (value: string) => void;
  onBlur?: () => void;
  /** Table navigation delegation: called on Tab/Shift+Tab when dropdown is closed */
  onTabOut?: (e: React.KeyboardEvent, direction: 'forward' | 'backward') => void;
  /** Table navigation delegation: called on Alt+Arrow */
  onArrowNav?: (e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Generic JCF autocomplete component — reusable for Client, Template,
 * and future JCF autocomplete fields.
 *
 * Features: keyboard navigation (↑↓ Enter Esc Tab), text highlighting,
 * category badges, lazy-loaded suggestions, click-outside close.
 *
 * All rem-based Tailwind classes converted to px at 13px base.
 */
export function JcfAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  inputClassName,
  id,
  onSelect,
  onBlur,
  onTabOut,
  onArrowNav,
}: JcfAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  // Filter suggestions: case-insensitive substring match on label
  const filtered = suggestions.filter((s) =>
    s.label.toLowerCase().includes(value.toLowerCase())
  );

  // Lazy load suggestions (initial 10, scroll to load more, max 25)
  const { displayedItems, handleScroll, hasMore, resetDisplayCount } =
    useLazyLoadSuggestions({
      items: filtered,
      initialLimit: 10,
      maxLimit: 25,
    });

  // Reset highlighted index and display count when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
    resetDisplayCount();
  }, [value, resetDisplayCount]);

  // Auto-scroll highlighted item into view (keyboard nav only)
  useEffect(() => {
    if (isKeyboardNavRef.current && isOpen && highlightedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
      isKeyboardNavRef.current = false;
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Alt+Arrow — always delegate to table navigation (open or closed)
    if (e.altKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (isOpen) setIsOpen(false);
      const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      onArrowNav?.(e, directionMap[e.key]);
      return;
    }

    // Tab / Shift+Tab — close dropdown, delegate if onTabOut provided
    if (e.key === 'Tab') {
      if (isOpen) setIsOpen(false);
      if (onTabOut) {
        e.preventDefault();
        onTabOut(e, e.shiftKey ? 'backward' : 'forward');
      }
      return;
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        isKeyboardNavRef.current = true;
        setHighlightedIndex((prev) =>
          prev < displayedItems.length - 1 ? prev + 1 : prev
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
          onChange(displayedItems[highlightedIndex].value);
          setIsOpen(false);
          onSelect?.(displayedItems[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // Prevent modal close
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.value);
    setIsOpen(false);
    onSelect?.(suggestion.value);
  };

  // Default input styling at 13px base
  const defaultInputClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName || defaultInputClass}
        data-testid={id ? `jcf-field-${id.replace('jcf-', '')}` : undefined}
      />

      {isOpen && displayedItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-[3px] bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg z-[30] max-h-[156px] overflow-y-auto"
          onScroll={handleScroll}
          data-testid={id ? `${id}-dropdown` : 'autocomplete-dropdown'}
        >
          {displayedItems.map((suggestion, index) => (
            <div
              key={suggestion.value}
              className={`px-[10px] py-[5px] cursor-pointer flex justify-between items-center ${
                index === highlightedIndex
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-zinc-700 text-zinc-100'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                handleSelect(suggestion);
              }}
            >
              <span className="font-mono text-[11px]">
                {highlightMatch(suggestion.label, value, index === highlightedIndex)}
              </span>
              {suggestion.category && (
                <span
                  className={`text-[10px] px-[5px] rounded-[3px] ${
                    index === highlightedIndex
                      ? 'bg-blue-500 text-blue-100'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {suggestion.category}
                </span>
              )}
            </div>
          ))}
          {hasMore && (
            <div className="px-[10px] py-[5px] text-center text-zinc-500 text-[10px] border-t border-zinc-700">
              ↓ Scroll pour plus de suggestions
            </div>
          )}
        </div>
      )}
    </div>
  );
}
