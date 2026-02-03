import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { FeuilleFormat } from '@flux/types';
import { highlightMatch } from '../JcfAutocomplete/highlightMatch';
import { ARROW_DIRECTION_MAP, handleOpenDropdownKey } from '../JcfAutocomplete/keyboardUtils';
import { useLazyLoadSuggestions } from '../../hooks/useLazyLoadSuggestions';
import { mergeWithSession } from '../../utils/mergeWithSession';
import {
  toPrettyImposition,
  toDslImposition,
  isValidImposition,
  parseImposition,
  parseImpositionInput,
} from './impositionDsl';

interface ImpositionSuggestion {
  label: string;
  value: string;
}

export interface JcfImpositionAutocompleteProps {
  /** Stored DSL value (e.g., "50x70(8)") */
  value: string;
  /** Store DSL value */
  onChange: (value: string) => void;
  /** Available sheet formats from reference data */
  feuilleFormats: FeuilleFormat[];
  /** Session-learned sheet formats */
  sessionFormats?: FeuilleFormat[];
  /** Callback to learn a new or extended format */
  onLearnFormat?: (format: FeuilleFormat) => void;
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

/**
 * Two-step Imposition autocomplete for the JCF Elements Table.
 *
 * Step 1: Sheet format suggestions (e.g., "50x70", "65x90")
 * Step 2: Poses suggestions for the selected format (e.g., "1", "2", "4", "8")
 *
 * DSL format: "LxH(poses)" (e.g., "50x70(8)")
 * Pretty display: "LxHcm Nposes/f" (e.g., "50x70cm 8poses/f")
 *
 * Standalone component (not wrapping JcfAutocomplete) because the two-step
 * filtering logic is incompatible with JcfAutocomplete's single-value filter.
 * Reuses shared utilities: useLazyLoadSuggestions, highlightMatch, mergeWithSession.
 *
 * @see implicit-logic-specification.md §1.2 (Imposition format)
 */
export function JcfImpositionAutocomplete({
  value,
  onChange,
  feuilleFormats,
  sessionFormats = [],
  onLearnFormat,
  id,
  className,
  inputClassName,
  onTabOut,
  onArrowNav,
}: JcfImpositionAutocompleteProps) {
  const [editingValue, setEditingValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);
  const isSelectingRef = useRef(false);

  // Merge base formats with session-learned ones
  const allFormats = useMemo(
    () =>
      mergeWithSession(feuilleFormats, sessionFormats, (f) =>
        f.format.toLowerCase(),
      ),
    [feuilleFormats, sessionFormats],
  );

  // Parse current editing input
  const { format, poses, isTypingPoses } = parseImpositionInput(editingValue);

  // Build suggestions based on current input state
  const suggestions: ImpositionSuggestion[] = useMemo(() => {
    if (isTypingPoses) {
      // Step 2: poses suggestions for matched format
      const matched = allFormats.find(
        (f) => f.format.toLowerCase() === format.toLowerCase(),
      );
      if (!matched) return [];

      return matched.poses
        .filter((p) => String(p).includes(poses))
        .map((p) => ({
          label: `${p})`,
          value: `${matched.format}(${p})`,
        }));
    }

    // Step 1: format suggestions
    return allFormats
      .filter((f) => f.format.toLowerCase().includes(format.toLowerCase()))
      .map((f) => ({
        label: f.format,
        value: f.format + '(',
      }));
  }, [allFormats, format, poses, isTypingPoses]);

  // Lazy load suggestions
  const { displayedItems, handleScroll, hasMore, resetDisplayCount } =
    useLazyLoadSuggestions({
      items: suggestions,
      initialLimit: 10,
      maxLimit: 25,
    });

  // Reset highlight and display count when input changes
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
      if (isSelectingRef.current) return;
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

  // Display value: pretty when unfocused, DSL when focused
  const displayValue = isFocused ? editingValue : toPrettyImposition(value);

  // The text to highlight in suggestions
  const filterText = isTypingPoses ? poses : format;

  // Session learning on blur
  const learnIfNew = useCallback(
    (dslValue: string) => {
      if (!onLearnFormat || !isValidImposition(dslValue)) return;

      const parsed = parseImposition(dslValue);
      if (!parsed) return;

      const formatStr = `${parsed.width}x${parsed.height}`;

      const existingBase = feuilleFormats.find(
        (f) => f.format.toLowerCase() === formatStr.toLowerCase(),
      );
      const existingSession = sessionFormats.find(
        (f) => f.format.toLowerCase() === formatStr.toLowerCase(),
      );

      if (existingBase || existingSession) {
        // Check if poses is new for this format
        const existing = existingSession ?? existingBase!;
        if (!existing.poses.includes(parsed.poses)) {
          onLearnFormat({
            ...existing,
            poses: [...existing.poses, parsed.poses],
          });
        }
      } else {
        // Entirely new format
        onLearnFormat({
          format: formatStr.toLowerCase(),
          poses: [parsed.poses],
        });
      }
    },
    [onLearnFormat, feuilleFormats, sessionFormats],
  );

  const handleFocus = useCallback(() => {
    if (!isFocused) {
      setEditingValue(toDslImposition(value));
      resetHighlight();
    }
    setIsFocused(true);
    setIsOpen(true);
  }, [isFocused, value, resetHighlight]);

  const handleBlur = useCallback(() => {
    if (isSelectingRef.current) return;
    setIsFocused(false);
    learnIfNew(editingValue);
    onChange(editingValue);
    setIsOpen(false);
  }, [editingValue, learnIfNew, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingValue(e.target.value);
      resetHighlight();
      if (!isOpen) setIsOpen(true);
    },
    [isOpen, resetHighlight],
  );

  const handleSelect = useCallback(
    (suggestion: ImpositionSuggestion) => {
      isSelectingRef.current = true;
      setEditingValue(suggestion.value);
      resetHighlight();
      // Format selection (ends with '('): keep open for poses step
      if (suggestion.value.endsWith('(')) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
      inputRef.current?.focus();
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 0);
    },
    [resetHighlight],
  );

  /** Handle keyboard when dropdown is closed. */
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Alt+Arrow — always delegate to table navigation
      if (e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        if (isOpen) setIsOpen(false);
        onArrowNav?.(e, ARROW_DIRECTION_MAP[e.key]);
        return;
      }

      // Tab / Shift+Tab — close dropdown, delegate to table
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
    },
    [isOpen, displayedItems, highlightedIndex, handleSelect, onTabOut, onArrowNav, handleClosedDropdownKey],
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
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName ?? defaultInputClass}
        placeholder="ex: 65x90(16)"
        data-testid={id ? `jcf-field-${id.replace('jcf-', '')}` : undefined}
      />

      {isOpen && displayedItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-[3px] bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg z-[30] max-h-[156px] overflow-y-auto"
          onScroll={handleScroll}
          data-testid={id ? `${id}-dropdown` : 'imposition-dropdown'}
        >
          {displayedItems.map((suggestion, index) => (
            <button
              type="button"
              key={`${index}-${suggestion.value}`}
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
                {highlightMatch(
                  suggestion.label,
                  filterText,
                  index === highlightedIndex,
                )}
              </span>
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
