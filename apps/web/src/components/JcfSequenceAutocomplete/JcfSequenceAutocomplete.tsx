import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { highlightMatch } from '../JcfAutocomplete/highlightMatch';
import { ARROW_DIRECTION_MAP } from '../JcfAutocomplete/keyboardUtils';
import { useLazyLoadSuggestions } from '../../hooks/useLazyLoadSuggestions';
import {
  parseLine,
  getCurrentLineInfo,
  getWorkflowStepIndex,
  getExpectedCategories,
  DEFAULT_ST_DURATIONS,
} from './sequenceDsl';
import type { PostePreset, SoustraitantPreset } from '@flux/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  value: string;
  description?: string;
}

export interface JcfSequenceAutocompleteProps {
  /** Current value — multi-line sequence text */
  value: string;
  /** Store value */
  onChange: (value: string) => void;
  /** Poste presets from reference data */
  postePresets: PostePreset[];
  /** Session-learned postes */
  sessionPostes?: PostePreset[];
  /** Callback to learn a new poste */
  onLearnPoste?: (poste: PostePreset) => void;
  /** Sous-traitant presets from reference data */
  soustraitantPresets?: SoustraitantPreset[];
  /** Session-learned sous-traitants */
  sessionSoustraitants?: SoustraitantPreset[];
  /** Callback to learn a new sous-traitant */
  onLearnSoustraitant?: (st: SoustraitantPreset) => void;
  /**
   * Workflow-guided suggestion ordering.
   * Array of expected production step categories in order.
   * Each entry can be comma-separated for multi-category support.
   * @example ['Presse offset, Presse numérique', 'Massicot', 'Conditionnement']
   */
  sequenceWorkflow?: string[];
  /** HTML id for the textarea */
  id?: string;
  /** Additional CSS class */
  className?: string;
  /** Textarea CSS class override */
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
  /** Callback when field loses focus (for touched state tracking) */
  onBlur?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function JcfSequenceAutocomplete({
  value,
  onChange,
  postePresets,
  sessionPostes = [],
  onLearnPoste,
  soustraitantPresets = [],
  sessionSoustraitants = [],
  onLearnSoustraitant,
  sequenceWorkflow = [],
  id,
  className,
  inputClassName,
  onTabOut,
  onArrowNav,
  onBlur: onBlurProp,
}: JcfSequenceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  // Merge presets with session-learned postes (dedup by name)
  const allPostes = useMemo(() => {
    const combined = [...sessionPostes, ...postePresets];
    const seen = new Set<string>();
    return combined.filter((p) => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [postePresets, sessionPostes]);

  // Merge presets with session-learned sous-traitants (dedup by name)
  const allSoustraitants = useMemo(() => {
    const combined = [...sessionSoustraitants, ...soustraitantPresets];
    const seen = new Set<string>();
    return combined.filter((s) => {
      const key = s.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [soustraitantPresets, sessionSoustraitants]);

  // ── Cursor position calculation ────────────────────────────────────────

  const calculateDropdownPosition = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;

    const textareaRect = textarea.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);

    // Copy textarea styles to mirror
    const stylesToCopy = [
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'letter-spacing',
      'line-height',
      'text-transform',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
      'box-sizing',
      'width',
    ];

    stylesToCopy.forEach((style) => {
      mirror.style.setProperty(style, computed.getPropertyValue(style));
    });
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '0';

    const textBeforeCursor = value.substring(0, cursorPosition);
    mirror.innerHTML = '';
    const textNode = document.createTextNode(textBeforeCursor);
    const marker = document.createElement('span');
    marker.textContent = '|';
    mirror.appendChild(textNode);
    mirror.appendChild(marker);

    const markerRect = marker.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    const relativeTop =
      markerRect.top - mirrorRect.top - textarea.scrollTop;
    const relativeLeft = markerRect.left - mirrorRect.left;
    const lineHeight = parseInt(computed.lineHeight) || 20;

    setDropdownPos({
      top: textareaRect.top + relativeTop + lineHeight,
      left: textareaRect.left + Math.max(0, relativeLeft),
    });
  }, [value, cursorPosition]);

  // Update dropdown position when open
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
    }
  }, [isOpen, cursorPosition, value, calculateDropdownPosition]);

  // ── Suggestions ────────────────────────────────────────────────────────

  const { filtered, searchText } = useMemo(() => {
    const { partialLine, lineText } = getCurrentLineInfo(
      value,
      cursorPosition,
    );
    const parsed = parseLine(partialLine);
    const suggestions: Suggestion[] = [];

    // No suggestions for complete lines, st-description (free text), or already done
    if (parsed.step === 'complete' || parsed.step === 'st-description') {
      return { filtered: [], searchText: '' };
    }

    // Also skip if the full line is already complete (cursor in middle of complete line)
    if (lineText.includes('(') && lineText.includes(')')) {
      return { filtered: [], searchText: '' };
    }

    switch (parsed.step) {
      case 'poste': {
        // Get current workflow step for priority sorting
        const stepIndex = getWorkflowStepIndex(value, cursorPosition);
        const expectedCategories = getExpectedCategories(
          sequenceWorkflow,
          stepIndex,
        );

        // Filter postes matching search
        const matching = allPostes.filter((p) =>
          p.name.toLowerCase().includes(parsed.search.toLowerCase()),
        );

        // Sort: prioritize postes matching expected category (stable sort)
        const sorted = [...matching].sort((a, b) => {
          const aMatches = expectedCategories.includes(a.category);
          const bMatches = expectedCategories.includes(b.category);
          if (aMatches && !bMatches) return -1;
          if (!aMatches && bMatches) return 1;
          return 0;
        });

        // Add sorted postes to suggestions with star marker for priority
        sorted.forEach((p) => {
          const isPriority = expectedCategories.includes(p.category);
          suggestions.push({
            label: p.name,
            value: `${p.name}(`,
            description: isPriority ? `★ ${p.category}` : p.category,
          });
        });

        // Add "ST:" option if search could match
        if (
          'st:'.includes(parsed.search.toLowerCase()) ||
          parsed.search === ''
        ) {
          suggestions.push({
            label: 'ST:',
            value: 'ST:',
            description: 'Sous-traitant',
          });
        }
        break;
      }

      case 'st-prefix': {
        suggestions.push({
          label: 'ST:',
          value: 'ST:',
          description: 'Sous-traitant',
        });
        break;
      }

      case 'st-name': {
        // Show filtered sous-traitant names
        const matchingSt = allSoustraitants.filter((s) =>
          s.name.toLowerCase().includes(parsed.search.toLowerCase()),
        );
        matchingSt.forEach((s) => {
          suggestions.push({
            label: s.name,
            value: `ST:${s.name}(`,
            description: 'Sous-traitant',
          });
        });
        break;
      }

      case 'st-duration': {
        // Show ST duration suggestions (day-based: 1j, 2j, etc.)
        DEFAULT_ST_DURATIONS.filter((d) =>
          d.includes(parsed.search),
        ).forEach((d) => {
          suggestions.push({
            label: `${d})`,
            value: `${parsed.prefix}${d}):`,
            description: 'Durée ST',
          });
        });
        break;
      }
    }

    return { filtered: suggestions, searchText: parsed.search };
  }, [value, cursorPosition, allPostes, allSoustraitants, sequenceWorkflow]);

  // Lazy load suggestions
  const { displayedItems, handleScroll, hasMore, resetDisplayCount } =
    useLazyLoadSuggestions({
      items: filtered,
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

  // ── Selection handling ─────────────────────────────────────────────────

  /**
   * Learn poste or soustraitant when a suggestion is selected.
   * Extracted to reduce cognitive complexity.
   */
  const learnFromSelection = useCallback(
    (suggestionValue: string) => {
      if (!suggestionValue.includes(')')) return;

      // Check for ST: pattern first
      const stMatch = suggestionValue.match(/^ST:([A-Za-z0-9_]+)\(/i);
      if (stMatch && onLearnSoustraitant) {
        onLearnSoustraitant({ name: stMatch[1] });
        return;
      }

      // Check for poste pattern
      if (!onLearnPoste) return;
      const posteMatch = suggestionValue.match(/^([A-Za-z0-9_]+)\(/);
      if (!posteMatch) return;

      const posteName = posteMatch[1];
      const existing = allPostes.find(
        (p) => p.name.toLowerCase() === posteName.toLowerCase(),
      );
      if (existing) {
        onLearnPoste(existing);
      }
    },
    [onLearnPoste, onLearnSoustraitant, allPostes],
  );

  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const { lineStart, lineEnd } = getCurrentLineInfo(value, cursorPosition);
      const beforeLine = value.substring(0, lineStart);
      const afterLine = value.substring(lineEnd);

      const newValue = beforeLine + suggestion.value + afterLine;
      onChange(newValue);

      // Position cursor at end of inserted value
      const newCursorPos = lineStart + suggestion.value.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }
      }, 0);

      // Keep dropdown open if more input expected
      const needsMoreInput = suggestion.value.endsWith('(') || suggestion.value === 'ST:';
      if (needsMoreInput) {
        setIsOpen(true);
        resetHighlight();
      } else {
        setIsOpen(false);
        learnFromSelection(suggestion.value);
      }
    },
    [value, cursorPosition, onChange, learnFromSelection, resetHighlight],
  );

  // ── Event handlers ─────────────────────────────────────────────────────

  const handleCursorUpdate = useCallback(() => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      setCursorPosition(e.target.selectionStart);
      resetHighlight();
      if (!isOpen) setIsOpen(true);
    },
    [onChange, isOpen, resetHighlight],
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    resetHighlight();
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, [resetHighlight]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Don't close if clicking inside dropdown
      if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
        return;
      }
      setTimeout(() => setIsOpen(false), 150);
      // Notify parent for touched state tracking
      if (onBlurProp) {
        onBlurProp();
      }
    },
    [onBlurProp],
  );

  /**
   * Handle dropdown navigation keys when open.
   * Extracted to reduce cognitive complexity.
   */
  const handleDropdownKey = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || displayedItems.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          isKeyboardNavRef.current = true;
          setHighlightedIndex((prev) =>
            prev < displayedItems.length - 1 ? prev + 1 : prev,
          );
          return true;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          isKeyboardNavRef.current = true;
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          return true;
        case 'Enter':
          if (!e.shiftKey && displayedItems[highlightedIndex]) {
            e.preventDefault();
            handleSelectSuggestion(displayedItems[highlightedIndex]);
            return true;
          }
          return false;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
          return true;
        default:
          return false;
      }
    },
    [isOpen, displayedItems, highlightedIndex, handleSelectSuggestion],
  );

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
          onTabOut(e, e.shiftKey ? 'backward' : 'forward');
        }
        return;
      }

      // Dropdown navigation
      handleDropdownKey(e);
    },
    [isOpen, handleDropdownKey, onTabOut, onArrowNav],
  );

  // ── Default styling ────────────────────────────────────────────────────

  const defaultInputClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[80px] overflow-y-auto';

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* Mirror div for cursor position calculation */}
      <div ref={mirrorRef} aria-hidden="true" />

      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onSelect={handleCursorUpdate}
        onClick={handleCursorUpdate}
        className={inputClassName ?? defaultInputClass}
        rows={4}
        placeholder={`Komori(20+40)\nST:Reliure_Martin(3j):dos carré collé`}
        data-testid={
          id ? `jcf-field-${id.replace('jcf-', '')}` : undefined
        }
      />

      {isOpen &&
        displayedItems.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg max-h-[200px] overflow-y-auto min-w-[200px] z-[9999]"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
            }}
            onScroll={handleScroll}
            data-testid={
              id ? `${id}-dropdown` : 'sequence-dropdown'
            }
          >
            {displayedItems.map((suggestion, index) => (
              <div
                key={`${index}-${suggestion.label}`}
                className={`px-[10px] py-[5px] cursor-pointer flex justify-between items-center font-mono text-sm ${
                  index === highlightedIndex
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-zinc-700 text-zinc-100'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(suggestion);
                }}
              >
                <span className="font-medium">
                  {highlightMatch(
                    suggestion.label,
                    searchText,
                    index === highlightedIndex,
                  )}
                </span>
                {suggestion.description && (
                  <span
                    className={`text-xs ml-[8px] px-[6px] py-[1px] rounded-[2px] ${
                      index === highlightedIndex
                        ? 'bg-blue-500 text-blue-100'
                        : 'bg-zinc-700 text-zinc-400'
                    }`}
                  >
                    {suggestion.description}
                  </span>
                )}
              </div>
            ))}
            {hasMore && (
              <div className="px-[10px] py-[5px] text-center text-zinc-500 text-xs border-t border-zinc-700">
                ↓ Scroll pour plus de suggestions
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
