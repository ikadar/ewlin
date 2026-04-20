/**
 * Mirror of {@link services/php-api/tests/Unit/Service/SimilarityScoreCalculatorTest.php}.
 *
 * Every truth-table case below MUST also exist in the PHP sibling (and vice
 * versa) so the TS and PHP implementations stay in lockstep. If you change
 * one side, update the other — otherwise the frontend badge and the backend
 * endpoint would disagree on the same pair.
 */

import { describe, it, expect } from 'vitest';
import type { StationCategory } from '@flux/types';
import { computeSimilarityScore, reachableLevels } from './similarityScore';

function makeOffsetCategory(): StationCategory {
  return {
    id: 'cat-offset',
    name: 'Presses Offset',
    similarityCriteria: [
      { code: 'paper_type', name: 'Même type de papier', fieldPath: 'papier' },
      { code: 'paper_format', name: 'Même format', fieldPath: 'format' },
      { code: 'inking', name: 'Même encrage', fieldPath: 'impression' },
    ],
    similarityScoreRules: [
      { criteriaCodes: ['inking'], points: 4, group: null },
      { criteriaCodes: ['paper_type', 'paper_format'], points: 3, group: 'paper' },
      { criteriaCodes: ['paper_format'], points: 2, group: 'paper' },
      { criteriaCodes: ['paper_format'], points: 1, group: 'paper', kind: 'format-descending' },
    ],
  };
}

function makePelliculeusesCategory(): StationCategory {
  return {
    id: 'cat-pell',
    name: 'Pelliculeuses',
    similarityCriteria: [
      { code: 'paper_type', name: 'Même type de papier', fieldPath: 'papier' },
      { code: 'paper_format', name: 'Même format', fieldPath: 'format' },
    ],
    similarityScoreRules: [
      { criteriaCodes: ['paper_format'], points: 1, group: 'paper' },
      { criteriaCodes: ['paper_type', 'paper_format'], points: 3, group: 'paper' },
      { criteriaCodes: ['paper_type'], points: 0.5, group: 'paper' },
    ],
  };
}

function makeMassicotsCategory(): StationCategory {
  return {
    id: 'cat-mass',
    name: 'Massicots',
    similarityCriteria: [
      { code: 'paper_format', name: 'Même format', fieldPath: 'format' },
    ],
    similarityScoreRules: [
      { criteriaCodes: ['paper_format'], points: 1, group: null },
    ],
  };
}

function makeFinitionCategory(): StationCategory {
  return {
    id: 'cat-finition',
    name: 'Plieuses',
    similarityCriteria: [
      { code: 'paper_weight', name: 'Même grammage', fieldPath: 'papier' },
      { code: 'paper_format', name: 'Même format', fieldPath: 'format' },
    ],
    similarityScoreRules: [
      { criteriaCodes: ['paper_format'], points: 1, group: 'paper' },
      { criteriaCodes: ['paper_weight', 'paper_format'], points: 3, group: 'paper' },
    ],
  };
}

describe('reachableLevels', () => {
  it('Offset with R4: enumerates 7 levels', () => {
    const offset = makeOffsetCategory();
    expect(reachableLevels(offset.similarityScoreRules)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('Pelliculeuses: 3 levels including the 0.5 fractional', () => {
    const pell = makePelliculeusesCategory();
    expect(reachableLevels(pell.similarityScoreRules)).toEqual([0.5, 1, 3]);
  });

  it('Massicots: single level', () => {
    const mass = makeMassicotsCategory();
    expect(reachableLevels(mass.similarityScoreRules)).toEqual([1]);
  });

  it('Finition: 2 levels', () => {
    const fin = makeFinitionCategory();
    expect(reachableLevels(fin.similarityScoreRules)).toEqual([1, 3]);
  });

  it('empty rule set: no reachable levels', () => {
    expect(reachableLevels([])).toEqual([]);
  });
});

describe('computeSimilarityScore — Offset truth table (max = 7)', () => {
  const cat = makeOffsetCategory();
  // Base uses A4 (smaller) so different-format cases default to ASCENDING
  // (A4 → A3) and never trigger R4 — directional rule covered separately below.
  const base = { papier: 'Couché mat:135', format: 'A4', impression: 'CMYK' };

  it.each([
    ['all different (ascending)',   { papier: 'Offset:120',    format: 'A3', impression: 'NB'   }, 0],
    ['pf only',                     { papier: 'Offset:120',    format: 'A4', impression: 'NB'   }, 2],
    ['pt only (ascending)',         { papier: 'Couché mat:200', format: 'A3', impression: 'NB'   }, 0],
    ['pt+pf (R2 wins over R3)',     { papier: 'Couché mat:200', format: 'A4', impression: 'NB'   }, 3],
    ['ink only (ascending)',        { papier: 'Offset:120',    format: 'A3', impression: 'CMYK' }, 4],
    ['ink + pf',                    { papier: 'Offset:120',    format: 'A4', impression: 'CMYK' }, 6],
    ['ink + pt (ascending)',        { papier: 'Couché mat:200', format: 'A3', impression: 'CMYK' }, 4],
    ['all match',                   { papier: 'Couché mat:135', format: 'A4', impression: 'CMYK' }, 7],
  ])('%s', (_label, curr, expected) => {
    const score = computeSimilarityScore(base, curr, cat);
    expect(score.points).toBe(expected);
    expect(score.maxPoints).toBe(7);
  });
});

describe('computeSimilarityScore — Offset directional rule R4 (format-descending)', () => {
  const cat = makeOffsetCategory();

  it.each([
    ['desc only, no ink',
     { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' },
     { papier: 'Offset:120',    format: 'A4', impression: 'NB' }, 1],
    ['desc + ink',
     { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' },
     { papier: 'Offset:120',    format: 'A4', impression: 'CMYK' }, 5],
    ['desc + pt match, no ink',
     { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' },
     { papier: 'Couché mat:200', format: 'A4', impression: 'NB' }, 1],
    ['desc + pt + ink',
     { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' },
     { papier: 'Couché mat:200', format: 'A4', impression: 'CMYK' }, 5],
    ['numeric desc 64x90 → 50x70',
     { papier: 'Offset:90',  format: '64x90', impression: 'NB' },
     { papier: 'Couché:80',  format: '50x70', impression: 'Q/Q' }, 1],
    ['SRA3 → A3',
     { papier: 'Couché:135', format: 'SRA3', impression: 'CMYK' },
     { papier: 'Offset:80',  format: 'A3',   impression: 'NB' }, 1],
    ['same format A4, different rest',
     { papier: 'Couché:135', format: 'A4', impression: 'CMYK' },
     { papier: 'Offset:80',  format: 'A4', impression: 'NB' }, 2],
    ['desc with garbage curr format',
     { papier: 'Couché:135', format: 'A3',    impression: 'CMYK' },
     { papier: 'Offset:80',  format: 'pouet', impression: 'NB' }, 0],
  ])('%s', (_label, prev, curr, expected) => {
    const score = computeSimilarityScore(prev, curr, cat);
    expect(score.points).toBe(expected);
    expect(score.maxPoints).toBe(7);
  });
});

describe('computeSimilarityScore — Pelliculeuses truth table (max = 3)', () => {
  const cat = makePelliculeusesCategory();
  const base = { papier: 'Couché mat', format: 'A3' };

  it.each([
    ['all different',  { papier: 'Offset', format: 'A4' },   0],
    ['pf only',        { papier: 'Offset', format: 'A3' },   1],
    ['pt only (0.5)',  { papier: 'Couché mat', format: 'A4' }, 0.5],
    ['pt+pf (R_PTPF)', { papier: 'Couché mat', format: 'A3' }, 3],
  ])('%s', (_label, curr, expected) => {
    const score = computeSimilarityScore(base, curr, cat);
    expect(score.points).toBe(expected);
    expect(score.maxPoints).toBe(3);
  });
});

describe('computeSimilarityScore — Massicots truth table (max = 1)', () => {
  const cat = makeMassicotsCategory();

  it.each([
    ['different format', { format: 'A3' }, { format: 'A4' }, 0],
    ['same format',      { format: 'A3' }, { format: 'A3' }, 1],
  ])('%s', (_label, prev, curr, expected) => {
    const score = computeSimilarityScore(prev, curr, cat);
    expect(score.points).toBe(expected);
    expect(score.maxPoints).toBe(1);
  });
});

describe('computeSimilarityScore — Finition truth table (max = 3)', () => {
  const cat = makeFinitionCategory();
  const base = { papier: 'Couché mat:135', format: 'A3' };

  it.each([
    ['all different',       { papier: 'Offset:200', format: 'A4' }, 0],
    ['pf only',             { papier: 'Offset:200', format: 'A3' }, 1],
    ['pw only (→ 0)',       { papier: 'Offset:135', format: 'A4' }, 0],
    ['pw+pf (R_PWPF wins)', { papier: 'Offset:135', format: 'A3' }, 3],
  ])('%s', (_label, curr, expected) => {
    const score = computeSimilarityScore(base, curr, cat);
    expect(score.points).toBe(expected);
    expect(score.maxPoints).toBe(3);
  });
});

describe('computeSimilarityScore — neutralization', () => {
  it('both specs null: all criteria neutralized', () => {
    const score = computeSimilarityScore(null, null, makeOffsetCategory());

    expect(score.points).toBe(0);
    expect(score.maxPoints).toBe(7);
    expect(score.matchedRules).toEqual([]);
    expect(score.neutralizedCodes.sort()).toEqual(['inking', 'paper_format', 'paper_type']);
  });

  it('prev spec null: all criteria neutralized', () => {
    const score = computeSimilarityScore(
      null,
      { papier: 'Couché:135', format: 'A3' },
      makeOffsetCategory(),
    );
    expect(score.points).toBe(0);
    expect(score.neutralizedCodes).toHaveLength(3);
  });

  it('missing impression neutralizes the inking criterion (both sides)', () => {
    const prev = { papier: 'Couché mat:135', format: 'A3' };
    const curr = { papier: 'Couché mat:135', format: 'A3' };
    const score = computeSimilarityScore(prev, curr, makeOffsetCategory());

    expect(score.points).toBe(3); // R2 wins in "paper" group; R1 can't fire
    expect(score.neutralizedCodes).toEqual(['inking']);
  });

  it('empty string treated as neutralized', () => {
    const prev = { papier: 'Couché mat:135', format: 'A3', impression: '' };
    const curr = { papier: 'Couché mat:135', format: 'A3', impression: '' };
    const score = computeSimilarityScore(prev, curr, makeOffsetCategory());

    expect(score.points).toBe(3);
    expect(score.neutralizedCodes).toEqual(['inking']);
  });

  it('one side missing a field neutralizes the criterion', () => {
    const prev = { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' };
    const curr = { papier: 'Couché mat:135', format: 'A3' };
    const score = computeSimilarityScore(prev, curr, makeOffsetCategory());

    expect(score.points).toBe(3);
    expect(score.neutralizedCodes).toEqual(['inking']);
  });

  it('papier without grammage neutralizes paper_weight on Finition', () => {
    const prev = { papier: 'Couché mat', format: 'A3' };
    const curr = { papier: 'Couché mat', format: 'A3' };
    const score = computeSimilarityScore(prev, curr, makeFinitionCategory());

    // paper_weight neutralized; only paper_format matches → R_PF fires = 1
    expect(score.points).toBe(1);
    expect(score.neutralizedCodes).toEqual(['paper_weight']);
  });

  it('papier with colon but empty grammage ("Couché:") neutralizes paper_weight', () => {
    const prev = { papier: 'Couché:', format: 'A3' };
    const curr = { papier: 'Couché:', format: 'A3' };
    const score = computeSimilarityScore(prev, curr, makeFinitionCategory());

    expect(score.points).toBe(1);
    expect(score.neutralizedCodes).toEqual(['paper_weight']);
  });
});

describe('computeSimilarityScore — edge cases', () => {
  it('category without rules returns zero even when specs match', () => {
    const cat: StationCategory = {
      id: 'cat-typo',
      name: 'Typographie',
      similarityCriteria: [],
      similarityScoreRules: [],
    };
    const score = computeSimilarityScore(
      { papier: 'Couché:135', format: 'A3' },
      { papier: 'Couché:135', format: 'A3' },
      cat,
    );

    expect(score.points).toBe(0);
    expect(score.maxPoints).toBe(0);
    expect(score.matchedRules).toEqual([]);
  });

  it('matched rules returned on success (Offset)', () => {
    const prev = { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' };
    const curr = { papier: 'Couché mat:135', format: 'A3', impression: 'CMYK' };
    const score = computeSimilarityScore(prev, curr, makeOffsetCategory());

    expect(score.matchedRules).toHaveLength(2); // R1 + R2 (R3 dropped by group resolution)
    const pointsKept = score.matchedRules.map((r: { points: number }) => r.points).sort();
    expect(pointsKept).toEqual([3, 4]);
  });

  it('group resolution keeps only the highest firing rule (Pelliculeuses all-match)', () => {
    // All 3 pellic rules fire: R_PTPF (3), R_PF (1), R_PT (0.5) — same group
    const prev = { papier: 'Couché mat', format: 'A3' };
    const curr = { papier: 'Couché mat', format: 'A3' };
    const score = computeSimilarityScore(prev, curr, makePelliculeusesCategory());

    expect(score.matchedRules).toHaveLength(1);
    expect(score.matchedRules[0].points).toBe(3);
  });
});
