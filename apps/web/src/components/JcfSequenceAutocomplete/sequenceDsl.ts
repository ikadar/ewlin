/**
 * Sequence DSL utilities for the JCF Sequence Autocomplete.
 *
 * Each line in the sequence textarea represents a production step.
 * Format: PosteName(duration) or PosteName(setup+run)
 * Example: G37(20+40), Stahl(35), ST:MCA(3j):dos carré collé
 *
 * @see implicit-logic-specification.md §5.1 (Sequence State Machine)
 */

/** Duration token: bare minutes, minutes with m, hours, hours+minutes (e.g. 20, 20m, 3h, 3h30, 3h30m) */
const DURATION = '(?:\\d+h\\d+m?|\\d+[hm]?|\\d+h)';

/** Poste line validation regex: Name(duration) or Name(setup+run) with optional time units */
const POSTE_REGEX = new RegExp(`^\\w+\\(${DURATION}(\\+${DURATION})?\\)$`);

/** ST line validation regex: ST:Name(duration):description — supports accented chars */
const ST_REGEX = /^ST:[\w\p{L}]+\(\d+[jh]?\):.+$/u;

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

/** Default duration suggestions for ST (sous-traitant) mode — day-based */
export const DEFAULT_ST_DURATIONS = ['1j', '2j', '3j', '4j', '5j'];

// ── Parsed line types ────────────────────────────────────────────────────────

export type SequenceStep =
  | 'poste'
  | 'st-prefix'
  | 'st-name'
  | 'st-duration'
  | 'st-description'
  | 'complete';

export interface ParsedLine {
  /** Current autocomplete step */
  step: SequenceStep;
  /** Text prefix before current search (used for value reconstruction) */
  prefix: string;
  /** Current search text for filtering suggestions */
  search: string;
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
 * - "st-prefix": starts with "st" (case-insensitive) → suggest "ST:" prefix
 * - "st-name": "ST:..." without `(` → suggest sous-traitant names
 * - "st-duration": "ST:Name(..." → suggest durations
 * - "st-description": "ST:Name(duration):..." → free text, no suggestions
 * - "complete": has `(...)` or poste with `(` → no suggestions
 */
export function parseLine(line: string): ParsedLine {
  // ST description: ST:Name(duration):... — typing free-text description
  // Must check before generic complete since ST desc also has (...)
  const stDescMatch = line.match(/^ST:[\w\p{L}]+\([^)]+\):(.*)$/iu);
  if (stDescMatch) {
    return {
      step: 'st-description',
      prefix: line.substring(0, line.length - stDescMatch[1].length),
      search: stDescMatch[1],
    };
  }

  // Complete: has parentheses with content and closing paren
  if (/\([^)]+\)/.test(line)) {
    return { step: 'complete', prefix: line, search: '' };
  }

  // ST patterns (must check before poste-duration since ST:Name( also has `(`)
  const stMatch = line.match(/^(ST:)(.*)$/i);
  if (stMatch) {
    const afterST = stMatch[2];

    // Inside parentheses (typing duration)
    const parenMatch = afterST.match(/^([\w\p{L}]+)\((.*)$/u);
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
  // No duration suggestions for postes (user types manually)
  const posteParenMatch = line.match(/^(\w+)\((.*)$/);
  if (posteParenMatch) {
    return {
      step: 'complete',
      prefix: line,
      search: '',
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

// ── Workflow utilities ────────────────────────────────────────────────────────

/**
 * Count completed actions (lines with closing parenthesis) before the cursor
 * to determine the current workflow step index.
 *
 * @param text - Full textarea value
 * @param cursorPos - Current cursor position
 * @returns Number of completed steps (0-indexed step to suggest)
 *
 * @example
 * // Empty text → step 0
 * getWorkflowStepIndex('', 0) // 0
 *
 * // One complete line, cursor on second line → step 1
 * getWorkflowStepIndex('G37(20)\nSta', 11) // 1
 *
 * // Two complete lines → step 2
 * getWorkflowStepIndex('G37(20)\nStahl(30)\n', 18) // 2
 */
export function getWorkflowStepIndex(text: string, cursorPos: number): number {
  const beforeCursor = text.substring(0, cursorPos);
  const lines = beforeCursor.split('\n');
  // Count lines that have a closing paren (completed actions)
  return lines.filter((line) => line.includes(')')).length;
}

/**
 * Get expected categories for the current workflow step.
 * Supports comma-separated multi-category per step.
 *
 * @param sequenceWorkflow - Workflow array (e.g., ['Presse offset, Presse numérique', 'Massicot'])
 * @param stepIndex - Current step index (from getWorkflowStepIndex)
 * @returns Array of expected category names, or empty array if no workflow or step exhausted
 *
 * @example
 * getExpectedCategories(['Presse offset'], 0) // ['Presse offset']
 * getExpectedCategories(['Presse offset, Presse numérique'], 0) // ['Presse offset', 'Presse numérique']
 * getExpectedCategories(['Presse offset'], 1) // [] (beyond workflow length)
 * getExpectedCategories([], 0) // [] (no workflow)
 */
export function getExpectedCategories(
  sequenceWorkflow: string[],
  stepIndex: number,
): string[] {
  if (
    sequenceWorkflow.length === 0 ||
    stepIndex < 0 ||
    stepIndex >= sequenceWorkflow.length
  ) {
    return [];
  }
  return sequenceWorkflow[stepIndex].split(',').map((c) => c.trim());
}
