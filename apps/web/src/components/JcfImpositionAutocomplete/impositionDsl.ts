/**
 * Imposition DSL utilities for the JCF Imposition Autocomplete field.
 *
 * DSL format: "LxH(poses)" (e.g., "50x70(8)")
 * Pretty display: "LxHcm Nposes/f" (e.g., "50x70cm 8poses/f")
 * Validation: regex /^[1-9]\d*x[1-9]\d*\([1-9]\d*\)$/i
 *
 * @see implicit-logic-specification.md §1.2 (Imposition format)
 */

// ── Structured parsing ──────────────────────────────────────────────────────

export interface ImpositionParts {
  width: number;
  height: number;
  poses: number;
}

/**
 * Parse a valid imposition DSL string into its component parts.
 * Returns null if the string is not a valid imposition.
 *
 * Examples:
 * - "50x70(8)" → { width: 50, height: 70, poses: 8 }
 * - "65x90(16)" → { width: 65, height: 90, poses: 16 }
 * - "invalid" → null
 */
export function parseImposition(value: string): ImpositionParts | null {
  const match = value.trim().match(/^(\d+)x(\d+)\((\d+)\)$/i);
  if (!match) return null;
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
    poses: parseInt(match[3], 10),
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate whether a string is a valid imposition DSL format.
 * Must match: LxH(N) where L, H, N are positive integers (no leading zeros).
 */
export function isValidImposition(value: string): boolean {
  return /^[1-9]\d*x[1-9]\d*\([1-9]\d*\)$/i.test(value.trim());
}

// ── Pretty display conversions ──────────────────────────────────────────────

/**
 * Convert DSL imposition to pretty display format.
 *
 * Examples:
 * - "50x70(8)" → "50x70cm 8poses/f"
 * - "65x90(16)" → "65x90cm 16poses/f"
 * - "" → ""
 * - "invalid" → "invalid" (returned as-is)
 */
export function toPrettyImposition(dsl: string): string {
  if (dsl === '') return '';

  const parsed = parseImposition(dsl);
  if (!parsed) return dsl;

  return `${parsed.width}x${parsed.height}cm ${parsed.poses}poses/f`;
}

/**
 * Convert pretty display back to DSL format.
 *
 * Examples:
 * - "50x70cm 8poses/f" → "50x70(8)"
 * - "65x90cm 16poses/f" → "65x90(16)"
 * - "50x70(8)" → "50x70(8)" (already DSL)
 * - "" → ""
 */
export function toDslImposition(pretty: string): string {
  if (pretty === '') return '';

  // Already in DSL format (contains parentheses)
  if (pretty.includes('(')) return pretty;

  // Match: LxHcm Nposes/f
  const match = pretty.match(/^(\d+x\d+)cm\s+(\d+)poses\/f$/i);
  if (match) {
    return `${match[1]}(${match[2]})`;
  }

  return pretty;
}

// ── Editing input parsing ───────────────────────────────────────────────────

export interface ImpositionInputParts {
  /** Sheet format string (before opening paren) */
  format: string;
  /** Poses string (after opening paren, without closing paren) */
  poses: string;
  /** Whether the user is in the poses-selection step */
  isTypingPoses: boolean;
}

/**
 * Parse editing input to detect whether user is typing a format or poses.
 * Uses the opening parenthesis `(` as the separator between the two steps.
 *
 * Examples:
 * - "50" → { format: "50", poses: "", isTypingPoses: false }
 * - "50x70(" → { format: "50x70", poses: "", isTypingPoses: true }
 * - "50x70(8" → { format: "50x70", poses: "8", isTypingPoses: true }
 * - "50x70(8)" → { format: "50x70", poses: "8", isTypingPoses: true }
 */
export function parseImpositionInput(input: string): ImpositionInputParts {
  const trimmed = input.trim();
  const parenIndex = trimmed.indexOf('(');

  if (parenIndex === -1) {
    return { format: trimmed, poses: '', isTypingPoses: false };
  }

  return {
    format: trimmed.substring(0, parenIndex),
    poses: trimmed.substring(parenIndex + 1).replace(')', ''),
    isTypingPoses: true,
  };
}

// ── Poses extraction ────────────────────────────────────────────────────────

/**
 * Extract poses count from various imposition formats.
 * Supports DSL, DSL with 'p' suffix, and pretty format.
 *
 * Examples:
 * - "50x70(8)" → 8
 * - "50x70(8p)" → 8
 * - "8 poses" → 8
 * - "50x70cm 8poses/f" → 8
 * - "invalid" → null
 */
export function extractPosesFromImposition(value: string): number | null {
  const trimmed = value.trim();

  // DSL format: LxH(N) or LxH(Np)
  const dslMatch = trimmed.match(/\((\d+)p?\)$/i);
  if (dslMatch) {
    return parseInt(dslMatch[1], 10);
  }

  // Pretty format: LxHcm Nposes/f
  const prettyMatch = trimmed.match(/(\d+)poses\/f$/i);
  if (prettyMatch) {
    return parseInt(prettyMatch[1], 10);
  }

  // Plain: "N poses"
  const plainMatch = trimmed.match(/^(\d+)\s*poses?$/i);
  if (plainMatch) {
    return parseInt(plainMatch[1], 10);
  }

  return null;
}
