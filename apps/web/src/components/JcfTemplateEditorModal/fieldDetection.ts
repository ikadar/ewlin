/**
 * JSON Field Detection for Contextual Autocomplete (v0.4.40)
 *
 * Detects which JSON field the cursor is positioned in,
 * enabling field-aware autocomplete suggestions.
 */

/** Fields that support autocomplete */
export const AUTOCOMPLETABLE_FIELDS = [
  'name',
  'format',
  'impression',
  'surfacage',
  'papier',
  'sequence',
] as const;

export type AutocompletableField = (typeof AUTOCOMPLETABLE_FIELDS)[number];

/**
 * Detect which JSON field the cursor is in.
 * Returns the field name if in an autocompletable context, null otherwise.
 *
 * Detects patterns like:
 * - "fieldName": "...<cursor>..."
 * - "sequence": [..., "<cursor>..."
 */
export function detectFieldContext(
  doc: string,
  pos: number
): AutocompletableField | null {
  const before = doc.slice(0, pos);
  const after = doc.slice(pos);

  // Check if we're inside a string value (between quotes)
  // Pattern: "fieldName": "...<cursor>..." (cursor after opening quote)
  const stringValueMatch = before.match(/"(\w+)"\s*:\s*"([^"]*)$/);
  if (stringValueMatch) {
    // Verify we're still inside the string (next char is not past closing quote)
    const nextQuote = after.indexOf('"');
    const nextNewline = after.indexOf('\n');
    // If next quote comes before newline (or no newline), we're inside the string
    if (nextQuote !== -1 && (nextNewline === -1 || nextQuote < nextNewline)) {
      const fieldName = stringValueMatch[1] as AutocompletableField;
      if (AUTOCOMPLETABLE_FIELDS.includes(fieldName)) {
        return fieldName;
      }
    }
  }

  // Check if we're inside sequence array (array of strings)
  // Pattern: "sequence": [..., "<cursor>..."
  const seqIndex = before.lastIndexOf('"sequence"');
  if (seqIndex !== -1) {
    const afterSeq = before.slice(seqIndex);
    const bracketOpen = afterSeq.lastIndexOf('[');
    const bracketClose = afterSeq.lastIndexOf(']');
    // Inside the array and after an opening quote
    if (bracketOpen > bracketClose && afterSeq.match(/"[^"]*$/)) {
      // Verify we're still inside the string
      const nextQuote = after.indexOf('"');
      const nextNewline = after.indexOf('\n');
      if (nextQuote !== -1 && (nextNewline === -1 || nextQuote < nextNewline)) {
        return 'sequence';
      }
    }
  }

  return null;
}
