import { useState, useMemo, useCallback } from 'react';
import type { ProductFormat } from '@flux/types';
import { JcfAutocomplete } from '../JcfAutocomplete/JcfAutocomplete';
import type { Suggestion } from '../JcfAutocomplete/JcfAutocomplete';
import { mergeWithSession } from '../../utils/mergeWithSession';
import {
  isValidFormat,
  normalizeFormat,
  toPrettyFormat,
  buildDimensionLookup,
} from './formatDsl';
import type { DimensionLookup } from './formatDsl';

export interface JcfFormatAutocompleteProps {
  /** Stored DSL value (e.g., "A4", "210x297", "A3/A6") */
  value: string;
  /** Store normalized DSL value */
  onChange: (value: string) => void;
  /** Available product formats from API */
  formats: ProductFormat[];
  /** Session-learned format presets */
  sessionPresets?: ProductFormat[];
  /** Callback to learn a new format preset */
  onLearnPreset?: (format: ProductFormat) => void;
  /** HTML id for the input (cell ID for navigation) */
  id?: string;
  /** Additional CSS class */
  className?: string;
  /** Input CSS class override */
  inputClassName?: string;
  /** Table navigation delegation: Tab/Shift+Tab */
  onTabOut?: (e: React.KeyboardEvent, direction: 'forward' | 'backward') => void;
  /** Table navigation delegation: Alt+Arrow */
  onArrowNav?: (e: React.KeyboardEvent, direction: 'up' | 'down' | 'left' | 'right') => void;
}

/**
 * Format autocomplete field for the JCF Elements Table.
 *
 * Wraps JcfAutocomplete with format-specific behavior:
 * - Bidirectional DSL ↔ pretty display (focus toggles)
 * - Format validation and normalization
 * - Dimension lookup from ProductFormat[]
 * - Session learning for new format presets
 */
export function JcfFormatAutocomplete({
  value,
  onChange,
  formats,
  sessionPresets = [],
  onLearnPreset,
  id,
  className,
  inputClassName,
  onTabOut,
  onArrowNav,
}: JcfFormatAutocompleteProps) {
  const [editingValue, setEditingValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Build dimension lookup from API formats
  const dimensionLookup: DimensionLookup = useMemo(
    () => buildDimensionLookup(formats),
    [formats],
  );

  // Generate suggestions: base formats + session formats
  const suggestions: Suggestion[] = useMemo(() => {
    const baseSuggestions: Suggestion[] = formats.map((f) => ({
      label: f.name,
      value: f.name,
      category: `${f.width}×${f.height}mm`,
    }));

    const sessionSuggestions: Suggestion[] = sessionPresets.map((f) => ({
      label: f.name,
      value: f.name,
      category: `${f.width}×${f.height}mm`,
    }));

    return mergeWithSession(baseSuggestions, sessionSuggestions, (s) => s.value);
  }, [formats, sessionPresets]);

  // Display value: pretty when unfocused, editing when focused
  const displayValue = isFocused
    ? editingValue
    : toPrettyFormat(value, dimensionLookup);

  const handleFocus = useCallback(() => {
    setEditingValue(value);
    setIsFocused(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    const trimmed = editingValue.trim();
    if (trimmed === '') {
      onChange('');
      return;
    }

    // Normalize and store
    const normalized = normalizeFormat(trimmed);
    onChange(normalized);

    // Session learn if new and valid
    if (onLearnPreset && isValidFormat(normalized)) {
      const existsInFormats = formats.some(
        (f) => f.name.toLowerCase() === normalized.toLowerCase(),
      );
      const existsInSession = sessionPresets.some(
        (f) => f.name.toLowerCase() === normalized.toLowerCase(),
      );

      if (!existsInFormats && !existsInSession) {
        // Try to resolve dimensions for the new format
        const dims = resolveDimensions(normalized, dimensionLookup);
        onLearnPreset({
          id: `session-${normalized.toLowerCase()}`,
          name: normalized,
          width: dims?.width ?? 0,
          height: dims?.height ?? 0,
        });
      }
    }
  }, [editingValue, onChange, onLearnPreset, formats, sessionPresets, dimensionLookup]);

  const handleChange = useCallback((val: string) => {
    setEditingValue(val);
  }, []);

  return (
    <JcfAutocomplete
      value={displayValue}
      onChange={handleChange}
      suggestions={suggestions}
      id={id}
      className={className}
      inputClassName={inputClassName}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTabOut={onTabOut}
      onArrowNav={onArrowNav}
    />
  );
}

/**
 * Resolve dimensions for a format string.
 * Handles ISO (via lookup), custom (parsed), fermé (doubled), composite (first part).
 */
function resolveDimensions(
  format: string,
  lookup: DimensionLookup,
): { width: number; height: number } | undefined {
  // Composite: use first part
  if (format.includes('/')) {
    return resolveDimensions(format.split('/')[0], lookup);
  }

  // Fermé: base dimensions
  if (/^.+fi$/i.test(format)) {
    return lookup.get(format.slice(0, -2)) ?? parseCustom(format.slice(0, -2));
  }
  if (/^.+f$/i.test(format) && !format.endsWith('fi')) {
    return lookup.get(format.slice(0, -1)) ?? parseCustom(format.slice(0, -1));
  }

  // Direct lookup or custom parse
  return lookup.get(format) ?? parseCustom(format);
}

function parseCustom(s: string): { width: number; height: number } | undefined {
  const match = s.match(/^(\d+)x(\d+)$/i);
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  return undefined;
}
