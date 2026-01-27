/**
 * Surfacage DSL utilities for the JCF Surfacage Autocomplete field.
 *
 * Format: recto/verso (e.g., "mat/mat", "brillant/", "UV/UV")
 * Validation: must contain "/" separator
 *
 * @see implicit-logic-specification.md §1.4 (Surfacage format)
 */

// ── Pretty display conversions ──────────────────────────────────────────────

const dslToPretty: Record<string, string> = {
  'mat/mat': 'pelli mat recto/verso',
  'satin/satin': 'pelli satin recto/verso',
  'brillant/brillant': 'pelli brillant recto/verso',
  'uv/uv': 'vernis UV recto/verso',
  'dorure/dorure': 'dorure recto/verso',
  'mat/': 'pelli mat recto',
  'satin/': 'pelli satin recto',
  'brillant/': 'pelli brillant recto',
  'uv/': 'vernis UV recto',
  'dorure/': 'dorure recto',
};

const prettyToDsl: Record<string, string> = {
  'pelli mat recto/verso': 'mat/mat',
  'pelli satin recto/verso': 'satin/satin',
  'pelli brillant recto/verso': 'brillant/brillant',
  'vernis uv recto/verso': 'UV/UV',
  'dorure recto/verso': 'dorure/dorure',
  'pelli mat recto': 'mat/',
  'pelli satin recto': 'satin/',
  'pelli brillant recto': 'brillant/',
  'vernis uv recto': 'UV/',
  'dorure recto': 'dorure/',
};

/**
 * Convert DSL surfacage to pretty display format.
 *
 * Examples:
 * - "mat/mat" → "pelli mat recto/verso"
 * - "UV/UV" → "vernis UV recto/verso"
 * - "mat/" → "pelli mat recto"
 * - "gaufrage/" → "gaufrage/" (no conversion, returned as-is)
 *
 * Skips conversion for comma-separated combined values.
 */
export function toPrettySurfacage(dsl: string): string {
  if (dsl === '') return '';
  if (dsl.includes(',')) return dsl;
  return dslToPretty[dsl.toLowerCase()] ?? dsl;
}

/**
 * Convert pretty display back to DSL format.
 *
 * Examples:
 * - "pelli mat recto/verso" → "mat/mat"
 * - "vernis UV recto/verso" → "UV/UV"
 * - "gaufrage/" → "gaufrage/" (no conversion, returned as-is)
 *
 * Skips conversion for comma-separated combined values.
 */
export function toDslSurfacage(pretty: string): string {
  if (pretty === '') return '';
  if (pretty.includes(',')) return pretty;
  return prettyToDsl[pretty.toLowerCase()] ?? pretty;
}

/**
 * Validate whether a string is a valid surfacage format.
 * Must contain "/" (recto/verso separator).
 */
export function isValidSurfacage(value: string): boolean {
  return value.includes('/');
}
