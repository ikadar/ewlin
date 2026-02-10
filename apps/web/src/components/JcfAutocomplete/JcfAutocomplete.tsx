import { useState, useRef, useEffect, useCallback } from 'react';
import { highlightMatch } from './highlightMatch';
import { ARROW_DIRECTION_MAP, handleOpenDropdownKey } from './keyboardUtils';
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
  /** Called when input receives focus */
  onFocus?: () => void;
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
  onFocus,
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

  // Reset highlighted index and display count when input changes
  const resetHighlight = useCallback(() => {
    setHighlightedIndex(0);
    resetDisplayCount();
  }, [resetDisplayCount]);

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

  const handleSelect = useCallback((suggestion: Suggestion) => {
    onChange(suggestion.value);
    setIsOpen(false);
    onSelect?.(suggestion.value);
  }, [onChange, onSelect]);

  /**
   * Handle keyboard when dropdown is closed.
   * Extracted to reduce cognitive complexity.
   */
  const handleClosedDropdownKey = useCallback((e: React.KeyboardEvent): boolean => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // Prevent modal from closing
      (e.target as HTMLElement).blur();
      return true;
    }
    return false;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Alt+Arrow — always delegate to table navigation
    if (e.altKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      if (isOpen) setIsOpen(false);
      onArrowNav?.(e, ARROW_DIRECTION_MAP[e.key]);
      return;
    }

    // Tab / Shift+Tab — close dropdown, delegate
    if (e.key === 'Tab') {
      if (isOpen) setIsOpen(false);
      if (onTabOut) {
        e.preventDefault();
        onTabOut(e, e.shiftKey ? 'backward' : 'forward');
      }
      return;
    }

    // Dropdown closed: delegate to helper
    if (!isOpen) {
      handleClosedDropdownKey(e);
      return;
    }

    // Dropdown open: delegate to shared handler
    handleOpenDropdownKey(e, {
      displayedItems,
      highlightedIndex,
      setHighlightedIndex,
      isKeyboardNavRef,
      onSelect: handleSelect,
      onClose: () => setIsOpen(false),
    });
  }, [isOpen, displayedItems, highlightedIndex, handleSelect, onTabOut, onArrowNav, handleClosedDropdownKey]);

  // Default input styling at 13px base
  const defaultInputClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); resetHighlight(); }}
        onFocus={() => { setIsOpen(true); resetHighlight(); onFocus?.(); }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName || defaultInputClass}
        autoComplete="off"
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
            <button
              type="button"
              key={suggestion.value}
              className={`w-full px-[10px] py-[5px] cursor-pointer flex justify-between items-center text-left ${
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
              <span className="font-mono text-sm">
                {highlightMatch(suggestion.label, value, index === highlightedIndex)}
              </span>
              {suggestion.category && (
                <span
                  className={`text-xs px-[5px] rounded-[3px] ${
                    index === highlightedIndex
                      ? 'bg-blue-500 text-blue-100'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {suggestion.category}
                </span>
              )}
            </button>
          ))}
          {hasMore && (
            <div className="px-[10px] py-[5px] text-center text-zinc-500 text-xs border-t border-zinc-700">
              ↓ Scroll pour plus de suggestions
            </div>
          )}
        </div>
      )}
    </div>
  );
}
