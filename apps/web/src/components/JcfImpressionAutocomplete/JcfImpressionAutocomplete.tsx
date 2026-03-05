import { useState, useMemo, useCallback } from 'react';
import type { ImpressionPreset } from '@flux/types';
import { JcfAutocomplete } from '../JcfAutocomplete/JcfAutocomplete';
import type { Suggestion } from '../JcfAutocomplete/JcfAutocomplete';
import { mergeWithSession } from '../../utils/mergeWithSession';
import {
  toPrettyImpression,
  toDslImpression,
  isValidImpression,
} from './impressionDsl';

export interface JcfImpressionAutocompleteProps {
  /** Stored DSL value (e.g., "Q/Q", "Q+V/", "N/N") */
  value: string;
  /** Store DSL value */
  onChange: (value: string) => void;
  /** Available impression presets */
  presets: ImpressionPreset[];
  /** Session-learned impression presets */
  sessionPresets?: ImpressionPreset[];
  /** Callback to learn a new impression preset */
  onLearnPreset?: (preset: ImpressionPreset) => void;
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
 * Impression autocomplete field for the JCF Elements Table.
 *
 * Wraps JcfAutocomplete with impression-specific behavior:
 * - Bidirectional DSL ↔ pretty display (focus toggles)
 * - Impression validation (must contain /)
 * - 9 impression presets with descriptions
 * - Session learning for new impression presets
 */
export function JcfImpressionAutocomplete({
  value,
  onChange,
  presets,
  sessionPresets = [],
  onLearnPreset,
  id,
  className,
  inputClassName,
  onTabOut,
  onArrowNav,
}: JcfImpressionAutocompleteProps) {
  const [editingValue, setEditingValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Generate suggestions: base presets + session presets
  const suggestions: Suggestion[] = useMemo(() => {
    const baseSuggestions: Suggestion[] = presets.map((p) => ({
      label: p.value,
      value: p.value,
      category: p.description,
    }));

    const sessionSuggestions: Suggestion[] = sessionPresets.map((p) => ({
      label: p.value,
      value: p.value,
      category: p.description,
    }));

    return mergeWithSession(baseSuggestions, sessionSuggestions, (s) => s.value);
  }, [presets, sessionPresets]);

  // Display value: pretty when unfocused, editing when focused.
  // Prefer stored label from preset over static toPrettyImpression fallback.
  const displayValue = isFocused
    ? editingValue
    : (() => {
        const preset = (presets as Array<{ value: string; label?: string }>).find(
          (p) => p.value === value
        );
        if (preset?.label) return preset.label;
        return toPrettyImpression(value);
      })();

  const handleFocus = useCallback(() => {
    setEditingValue(toDslImpression(value));
    setIsFocused(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    const trimmed = editingValue.trim();
    if (trimmed === '') {
      onChange('');
      return;
    }

    // Store DSL value
    onChange(trimmed);

    // Session learn if new and valid
    if (onLearnPreset && isValidImpression(trimmed)) {
      const existsInPresets = presets.some(
        (p) => p.value.toLowerCase() === trimmed.toLowerCase(),
      );
      const existsInSession = sessionPresets.some(
        (p) => p.value.toLowerCase() === trimmed.toLowerCase(),
      );

      if (!existsInPresets && !existsInSession) {
        onLearnPreset({
          id: `session-${trimmed.toLowerCase()}`,
          value: trimmed,
          description: 'custom',
        });
      }
    }
  }, [editingValue, onChange, onLearnPreset, presets, sessionPresets]);

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
      placeholder="ex: Q/Q"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTabOut={onTabOut}
      onArrowNav={onArrowNav}
    />
  );
}
