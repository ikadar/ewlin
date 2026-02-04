import { useState, useMemo, useCallback } from 'react';
import type { SurfacagePreset } from '@flux/types';
import { JcfAutocomplete } from '../JcfAutocomplete/JcfAutocomplete';
import type { Suggestion } from '../JcfAutocomplete/JcfAutocomplete';
import { mergeWithSession } from '../../utils/mergeWithSession';
import {
  toPrettySurfacage,
  toDslSurfacage,
  isValidSurfacage,
} from './surfacageDsl';

export interface JcfSurfacageAutocompleteProps {
  /** Stored DSL value (e.g., "mat/mat", "brillant/", "UV/UV") */
  value: string;
  /** Store DSL value */
  onChange: (value: string) => void;
  /** Available surfacage presets */
  presets: SurfacagePreset[];
  /** Session-learned surfacage presets */
  sessionPresets?: SurfacagePreset[];
  /** Callback to learn a new surfacage preset */
  onLearnPreset?: (preset: SurfacagePreset) => void;
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
 * Surfacage autocomplete field for the JCF Elements Table.
 *
 * Wraps JcfAutocomplete with surfacage-specific behavior:
 * - Bidirectional DSL ↔ pretty display (focus toggles)
 * - Surfacage validation (must contain /)
 * - 10 surfacage presets with descriptions
 * - Session learning for new surfacage presets
 */
export function JcfSurfacageAutocomplete({
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
}: JcfSurfacageAutocompleteProps) {
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

  // Display value: pretty when unfocused, editing when focused
  const displayValue = isFocused
    ? editingValue
    : toPrettySurfacage(value);

  const handleFocus = useCallback(() => {
    setEditingValue(toDslSurfacage(value));
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
    if (onLearnPreset && isValidSurfacage(trimmed)) {
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
      placeholder="ex: mat/mat"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTabOut={onTabOut}
      onArrowNav={onArrowNav}
    />
  );
}
