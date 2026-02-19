/**
 * WorkflowSequenceAutocomplete - Category-based sequence editor for templates
 *
 * Unlike JcfSequenceAutocomplete (which suggests concrete machine names for jobs),
 * this component suggests abstract POSTE_CATEGORIES for template workflow definitions.
 *
 * One line = one workflow step.
 * Commas separate alternatives within a step (e.g. "Presse offset, Presse numérique").
 *
 * @see v0.5.x - Template workflow categories
 */

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

// ── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  value: string;
}

export interface WorkflowSequenceAutocompleteProps {
  /** Current value — multi-line workflow text */
  value: string;
  /** Store value */
  onChange: (value: string) => void;
  /** Available workflow categories (e.g. POSTE_CATEGORIES) */
  categories: ReadonlyArray<string>;
  /** HTML id for the textarea */
  id?: string;
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
  /** Callback when field loses focus */
  onBlur?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get info about the current line where the cursor sits.
 * Returns the partial text (from line start to cursor) and line boundaries.
 */
function getCurrentLineInfo(text: string, cursorPos: number) {
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  let lineEnd = text.indexOf('\n', cursorPos);
  if (lineEnd === -1) lineEnd = text.length;
  const partialLine = text.substring(lineStart, cursorPos);
  return { lineStart, lineEnd, partialLine };
}

/**
 * Get the search token — the text after the last comma on the current line,
 * trimmed. This supports comma-separated alternatives within a line.
 */
function getSearchToken(partialLine: string): string {
  const lastComma = partialLine.lastIndexOf(',');
  const token = lastComma >= 0 ? partialLine.substring(lastComma + 1) : partialLine;
  return token.trim();
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowSequenceAutocomplete({
  value,
  onChange,
  categories,
  id,
  inputClassName,
  onTabOut,
  onArrowNav,
  onBlur: onBlurProp,
}: WorkflowSequenceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  // ── Cursor position calculation ────────────────────────────────────────

  const calculateDropdownPosition = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;

    const textareaRect = textarea.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);

    const stylesToCopy = [
      'font-family', 'font-size', 'font-weight', 'font-style',
      'letter-spacing', 'line-height', 'text-transform',
      'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'box-sizing', 'width',
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
    const relativeTop = markerRect.top - mirrorRect.top - textarea.scrollTop;
    const relativeLeft = markerRect.left - mirrorRect.left;
    const lineHeight = parseInt(computed.lineHeight) || 20;

    setDropdownPos({
      top: textareaRect.top + relativeTop + lineHeight,
      left: textareaRect.left + Math.max(0, relativeLeft),
    });
  }, [value, cursorPosition]);

  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
    }
  }, [isOpen, cursorPosition, value, calculateDropdownPosition]);

  // ── Suggestions ────────────────────────────────────────────────────────

  const { filtered, searchText } = useMemo(() => {
    const { partialLine } = getCurrentLineInfo(value, cursorPosition);
    const search = getSearchToken(partialLine);

    const matching = categories.filter((cat) =>
      cat.toLowerCase().includes(search.toLowerCase()),
    );

    const suggestions: Suggestion[] = matching.map((cat) => ({
      label: cat,
      value: cat,
    }));

    return { filtered: suggestions, searchText: search };
  }, [value, cursorPosition, categories]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered.length, searchText]);

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

  // ── Selection handling ─────────────────────────────────────────────────

  const handleSelectSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const { lineStart, lineEnd, partialLine } = getCurrentLineInfo(value, cursorPosition);
      const beforeLine = value.substring(0, lineStart);
      const afterLine = value.substring(lineEnd);

      // Replace only the current token (after last comma) with the selected category
      const lastComma = partialLine.lastIndexOf(',');
      let newLineContent: string;
      if (lastComma >= 0) {
        // Keep everything before the comma + space, append selected value
        newLineContent = partialLine.substring(0, lastComma + 1) + ' ' + suggestion.value;
      } else {
        newLineContent = suggestion.value;
      }

      const newValue = beforeLine + newLineContent + afterLine;
      onChange(newValue);

      const newCursorPos = lineStart + newLineContent.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          setCursorPosition(newCursorPos);
        }
      }, 0);

      setIsOpen(false);
    },
    [value, cursorPosition, onChange],
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
      if (!isOpen) setIsOpen(true);
    },
    [onChange, isOpen],
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    setHighlightedIndex(0);
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  }, []);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
        return;
      }
      setTimeout(() => setIsOpen(false), 150);
      onBlurProp?.();
    },
    [onBlurProp],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Alt+Arrow — delegate to table navigation
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

      // Dropdown navigation when open
      if (isOpen && filtered.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            e.stopPropagation();
            isKeyboardNavRef.current = true;
            setHighlightedIndex((prev) =>
              prev < filtered.length - 1 ? prev + 1 : prev,
            );
            return;
          case 'ArrowUp':
            e.preventDefault();
            e.stopPropagation();
            isKeyboardNavRef.current = true;
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
            return;
          case 'Enter':
            if (!e.shiftKey && filtered[highlightedIndex]) {
              e.preventDefault();
              handleSelectSuggestion(filtered[highlightedIndex]);
              return;
            }
            break;
          case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            return;
        }
      }
    },
    [isOpen, filtered, highlightedIndex, handleSelectSuggestion, onTabOut, onArrowNav],
  );

  // ── Default styling ────────────────────────────────────────────────────

  const defaultInputClass =
    'w-full bg-zinc-900 border border-zinc-700 rounded-[3px] px-[7px] py-[5px] text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[80px] overflow-y-auto';

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative">
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
        placeholder={`Presse offset\nMassicot\nConditionnement`}
        data-testid={
          id ? `jcf-field-${id.replace('jcf-', '')}` : undefined
        }
      />

      {isOpen &&
        filtered.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-zinc-800 border border-zinc-700 rounded-[3px] shadow-lg max-h-[200px] overflow-y-auto min-w-[200px] z-[9999]"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
            }}
            data-testid={
              id ? `${id}-dropdown` : 'workflow-sequence-dropdown'
            }
          >
            {filtered.map((suggestion, index) => (
              <button
                type="button"
                key={suggestion.label}
                className={`w-full px-[10px] py-[5px] cursor-pointer flex items-center font-mono text-sm text-left ${
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
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
