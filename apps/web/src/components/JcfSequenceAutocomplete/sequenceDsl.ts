/**
 * Sequence DSL utilities for the JCF Sequence Autocomplete.
 *
 * Each line in the sequence textarea represents a production step.
 * Format: PosteName(duration) or PosteName(setup+run)
 * Example: G37(20+40), Stahl(35), ST:MCA(3j):dos carré collé
 *
 * @see implicit-logic-specification.md §5.1 (Sequence State Machine)
 */

/** Poste line validation regex: Name(duration) or Name(setup+run) */
const POSTE_REGEX = /^[A-Za-z0-9_]+\(\d+(\+\d+)?\)$/;

/** ST line validation regex: ST:Name(duration):description */
const ST_REGEX = /^ST:[A-Za-z0-9_]+\(\d+[jh]?\):.+$/;

/** Default duration suggestions for poste mode */
export const DEFAULT_DURATIONS = [
  '20',
  '30',
  '40',
  '60',
  '20+30',
  '20+40',
  '30+60',
];

// ── Parsed line types ────────────────────────────────────────────────────────

export type SequenceStep =
  | 'poste'
  | 'poste-duration'
  | 'st-prefix'
  | 'st-name'
  | 'st-duration'
  | 'complete';

export interface ParsedLine {
  /** Current autocomplete step */
  step: SequenceStep;
  /** Text prefix before current search (used for value reconstruction) */
  prefix: string;
  /** Current search text for filtering suggestions */
  search: string;
  /** Selected poste name (only in poste-duration step) */
  posteName?: string;
  /** Selected ST name (only in st-duration step) */
  stName?: string;
}

// ── Line info from textarea ──────────────────────────────────────────────────

export interface CurrentLineInfo {
  /** Full text of the current line */
  lineText: string;
  /** Partial text from line start to cursor */
  partialLine: string;
  /** Character index of line start in the full text */
  lineStart: number;
  /** Character index of line end in the full text */
  lineEnd: number;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a single line (or partial line up to cursor) to determine the
 * autocomplete step.
 *
 * State machine:
 * - "poste": empty or text without `:` or `(` → suggest poste names + "ST:"
 * - "poste-duration": "PosteName(..." → suggest durations
 * - "st-prefix": starts with "st" (case-insensitive) → suggest "ST:" prefix
 * - "st-name": "ST:..." without `(` → suggest sous-traitant names
 * - "st-duration": "ST:Name(..." → suggest durations
 * - "complete": has `(...)` → no suggestions
 */
export function parseLine(line: string): ParsedLine {
  // Complete: has parentheses with content and closing paren
  if (/\([^)]+\)/.test(line)) {
    return { step: 'complete', prefix: line, search: '' };
  }

  // ST patterns (must check before poste-duration since ST:Name( also has `(`)
  const stMatch = line.match(/^(ST:)(.*)$/i);
  if (stMatch) {
    const afterST = stMatch[2];

    // Inside parentheses (typing duration)
    const parenMatch = afterST.match(/^([A-Za-z0-9_]+)\((.*)$/);
    if (parenMatch) {
      return {
        step: 'st-duration',
        prefix: `ST:${parenMatch[1]}(`,
        search: parenMatch[2],
        stName: parenMatch[1],
      };
    }

    // Typing sous-traitant name
    return {
      step: 'st-name',
      prefix: 'ST:',
      search: afterST,
    };
  }

  // Typing "st" but not yet "ST:" → suggest ST: prefix
  if (
    line.toLowerCase().startsWith('st') &&
    !line.includes('(') &&
    !line.includes(':')
  ) {
    return { step: 'st-prefix', prefix: '', search: line };
  }

  // Poste with open paren (typing duration) — e.g., "G37(" or "G37(20"
  const posteParenMatch = line.match(/^([A-Za-z0-9_]+)\((.*)$/);
  if (posteParenMatch) {
    return {
      step: 'poste-duration',
      prefix: posteParenMatch[1] + '(',
      search: posteParenMatch[2],
      posteName: posteParenMatch[1],
    };
  }

  // Regular poste mode or empty
  return { step: 'poste', prefix: '', search: line };
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Check if a line is complete (has closing parenthesis).
 * Only complete lines should be validated — incomplete lines are "in progress".
 */
export function isSequenceLineComplete(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return trimmed.includes(')');
}

/**
 * Validate a complete sequence line against known formats.
 * Returns true if the line is valid (poste or ST format).
 * Empty lines are considered valid.
 */
export function isValidSequenceLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return POSTE_REGEX.test(trimmed) || ST_REGEX.test(trimmed);
}

/**
 * Smart validation: returns true if the line is INVALID and should be flagged.
 * Only flags lines that are complete (have closing paren) but don't match any format.
 * Incomplete lines are never flagged.
 */
export function isSequenceLineInvalid(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (!isSequenceLineComplete(trimmed)) return false;
  return !isValidSequenceLine(trimmed);
}

// ── Textarea line extraction ─────────────────────────────────────────────────

/**
 * Extract current line info from textarea value and cursor position.
 */
export function getCurrentLineInfo(
  text: string,
  cursorPos: number,
): CurrentLineInfo {
  const beforeCursor = text.substring(0, cursorPos);
  const lineStart = beforeCursor.lastIndexOf('\n') + 1;
  const lineEndFromCursor = text.indexOf('\n', cursorPos);
  const lineEnd = lineEndFromCursor === -1 ? text.length : lineEndFromCursor;

  return {
    lineText: text.substring(lineStart, lineEnd),
    partialLine: beforeCursor.substring(lineStart),
    lineStart,
    lineEnd,
  };
}
