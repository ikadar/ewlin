/**
 * Format DSL parser — extracts the longest side (in millimetres for ISO
 * codes, in the raw numeric unit for custom dimensions) of an `ElementSpec.format`
 * string. Powers the directional scoring rule on offset presses (R4 —
 * descending format preferred).
 *
 * Faithful port of {@link services/php-api/src/Util/FormatDSLParser.php}. Any
 * case added/modified here MUST be reflected in the PHP sibling (and its
 * truth-table tests) — directional scoring depends on both sides agreeing on
 * the same long side for every format value.
 *
 * Supported syntaxes:
 * - Custom numeric: `"50x70"`, `"63x88"`, `"50 X 70"`, `"50×70"`
 * - Custom with trailing poses: `"50x70(8)"`
 * - Composite: `"A3/A6"`, `"50x70/A4"` → max of parts
 * - ISO A/B/SRA/RA codes
 * - Lone number: `"70"`
 *
 * Returns `null` when the format is unparseable — callers should skip
 * directional scoring in that case.
 */

const ISO_SIZES: Record<string, number> = {
  a0: 1189, a1: 841, a2: 594, a3: 420, a4: 297,
  a5: 210,  a6: 148, a7: 105, a8: 74,  a9: 52,  a10: 37,
  b0: 1414, b1: 1000, b2: 707, b3: 500, b4: 353, b5: 250,
  b6: 176,  b7: 125,  b8: 88,  b9: 62,  b10: 44,
  sra0: 1280, sra1: 900, sra2: 640, sra3: 450, sra4: 320,
  ra0: 1220,  ra1: 860,  ra2: 610,  ra3: 430,  ra4: 305,
};

export function longSide(format: string | null | undefined): number | null {
  if (format == null) return null;
  const trimmed = format.trim().toLowerCase();
  if (trimmed === '') return null;

  // Composite "A3/A6" — max of resolved parts
  if (trimmed.includes('/')) {
    let max: number | null = null;
    for (const part of trimmed.split('/')) {
      const ls = longSide(part.trim());
      if (ls !== null && (max === null || ls > max)) max = ls;
    }
    return max;
  }

  // Strip trailing (poses)
  const cleaned = trimmed.replace(/\([^)]*\)/, '').trim();

  // Custom numeric LxH (x / × / space-separated)
  const dimMatch = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/u.exec(cleaned);
  if (dimMatch) {
    return Math.round(Math.max(parseFloat(dimMatch[1]), parseFloat(dimMatch[2])));
  }

  // ISO / SRA / RA
  if (cleaned in ISO_SIZES) return ISO_SIZES[cleaned];

  // Lone number
  const loneMatch = /^(\d+(?:\.\d+)?)$/.exec(cleaned);
  if (loneMatch) return Math.round(parseFloat(loneMatch[1]));

  return null;
}
