/**
 * Unit tests for JCF Calculated Fields
 *
 * @see calculatedFields.ts
 */

import { describe, it, expect } from 'vitest';
import {
  extractPosesFromImposition,
  calculateQteFeuilles,
  calculateQteFeuillesFromStrings,
} from './calculatedFields';

// ── extractPosesFromImposition ────────────────────────────────────────────────

describe('extractPosesFromImposition', () => {
  describe('empty/null cases', () => {
    it('returns null for empty string', () => {
      expect(extractPosesFromImposition('')).toBeNull();
    });

    it('returns null for string without poses pattern', () => {
      expect(extractPosesFromImposition('50x70')).toBeNull();
      expect(extractPosesFromImposition('abc')).toBeNull();
    });
  });

  describe('DSL format', () => {
    it('parses 50x70(8) → 8', () => {
      expect(extractPosesFromImposition('50x70(8)')).toBe(8);
    });

    it('parses 50x70(8p) → 8', () => {
      expect(extractPosesFromImposition('50x70(8p)')).toBe(8);
    });

    it('parses 65x90(16) → 16', () => {
      expect(extractPosesFromImposition('65x90(16)')).toBe(16);
    });

    it('parses 65x90(16p) → 16', () => {
      expect(extractPosesFromImposition('65x90(16p)')).toBe(16);
    });

    it('parses A3(4p) → 4', () => {
      expect(extractPosesFromImposition('A3(4p)')).toBe(4);
    });

    it('parses 70x100(32) → 32', () => {
      expect(extractPosesFromImposition('70x100(32)')).toBe(32);
    });
  });

  describe('pretty format', () => {
    it('parses "8 poses" → 8', () => {
      expect(extractPosesFromImposition('8 poses')).toBe(8);
    });

    it('parses "16 pose" → 16', () => {
      expect(extractPosesFromImposition('16 pose')).toBe(16);
    });

    it('parses "4poses" → 4 (no space)', () => {
      expect(extractPosesFromImposition('4poses')).toBe(4);
    });

    it('parses "32 Poses" → 32 (case insensitive)', () => {
      expect(extractPosesFromImposition('32 Poses')).toBe(32);
    });
  });
});

// ── calculateQteFeuilles ──────────────────────────────────────────────────────

describe('calculateQteFeuilles', () => {
  describe('basic calculation', () => {
    it('calculates ceil((1000 × 1) / 8) = 125', () => {
      expect(calculateQteFeuilles(1000, 1, 8)).toBe('125');
    });

    it('calculates ceil((1000 × 2) / 8) = 250', () => {
      expect(calculateQteFeuilles(1000, 2, 8)).toBe('250');
    });

    it('calculates ceil((500 × 1) / 4) = 125', () => {
      expect(calculateQteFeuilles(500, 1, 4)).toBe('125');
    });
  });

  describe('ceiling behavior', () => {
    it('rounds up for non-exact division: ceil((100 × 1) / 8) = 13', () => {
      expect(calculateQteFeuilles(100, 1, 8)).toBe('13'); // 100/8 = 12.5 → 13
    });

    it('rounds up for 1001: ceil((1001 × 1) / 8) = 126', () => {
      expect(calculateQteFeuilles(1001, 1, 8)).toBe('126'); // 1001/8 = 125.125 → 126
    });
  });

  describe('edge cases', () => {
    it('returns null for zero jobQuantity', () => {
      expect(calculateQteFeuilles(0, 1, 8)).toBeNull();
    });

    it('returns null for zero elementQuantity', () => {
      expect(calculateQteFeuilles(1000, 0, 8)).toBeNull();
    });

    it('returns null for zero poses', () => {
      expect(calculateQteFeuilles(1000, 1, 0)).toBeNull();
    });

    it('returns null for negative values', () => {
      expect(calculateQteFeuilles(-1000, 1, 8)).toBeNull();
      expect(calculateQteFeuilles(1000, -1, 8)).toBeNull();
      expect(calculateQteFeuilles(1000, 1, -8)).toBeNull();
    });
  });
});

// ── calculateQteFeuillesFromStrings ───────────────────────────────────────────

describe('calculateQteFeuillesFromStrings', () => {
  describe('basic calculation', () => {
    it('calculates from string inputs', () => {
      expect(calculateQteFeuillesFromStrings('1000', '1', '50x70(8)')).toBe('125');
    });

    it('uses default elementQuantity of 1', () => {
      expect(calculateQteFeuillesFromStrings('1000', '', '50x70(8)')).toBe('125');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty jobQuantity', () => {
      expect(calculateQteFeuillesFromStrings('', '1', '50x70(8)')).toBeNull();
    });

    it('returns null for zero jobQuantity', () => {
      expect(calculateQteFeuillesFromStrings('0', '1', '50x70(8)')).toBeNull();
    });

    it('returns null for invalid imposition', () => {
      expect(calculateQteFeuillesFromStrings('1000', '1', '50x70')).toBeNull();
    });

    it('returns null for empty imposition', () => {
      expect(calculateQteFeuillesFromStrings('1000', '1', '')).toBeNull();
    });
  });

  describe('complex scenarios', () => {
    it('handles pretty format imposition', () => {
      expect(calculateQteFeuillesFromStrings('1000', '1', '8 poses')).toBe('125');
    });

    it('handles element multiplier', () => {
      expect(calculateQteFeuillesFromStrings('1000', '3', '50x70(8)')).toBe('375');
    });
  });
});
