/**
 * Parser/validator for the Job.inking DSL.
 *
 * Mirror of services/php-api/src/Service/InkingDsl.php — keep grammar in sync.
 *
 * Grammar (V1, 2026-05-21):
 *   <inking>      ::= '' | <side> '/' <side>
 *   <side>        ::= '' | <token> (',' <token>)*
 *   <token>       ::= 'Q' | 'N' | <named-color>
 *   <named-color> ::= any trimmed string with no '/' or ',' and ≥ 1 char
 *
 * Semantics:
 *   - `Q` = quadri (counts as 4 colors)
 *   - `N` = noir (1 color)
 *   - anything else = named color (Pantone, custom mix, …) — 1 color each
 *   - Empty string = no spec
 *
 * Not enforced as automatic input validation yet — utility for future edit
 * surfaces (JCF inking field, MasterPrint aggregation).
 */

export const TOKEN_QUADRI = 'Q';
export const TOKEN_BLACK = 'N';
export const COLORS_PER_QUADRI = 4;

export type InkingSide = readonly string[];

export interface ParsedInking {
  readonly recto: InkingSide;
  readonly verso: InkingSide;
}

export class InkingDslError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InkingDslError';
  }
}

/**
 * Parse an inking DSL string into a structured form.
 * Returns null when value is null/empty (no spec). Throws on malformed input.
 */
export function parseInking(value: string | null | undefined): ParsedInking | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const slashCount = (trimmed.match(/\//g) ?? []).length;
  if (slashCount !== 1) {
    throw new InkingDslError(
      `Inking DSL must contain exactly one '/' separating recto from verso (got ${slashCount}): '${trimmed}'`,
    );
  }
  const idx = trimmed.indexOf('/');
  const rectoRaw = trimmed.slice(0, idx);
  const versoRaw = trimmed.slice(idx + 1);
  return { recto: parseSide(rectoRaw), verso: parseSide(versoRaw) };
}

/** Boolean check — never throws. */
export function isValidInking(value: string | null | undefined): boolean {
  try {
    parseInking(value);
    return true;
  } catch (e) {
    if (e instanceof InkingDslError) return false;
    throw e;
  }
}

/**
 * Count how many ink colors a side represents.
 * `Q` → 4, `N` → 1, named → 1. Empty side → 0.
 */
export function countColors(tokens: InkingSide): number {
  let n = 0;
  for (const t of tokens) {
    n += t === TOKEN_QUADRI ? COLORS_PER_QUADRI : 1;
  }
  return n;
}

/** Round-trip: format a parsed spec back into its DSL string. */
export function formatInking(spec: ParsedInking): string {
  const recto = spec.recto.map((t) => t.trim()).join(', ');
  const verso = spec.verso.map((t) => t.trim()).join(', ');
  return `${recto}/${verso}`;
}

function parseSide(raw: string): InkingSide {
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  const out: string[] = [];
  for (const piece of trimmed.split(',')) {
    const t = piece.trim();
    if (t === '') {
      throw new InkingDslError(
        `Inking DSL has an empty color token (consecutive ',' or ', ,'): '${trimmed}'`,
      );
    }
    out.push(t);
  }
  return out;
}
