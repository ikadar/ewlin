import type { ProductFormat } from '@flux/types';

/**
 * Format DSL utilities for the JCF Format Autocomplete field.
 *
 * Valid format patterns (§1.5):
 * - ISO:       A0–A10, optionally with "f" (fermé) or "fi" (fermé italienne)
 * - Custom:    WxH (e.g., 210x297), optionally with f/fi suffix
 * - Composite: format/format (e.g., A3/A6)
 */

// ── Validation patterns ──────────────────────────────────────────────────────

const isoPattern = /^A([0-9]|10)(f|fi)?$/i;
const customPattern = /^\d+x\d+(f|fi)?$/i;
const compositePattern =
  /^(A([0-9]|10)|\d+x\d+)\/(A([0-9]|10)|\d+x\d+)$/i;

/**
 * Validate whether a string is a valid format DSL value.
 * Accepts ISO (A4, A3f, A5fi), custom (210x297), and composite (A3/A6).
 */
export function isValidFormat(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  return (
    isoPattern.test(trimmed) ||
    customPattern.test(trimmed) ||
    compositePattern.test(trimmed)
  );
}

/**
 * Normalize a format string:
 * - ISO formats: uppercase letter + number + preserved suffix (a4 → A4, a4f → A4f, a4fi → A4fi)
 * - Custom dimensions: lowercase x separator (210X297 → 210x297)
 * - Composite: normalize each part
 */
export function normalizeFormat(value: string): string {
  const trimmed = value.trim();

  // Composite: normalize each part
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    return parts.map(normalizeFormat).join('/');
  }

  // ISO: uppercase A, preserve suffix case as lowercase
  if (isoPattern.test(trimmed)) {
    const match = trimmed.match(/^(A)(\d+)(f|fi)?$/i);
    if (match) {
      const suffix = match[3] ? match[3].toLowerCase() : '';
      return `A${match[2]}${suffix}`;
    }
  }

  // Custom: lowercase x
  if (customPattern.test(trimmed)) {
    return trimmed.replace(/X/g, 'x').replace(/(f|fi)$/i, (s) => s.toLowerCase());
  }

  return trimmed;
}

// ── Dimension lookup ─────────────────────────────────────────────────────────

export interface DimensionLookup {
  get(name: string): { width: number; height: number } | undefined;
}

/**
 * Build a case-insensitive name→dimensions map from ProductFormat[].
 */
export function buildDimensionLookup(formats: ProductFormat[]): DimensionLookup {
  const map = new Map<string, { width: number; height: number }>();
  for (const f of formats) {
    map.set(f.name.toLowerCase(), { width: f.width, height: f.height });
  }
  return {
    get(name: string) {
      return map.get(name.toLowerCase());
    },
  };
}

// ── Pretty display ───────────────────────────────────────────────────────────

/**
 * Convert a DSL format string to a human-readable pretty display.
 *
 * Examples:
 * - "A4" → "A4 — 210×297mm"
 * - "A4f" → "A4f — 420×297 ouv. / 210×297 fermé"
 * - "A4fi" → "A4fi — 210×594 ouv. / 210×297 fermé"
 * - "A3/A6" → "A3/A6 — 297×420 / 105×148"
 * - "210x297" → "210×297mm"
 * - unknown → returned as-is
 */
export function toPrettyFormat(
  value: string,
  lookup: DimensionLookup,
): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';

  // Composite format: two parts separated by /
  if (compositePattern.test(trimmed)) {
    const [left, right] = trimmed.split('/');
    const dimLeft = lookupDimensions(left, lookup);
    const dimRight = lookupDimensions(right, lookup);
    if (dimLeft && dimRight) {
      return `${trimmed} — ${dimLeft.width}×${dimLeft.height} / ${dimRight.width}×${dimRight.height}`;
    }
    return trimmed;
  }

  // Fermé (f suffix): double width
  if (/^.+f$/i.test(trimmed) && !trimmed.endsWith('fi')) {
    const base = trimmed.slice(0, -1);
    const dim = lookupDimensions(base, lookup);
    if (dim) {
      return `${trimmed} — ${dim.width * 2}×${dim.height} ouv. / ${dim.width}×${dim.height} fermé`;
    }
    return trimmed;
  }

  // Fermé italienne (fi suffix): double height
  if (/^.+fi$/i.test(trimmed)) {
    const base = trimmed.slice(0, -2);
    const dim = lookupDimensions(base, lookup);
    if (dim) {
      return `${trimmed} — ${dim.width}×${dim.height * 2} ouv. / ${dim.width}×${dim.height} fermé`;
    }
    return trimmed;
  }

  // Plain ISO or custom dimension
  const dim = lookupDimensions(trimmed, lookup);
  if (dim) {
    // ISO format (starts with A): show "Name — WxHmm"
    if (isoPattern.test(trimmed)) {
      return `${trimmed} — ${dim.width}×${dim.height}mm`;
    }
    // Custom: show "WxHmm"
    return `${dim.width}×${dim.height}mm`;
  }

  return trimmed;
}

/**
 * Look up dimensions for a base format name (no f/fi suffix).
 * Tries the lookup first, then parses custom dimensions (WxH).
 */
function lookupDimensions(
  name: string,
  lookup: DimensionLookup,
): { width: number; height: number } | undefined {
  const dim = lookup.get(name);
  if (dim) return dim;

  // Try parsing custom dimensions
  const match = name.match(/^(\d+)x(\d+)$/i);
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }

  return undefined;
}
