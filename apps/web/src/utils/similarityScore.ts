/**
 * Client-side port of the PHP {@link services/php-api/src/Service/SimilarityScoreCalculator.php}.
 *
 * Computes a practicity score between two consecutive jobs on a station. The
 * score is used:
 * - In Phase 2 to drive the tile badge on the planning grid (visual only).
 * - In Phase 3 to feed the operator algorithm's `compatibility_bonus` term.
 *
 * The TS and PHP implementations MUST stay in lockstep — the unit tests in
 * {@link ./similarityScore.test.ts} mirror the PHP truth tables
 * ({@link services/php-api/tests/Unit/Service/SimilarityScoreCalculatorTest.php}).
 * Any change to the algorithm requires updating both.
 *
 * Neutralization policy (stricter than the frontend `similarityUtils.ts`):
 * if either side has null / missing key / empty-after-trim for a criterion,
 * the criterion is NEUTRALIZED and any rule referencing it cannot fire.
 */

import type {
  ElementSpec,
  SimilarityCriterion,
  SimilarityScore,
  SimilarityScoreRule,
  StationCategory,
} from '@flux/types';
import { parsePapierDSL } from './papierDSL';
import { longSide } from './formatDSL';

/**
 * Enumerate every reachable non-zero score level given a rule set. The result
 * is sorted ascending and deduplicated. Drives the "N indicators per category"
 * badge rendering — one indicator per entry in the returned list, the nth
 * indicator lit when `score.points >= levels[n]`.
 *
 * Algorithm: split rules into non-grouped (each fires independently) and
 * per-group (only one rule per group can fire, best-in-group). Cartesian-
 * product every non-grouped on/off with every group's {none + each rule's
 * points}. Dedupe and filter > 0.
 *
 * Note: we enumerate as if format-descending rules could fire like any
 * other — physical exclusivity with their same-group equality rules is
 * ignored for the level set, but the actual `compute()` path still does the
 * right thing per transition. This keeps the level list simple and honest
 * about "what scores can legitimately appear".
 */
export function reachableLevels(rules: SimilarityScoreRule[]): number[] {
  if (rules.length === 0) return [];

  const nonGrouped: SimilarityScoreRule[] = [];
  const byGroup = new Map<string, SimilarityScoreRule[]>();
  for (const r of rules) {
    if (r.group === null || r.group === undefined) {
      nonGrouped.push(r);
    } else {
      const bucket = byGroup.get(r.group) ?? [];
      bucket.push(r);
      byGroup.set(r.group, bucket);
    }
  }

  // Subset sums of non-grouped rules (each either fires or not)
  let ngSums: number[] = [0];
  for (const r of nonGrouped) {
    ngSums = [...ngSums, ...ngSums.map((s) => s + r.points)];
  }

  // For each group, the possible contribution is 0 (none fires) or one rule's points
  const groupChoices: number[][] = [];
  for (const grp of byGroup.values()) {
    groupChoices.push([0, ...grp.map((r) => r.points)]);
  }

  // Cartesian product across all group choices
  let combos: number[] = [0];
  for (const choices of groupChoices) {
    const next: number[] = [];
    for (const combo of combos) {
      for (const c of choices) next.push(combo + c);
    }
    combos = next;
  }

  const all = new Set<number>();
  for (const ng of ngSums) {
    for (const c of combos) {
      all.add(ng + c);
    }
  }

  return [...all].filter((s) => s > 0).sort((a, b) => a - b);
}

type SpecInput = ElementSpec | Record<string, unknown> | null | undefined;
type MatchState = true | false; // true = MATCHED, false = UNMATCHED. Absent key = NEUTRALIZED.

export function computeSimilarityScore(
  prevSpec: SpecInput,
  currSpec: SpecInput,
  category: StationCategory,
): SimilarityScore {
  const rules = category.similarityScoreRules ?? [];

  if (rules.length === 0) {
    return {
      points: 0,
      maxPoints: 0,
      matchedRules: [],
      neutralizedCodes: [],
    };
  }

  const maxPoints = computeMaxPoints(rules);
  const criteria = category.similarityCriteria ?? [];

  if (prevSpec == null || currSpec == null) {
    return {
      points: 0,
      maxPoints,
      matchedRules: [],
      neutralizedCodes: criteria.map((c) => c.code),
    };
  }

  // Widen to Record for dynamic fieldPath lookup — ElementSpec has specific
  // typed keys but no index signature, which blocks `spec[fieldPath]` access.
  // At runtime this is always an object (validated by the null-check above).
  const prev = prevSpec as Record<string, unknown>;
  const curr = currSpec as Record<string, unknown>;

  const matchByCode = new Map<string, MatchState>();
  const neutralizedCodes: string[] = [];

  for (const criterion of criteria) {
    const state = resolveCriterionMatch(criterion, prev, curr);
    if (state === null) {
      neutralizedCodes.push(criterion.code);
    } else {
      matchByCode.set(criterion.code, state);
    }
  }

  const firedRules = rules.filter((r) => ruleFires(r, matchByCode, prev, curr));
  const keptRules = resolveGroups(firedRules);
  const points = keptRules.reduce((sum, r) => sum + r.points, 0);

  return {
    points,
    maxPoints,
    matchedRules: keptRules,
    neutralizedCodes,
  };
}

/**
 * Resolve whether a criterion matches between two specs.
 * Returns null = NEUTRALIZED, true = MATCHED, false = UNMATCHED.
 *
 * Special case: criteria with code `paper_type` or `paper_weight` share a
 * single `papier` fieldPath that is DSL-encoded (`"Type:grammage"`). The
 * calculator parses it and compares the right sub-field.
 */
function resolveCriterionMatch(
  criterion: SimilarityCriterion,
  prevSpec: Record<string, unknown>,  // validated non-null upstream
  currSpec: Record<string, unknown>,  // validated non-null upstream
): boolean | null {
  let prev: string | null;
  let curr: string | null;

  if (criterion.code === 'paper_type') {
    prev = extractParsedPapier(prevSpec, 'type');
    curr = extractParsedPapier(currSpec, 'type');
  } else if (criterion.code === 'paper_weight') {
    prev = extractParsedPapier(prevSpec, 'grammage');
    curr = extractParsedPapier(currSpec, 'grammage');
  } else {
    prev = extractRawField(prevSpec, criterion.fieldPath);
    curr = extractRawField(currSpec, criterion.fieldPath);
  }

  if (prev === null || curr === null) {
    return null;
  }

  return prev === curr;
}

/**
 * Extract a raw string field from a spec. Returns null if the field is
 * missing, null, or empty-after-trim.
 */
function extractRawField(spec: Record<string, unknown>, fieldPath: string): string | null {
  if (!(fieldPath in spec)) return null;
  const value = spec[fieldPath];
  if (value == null) return null;
  const str = typeof value === 'string' ? value : String(value);
  const trimmed = str.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Extract the `type` or `grammage` sub-field from a DSL-encoded `papier` value.
 * Returns null if papier is missing/empty or the requested sub-field resolves
 * to empty. The parser emits `'g'` alone when a colon is present with empty
 * grammage — we treat that as "no grammage info" rather than a real value.
 */
function extractParsedPapier(
  spec: Record<string, unknown>,
  subField: 'type' | 'grammage',
): string | null {
  const papier = spec['papier'];
  if (papier == null) return null;
  const str = typeof papier === 'string' ? papier : String(papier);
  if (str.trim() === '') return null;

  const parsed = parsePapierDSL(str);
  const value = parsed[subField];

  if (subField === 'grammage' && value === 'g') return null;
  return value === '' ? null : value;
}

function ruleFires(
  rule: SimilarityScoreRule,
  matchByCode: Map<string, MatchState>,
  prevSpec: Record<string, unknown>,
  currSpec: Record<string, unknown>,
): boolean {
  if (rule.kind === 'format-descending') {
    return isFormatDescending(prevSpec, currSpec);
  }
  for (const code of rule.criteriaCodes) {
    if (matchByCode.get(code) !== true) {
      return false;
    }
  }
  return true;
}

/**
 * Decide whether prev → curr is a strictly descending paper-format transition
 * (prev long side > curr long side). Returns false when either side is
 * unparseable — a directional rule should only fire with known dimensions.
 */
function isFormatDescending(
  prevSpec: Record<string, unknown>,
  currSpec: Record<string, unknown>,
): boolean {
  const prevFmt = typeof prevSpec['format'] === 'string' ? (prevSpec['format'] as string) : null;
  const currFmt = typeof currSpec['format'] === 'string' ? (currSpec['format'] as string) : null;
  const prevLong = longSide(prevFmt);
  const currLong = longSide(currFmt);
  if (prevLong === null || currLong === null) return false;
  return prevLong > currLong;
}

/**
 * Within each non-null group, keep only the highest-points firing rule.
 * Rules with group = null are all kept (they accumulate).
 */
function resolveGroups(firedRules: SimilarityScoreRule[]): SimilarityScoreRule[] {
  const nonGrouped: SimilarityScoreRule[] = [];
  const bestInGroup = new Map<string, SimilarityScoreRule>();

  for (const rule of firedRules) {
    if (rule.group === null) {
      nonGrouped.push(rule);
      continue;
    }
    const current = bestInGroup.get(rule.group);
    if (current === undefined || current.points < rule.points) {
      bestInGroup.set(rule.group, rule);
    }
  }

  return [...nonGrouped, ...bestInGroup.values()];
}

/**
 * Theoretical ceiling of a rule set: Σ points of non-grouped rules +
 * Σ best-points-per-group. Used for UI normalization (fraction / percent).
 */
function computeMaxPoints(rules: SimilarityScoreRule[]): number {
  const bestInGroup = new Map<string, number>();
  let nonGroupedSum = 0;

  for (const rule of rules) {
    if (rule.group === null) {
      nonGroupedSum += rule.points;
      continue;
    }
    const current = bestInGroup.get(rule.group);
    if (current === undefined || current < rule.points) {
      bestInGroup.set(rule.group, rule.points);
    }
  }

  let groupedSum = 0;
  for (const points of bestInGroup.values()) {
    groupedSum += points;
  }

  return nonGroupedSum + groupedSum;
}
