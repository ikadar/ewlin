/**
 * Papier DSL utilities for the JCF Papier Autocomplete field.
 *
 * DSL format: "Type:Grammage" (e.g., "Couché mat:135")
 * Pretty display: "Type Grammageg" (e.g., "Couché mat 135g")
 * Validation: must contain ":" separator with numeric grammage
 *
 * @see implicit-logic-specification.md §1.1 (Papier Format)
 */

// ── Pretty display conversions ──────────────────────────────────────────────

/**
 * Convert DSL papier to pretty display format.
 *
 * Examples:
 * - "Couché mat:135" → "Couché mat 135g"
 * - "Offset:80" → "Offset 80g"
 * - "Couché mat:" → "Couché mat:" (incomplete, returned as-is)
 * - "" → ""
 * - "no-colon" → "no-colon" (no conversion)
 */
export function toPrettyPapier(dsl: string): string {
  if (dsl === '') return '';

  const colonIndex = dsl.lastIndexOf(':');
  if (colonIndex === -1) return dsl;

  const type = dsl.substring(0, colonIndex);
  const grammage = dsl.substring(colonIndex + 1);

  // No grammage yet — return as-is
  if (grammage === '') return dsl;

  // Pure digits → add "g" suffix
  if (/^\d+$/.test(grammage)) {
    return `${type} ${grammage}g`;
  }

  // Already has "g" suffix → replace colon with space
  if (/^\d+g$/i.test(grammage)) {
    return `${type} ${grammage}`;
  }

  return dsl;
}

/**
 * Convert pretty display back to DSL format.
 *
 * Examples:
 * - "Couché mat 135g" → "Couché mat:135"
 * - "Offset 80g" → "Offset:80"
 * - "Couché mat:135" → "Couché mat:135" (already DSL)
 * - "" → ""
 */
export function toDslPapier(pretty: string): string {
  if (pretty === '') return '';

  // Already in DSL format (contains colon)
  if (pretty.includes(':')) return pretty;

  // Match: type (anything) + space + grammage (digits + optional g)
  const match = pretty.match(/^(.+?)\s+(\d+)g?$/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  return pretty;
}

/**
 * Validate whether a string is a valid papier DSL format.
 * Must contain ":" separator with non-empty type and numeric grammage.
 */
export function isValidPapier(value: string): boolean {
  const colonIndex = value.lastIndexOf(':');
  if (colonIndex === -1) return false;

  const type = value.substring(0, colonIndex).trim();
  const grammage = value.substring(colonIndex + 1).trim();

  return type.length > 0 && /^\d+$/.test(grammage);
}

// ── Input parsing ───────────────────────────────────────────────────────────

export interface PapierInputParts {
  /** Paper type name (before colon) */
  type: string;
  /** Grammage string (after colon) */
  grammage: string;
  /** Whether the user is in the grammage-selection step */
  isTypingGrammage: boolean;
}

/**
 * Parse editing input to detect whether user is typing a type or grammage.
 * Uses the last colon as the separator between the two steps.
 *
 * Examples:
 * - "Cou" → { type: "Cou", grammage: "", isTypingGrammage: false }
 * - "Couché mat:" → { type: "Couché mat", grammage: "", isTypingGrammage: true }
 * - "Couché mat:13" → { type: "Couché mat", grammage: "13", isTypingGrammage: true }
 */
export function parsePapierInput(input: string): PapierInputParts {
  const trimmed = input.trim();
  const colonIndex = trimmed.lastIndexOf(':');

  if (colonIndex === -1) {
    return { type: trimmed, grammage: '', isTypingGrammage: false };
  }

  return {
    type: trimmed.substring(0, colonIndex),
    grammage: trimmed.substring(colonIndex + 1),
    isTypingGrammage: true,
  };
}
