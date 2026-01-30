import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { PaperType } from '@flux/types';
import { highlightMatch } from '../JcfAutocomplete/highlightMatch';
import { useLazyLoadSuggestions } from '../../hooks/useLazyLoadSuggestions';
import { mergeWithSession } from '../../utils/mergeWithSession';
import {
  toPrettyPapier,
  toDslPapier,
  isValidPapier,
  parsePapierInput,
} from './papierDsl';

interface PapierSuggestion {
  label: string;
  value: string;
}

export interface JcfPapierAutocompleteProps {
  /** Stored DSL value (e.g., "Couché mat:135") */
  value: string;
  /** Store DSL value */
  onChange: (value: string) => void;
  /** Available paper types from reference data */
  paperTypes: PaperType[];
  /** Session-learned paper types */
  sessionPaperTypes?: PaperType[];
  /** Callback to learn a new or extended paper type */
  onLearnPaperType?: (paperType: PaperType) => void;
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
 * Two-step Papier autocomplete for the JCF Elements Table.
 *
 * Step 1: Type suggestions (e.g., "Couché mat", "Offset")
 * Step 2: Grammage suggestions for the selected type (e.g., "70", "80", "135")
 *
 * DSL format: "Type:Grammage" (e.g., "Couché mat:135")
 * Pretty display: "Type Grammageg" (e.g., "Couché mat 135g")
 *
 * Standalone component (not wrapping JcfAutocomplete) because the two-step
 * filtering logic is incompatible with JcfAutocomplete's single-value filter.
 * Reuses shared utilities: useLazyLoadSuggestions, highlightMatch, mergeWithSession.
 *
 * @see implicit-logic-specification.md §1.1 (Papier Format)
 */
export function JcfPapierAutocomplete({
  value,
  onChange,
  paperTypes,
  sessionPaperTypes = [],
  onLearnPaperType,
  id,
  className,
  inputClassName,
  onTabOut,
  onArrowNav,
}: JcfPapierAutocompleteProps) {
  const [editingValue, setEditingValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);
  const isSelectingRef = useRef(false);

  // Merge base paper types with session-learned ones
  const allPaperTypes = useMemo(
    () =>
      mergeWithSession(paperTypes, sessionPaperTypes, (p) =>
        p.type.toLowerCase(),
      ),
    [paperTypes, sessionPaperTypes],
  );

  // Parse current editing input
  const { type, grammage, isTypingGrammage } = parsePapierInput(editingValue);

  // Build suggestions based on current input state
  const suggestions: PapierSuggestion[] = useMemo(() => {
    if (isTypingGrammage) {
      // Step 2: grammage suggestions for matched type
      const matched = allPaperTypes.find(
        (p) => p.type.toLowerCase() === type.toLowerCase(),
      );
      if (!matched) return [];

      const grammageFilter = grammage.replace(/g$/i, '');
      return matched.grammages
        .filter((g) => String(g).includes(grammageFilter))
        .map((g) => ({
          label: `${g}g`,
          value: `${matched.type}:${g}`,
        }));
    }

    // Step 1: type suggestions
    return allPaperTypes
      .filter((p) => p.type.toLowerCase().includes(type.toLowerCase()))
      .map((p) => ({
        label: p.type,
        value: p.type + ':',
      }));
  }, [allPaperTypes, type, grammage, isTypingGrammage]);

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
  const displayValue = isFocused ? editingValue : toPrettyPapier(value);

  // The text to highlight in suggestions
  const filterText = isTypingGrammage ? grammage : type;

  // Session learning on blur
  const learnIfNew = useCallback(
    (dslValue: string) => {
      if (!onLearnPaperType || !isValidPapier(dslValue)) return;

      const parsed = parsePapierInput(dslValue);
      if (!parsed.isTypingGrammage || !parsed.grammage) return;

      const grammageNum = parseInt(parsed.grammage, 10);
      if (isNaN(grammageNum)) return;

      const existingBase = paperTypes.find(
        (p) => p.type.toLowerCase() === parsed.type.toLowerCase(),
      );
      const existingSession = sessionPaperTypes.find(
        (p) => p.type.toLowerCase() === parsed.type.toLowerCase(),
      );

      if (existingBase || existingSession) {
        // Check if grammage is new for this type
        const existing = existingSession ?? existingBase!;
        if (!existing.grammages.includes(grammageNum)) {
          onLearnPaperType({
            ...existing,
            grammages: [...existing.grammages, grammageNum],
          });
        }
      } else {
        // Entirely new paper type
        onLearnPaperType({
          id: `session-${parsed.type.toLowerCase()}`,
          type: parsed.type,
          grammages: [grammageNum],
        });
      }
    },
    [onLearnPaperType, paperTypes, sessionPaperTypes],
  );

  const handleFocus = useCallback(() => {
    if (!isFocused) {
      setEditingValue(toDslPapier(value));
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
    (suggestion: PapierSuggestion) => {
      isSelectingRef.current = true;
      setEditingValue(suggestion.value);
      resetHighlight();
      // Type selection (ends with ':'): keep open for grammage step
      if (suggestion.value.endsWith(':')) {
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
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName ?? defaultInputClass}
        placeholder="Papier et grammage"
        data-testid={id ? `jcf-field-${id.replace('jcf-', '')}` : undefined}
      />

      {isOpen && displayedItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-[3px] bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg z-[30] max-h-[156px] overflow-y-auto"
          onScroll={handleScroll}
          data-testid={id ? `${id}-dropdown` : 'papier-dropdown'}
        >
          {displayedItems.map((suggestion, index) => (
            <div
              key={`${index}-${suggestion.value}`}
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
              <span className="font-mono text-sm">
                {highlightMatch(
                  suggestion.label,
                  filterText,
                  index === highlightedIndex,
                )}
              </span>
            </div>
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
