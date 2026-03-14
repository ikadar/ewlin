import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { highlightMatch } from '../JcfAutocomplete/highlightMatch';
import { handleOpenDropdownKey } from '../JcfAutocomplete/keyboardUtils';
import { useLazyLoadSuggestions } from '../../hooks/useLazyLoadSuggestions';
import type { Suggestion } from '../JcfAutocomplete';

export interface JcfJobPrecedencesAutocompleteProps {
  /** Current value — comma-separated job references (e.g., "JOB-001,JOB-002") */
  value: string;
  onChange: (value: string) => void;
  /** Available job suggestions with rich labels (e.g., "REF - CLIENT") */
  suggestions: Suggestion[];
  /** HTML id for the input */
  id?: string;
  /** Input CSS class override */
  inputClassName?: string;
  placeholder?: string;
}

/** Extract the text after the last comma (for filtering). */
function getFilterPart(value: string): string {
  if (!value) return '';
  const parts = value.split(',');
  return parts[parts.length - 1].trim();
}

/**
 * Multi-value autocomplete for job prerequisite references.
 *
 * Same comma-separated multi-select pattern as JcfPrecedencesAutocomplete
 * but uses Suggestion[] ({label, value}) for richer dropdown display.
 * Labels show "REFERENCE - CLIENT", stored values are references only.
 */
export function JcfJobPrecedencesAutocomplete({
  value,
  onChange,
  suggestions,
  id,
  inputClassName,
  placeholder,
}: JcfJobPrecedencesAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  const filterPart = getFilterPart(value);

  // Filter suggestions by label match on the text after last comma
  const filtered = useMemo(() => {
    if (!filterPart) return suggestions;
    return suggestions.filter((s) =>
      s.label.toLowerCase().includes(filterPart.toLowerCase()),
    );
  }, [suggestions, filterPart]);

  // Lazy load suggestions
  const { displayedItems, handleScroll, hasMore, resetDisplayCount } =
    useLazyLoadSuggestions({
      items: filtered,
      initialLimit: 10,
      maxLimit: 25,
    });

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
      const item = dropdownRef.current.children[highlightedIndex] as HTMLElement;
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

  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      // Get committed references (before the last comma)
      const parts = value ? value.split(',') : [];
      const hasComma = value.includes(',');
      const committed = hasComma
        ? parts
            .slice(0, -1)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const newValue = [...committed, suggestion.value].join(',');
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

  const handleClosedDropdownKey = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).blur();
        return true;
      }
      return false;
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        handleClosedDropdownKey(e);
        return;
      }

      handleOpenDropdownKey(e, {
        displayedItems,
        highlightedIndex,
        setHighlightedIndex,
        isKeyboardNavRef,
        onSelect: handleSelect,
        onClose: () => setIsOpen(false),
      });
    },
    [isOpen, displayedItems, highlightedIndex, handleSelect, handleClosedDropdownKey],
  );

  const defaultInputClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div ref={containerRef} className="relative">
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
        placeholder={placeholder}
        autoComplete="off"
        data-testid={id ? `jcf-field-${id.replace('jcf-', '')}` : undefined}
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-[3px] bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg z-[30] max-h-[156px] overflow-y-auto"
          onScroll={handleScroll}
          data-testid={id ? `${id}-dropdown` : 'job-precedences-dropdown'}
        >
          {displayedItems.length > 0 ? (
            <>
              {displayedItems.map((suggestion, index) => (
                <button
                  type="button"
                  key={suggestion.value}
                  className={`w-full px-[10px] py-[5px] cursor-pointer font-mono text-sm text-left ${
                    index === highlightedIndex
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-zinc-700 text-zinc-100'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(suggestion);
                  }}
                >
                  {highlightMatch(
                    suggestion.label,
                    filterPart,
                    index === highlightedIndex,
                  )}
                </button>
              ))}
              {hasMore && (
                <div className="px-[10px] py-[5px] text-center text-zinc-500 text-xs border-t border-zinc-700">
                  ↓ Scroll pour plus de suggestions
                </div>
              )}
            </>
          ) : (
            <div className="px-[10px] py-[5px] text-zinc-500 text-sm italic">
              Aucun job disponible
            </div>
          )}
        </div>
      )}
    </div>
  );
}
