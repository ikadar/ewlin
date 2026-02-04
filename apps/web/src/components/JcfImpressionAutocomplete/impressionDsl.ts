/**
 * Impression DSL utilities for the JCF Impression Autocomplete field.
 *
 * Format: recto/verso (e.g., "Q/Q", "Q+V/", "N/N")
 * Validation: must contain "/" separator
 *
 * @see implicit-logic-specification.md §1.3 (Impression format)
 */

// ── Pretty display conversions ──────────────────────────────────────────────

const dslToPretty: Record<string, string> = {
  'q/q': 'quadri recto/verso',
  'n/n': 'noir recto/verso',
  'q/': 'quadri recto',
  'n/': 'noir recto',
};

const prettyToDsl: Record<string, string> = {
  'quadri recto/verso': 'Q/Q',
  'noir recto/verso': 'N/N',
  'quadri recto': 'Q/',
  'noir recto': 'N/',
};

/**
 * Convert DSL impression to pretty display format.
 *
 * Examples:
 * - "Q/Q" → "quadri recto/verso"
 * - "N/N" → "noir recto/verso"
 * - "Q/" → "quadri recto"
 * - "Q+V/Q+V" → "Q+V/Q+V" (no conversion, returned as-is)
 *
 * Skips conversion for comma-separated combined values.
 */
export function toPrettyImpression(dsl: string): string {
  if (dsl === '') return '';
  if (dsl.includes(',')) return dsl;
  return dslToPretty[dsl.toLowerCase()] ?? dsl;
}

/**
 * Convert pretty display back to DSL format.
 *
 * Examples:
 * - "quadri recto/verso" → "Q/Q"
 * - "noir recto/verso" → "N/N"
 * - "Q+V/Q+V" → "Q+V/Q+V" (no conversion, returned as-is)
 *
 * Skips conversion for comma-separated combined values.
 */
export function toDslImpression(pretty: string): string {
  if (pretty === '') return '';
  if (pretty.includes(',')) return pretty;
  return prettyToDsl[pretty.toLowerCase()] ?? pretty;
}

/**
 * Validate whether a string is a valid impression format.
 * Must contain "/" (recto/verso separator).
 */
export function isValidImpression(value: string): boolean {
  return value.includes('/');
}
