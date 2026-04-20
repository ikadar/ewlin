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
  SimilarityCriterion,
  SimilarityScore,
  SimilarityScoreRule,
  StationCategory,
} from '@flux/types';
import { parsePapierDSL } from './papierDSL';

type ElementSpec = Record<string, unknown> | null | undefined;
type MatchState = true | false; // true = MATCHED, false = UNMATCHED. Absent key = NEUTRALIZED.

export function computeSimilarityScore(
  prevSpec: ElementSpec,
  currSpec: ElementSpec,
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

  const matchByCode = new Map<string, MatchState>();
  const neutralizedCodes: string[] = [];

  for (const criterion of criteria) {
    const state = resolveCriterionMatch(criterion, prevSpec, currSpec);
    if (state === null) {
      neutralizedCodes.push(criterion.code);
    } else {
      matchByCode.set(criterion.code, state);
    }
  }

  const firedRules = rules.filter((r) => ruleFires(r, matchByCode));
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
  prevSpec: Record<string, unknown>,
  currSpec: Record<string, unknown>,
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

function ruleFires(rule: SimilarityScoreRule, matchByCode: Map<string, MatchState>): boolean {
  for (const code of rule.criteriaCodes) {
    if (matchByCode.get(code) !== true) {
      return false;
    }
  }
  return true;
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
