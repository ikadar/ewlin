/**
 * Unit tests for JCF Required Field Logic (Level 2)
 *
 * @see requiredFields.ts
 */

import { describe, it, expect } from 'vitest';
import {
  hasElementContent,
  hasBlocSupportTrigger,
  hasBlocImpressionTrigger,
  getRequiredFields,
  getAllRequiredFields,
  hasRequiredIndicator,
} from './requiredFields';
import type { JcfElement } from './types';

// ── Test Helpers ──────────────────────────────────────────────────────────────

const emptyElement: JcfElement = {
  name: 'E1',
  precedences: '',
  quantite: '1',
  pagination: '',
  format: '',
  papier: '',
  impression: '',
  surfacage: '',
  autres: '',
  imposition: '',
  qteFeuilles: '',
  commentaires: '',
  sequence: '',
};

// ── hasElementContent ─────────────────────────────────────────────────────────

describe('hasElementContent', () => {
  it('returns false for completely empty element', () => {
    expect(hasElementContent(emptyElement)).toBe(false);
  });

  it('returns true if papier is filled', () => {
    expect(hasElementContent({ ...emptyElement, papier: 'Couché:135' })).toBe(true);
  });

  it('returns true if imposition is filled', () => {
    expect(hasElementContent({ ...emptyElement, imposition: '50x70(8)' })).toBe(true);
  });

  it('returns true if sequence is filled', () => {
    expect(hasElementContent({ ...emptyElement, sequence: 'G37(20)' })).toBe(true);
  });

  it('returns true if quantite is non-default', () => {
    expect(hasElementContent({ ...emptyElement, quantite: '2' })).toBe(true);
  });

  it('returns false if quantite is default "1"', () => {
    expect(hasElementContent({ ...emptyElement, quantite: '1' })).toBe(false);
  });
});

// ── hasBlocSupportTrigger ─────────────────────────────────────────────────────

describe('hasBlocSupportTrigger', () => {
  it('returns false for empty element', () => {
    expect(hasBlocSupportTrigger(emptyElement)).toBe(false);
  });

  it('returns true if imposition is filled', () => {
    expect(hasBlocSupportTrigger({ ...emptyElement, imposition: '50x70(8)' })).toBe(true);
  });

  it('returns true if impression is filled', () => {
    expect(hasBlocSupportTrigger({ ...emptyElement, impression: 'Q/Q' })).toBe(true);
  });

  it('returns true if surfacage is filled', () => {
    expect(hasBlocSupportTrigger({ ...emptyElement, surfacage: 'mat/mat' })).toBe(true);
  });

  it('returns true if format is filled', () => {
    expect(hasBlocSupportTrigger({ ...emptyElement, format: 'A4' })).toBe(true);
  });
});

// ── hasBlocImpressionTrigger ──────────────────────────────────────────────────

describe('hasBlocImpressionTrigger', () => {
  it('returns false for empty element', () => {
    expect(hasBlocImpressionTrigger(emptyElement)).toBe(false);
  });

  it('returns true if imposition is filled', () => {
    expect(hasBlocImpressionTrigger({ ...emptyElement, imposition: '50x70(8)' })).toBe(true);
  });

  it('returns true if impression is filled', () => {
    expect(hasBlocImpressionTrigger({ ...emptyElement, impression: 'Q/Q' })).toBe(true);
  });

  it('returns false if only surfacage is filled', () => {
    expect(hasBlocImpressionTrigger({ ...emptyElement, surfacage: 'mat/mat' })).toBe(false);
  });

  it('returns false if only format is filled', () => {
    expect(hasBlocImpressionTrigger({ ...emptyElement, format: 'A4' })).toBe(false);
  });
});

// ── getRequiredFields ─────────────────────────────────────────────────────────

describe('getRequiredFields', () => {
  describe('template mode', () => {
    it('returns empty array in template mode', () => {
      const element: JcfElement = { ...emptyElement, imposition: '50x70(8)' };
      expect(getRequiredFields(element, 0, 'template')).toHaveLength(0);
    });
  });

  describe('job mode - empty element', () => {
    it('returns empty array for completely empty element', () => {
      expect(getRequiredFields(emptyElement, 0, 'job')).toHaveLength(0);
    });
  });

  describe('job mode - sequence always required', () => {
    it('requires sequence if element has any content', () => {
      const element: JcfElement = { ...emptyElement, papier: 'Couché:135' };
      const required = getRequiredFields(element, 0, 'job');
      expect(required).toContainEqual({ elementIndex: 0, field: 'sequence' });
    });

    it('does not require sequence if already filled', () => {
      const element: JcfElement = { ...emptyElement, papier: 'Couché:135', sequence: 'G37(20)' };
      const required = getRequiredFields(element, 0, 'job');
      expect(required.find(r => r.field === 'sequence')).toBeUndefined();
    });
  });

  describe('job mode - BLOC SUPPORT trigger', () => {
    it('requires papier, pagination, format, qteFeuilles, imposition when imposition filled', () => {
      const element: JcfElement = { ...emptyElement, imposition: '50x70(8)' };
      const required = getRequiredFields(element, 0, 'job');

      expect(required).toContainEqual({ elementIndex: 0, field: 'papier' });
      expect(required).toContainEqual({ elementIndex: 0, field: 'pagination' });
      expect(required).toContainEqual({ elementIndex: 0, field: 'format' });
      expect(required).toContainEqual({ elementIndex: 0, field: 'qteFeuilles' });
      // imposition is already filled, so not required
      expect(required.find(r => r.field === 'imposition')).toBeUndefined();
    });

    it('requires all BLOC SUPPORT fields when format filled', () => {
      const element: JcfElement = { ...emptyElement, format: 'A4' };
      const required = getRequiredFields(element, 0, 'job');

      expect(required).toContainEqual({ elementIndex: 0, field: 'papier' });
      expect(required).toContainEqual({ elementIndex: 0, field: 'pagination' });
      expect(required).toContainEqual({ elementIndex: 0, field: 'qteFeuilles' });
      expect(required).toContainEqual({ elementIndex: 0, field: 'imposition' });
      // format is already filled
      expect(required.find(r => r.field === 'format')).toBeUndefined();
    });
  });

  describe('job mode - BLOC IMPRESSION trigger', () => {
    it('requires impression when imposition filled but impression empty', () => {
      const element: JcfElement = { ...emptyElement, imposition: '50x70(8)' };
      const required = getRequiredFields(element, 0, 'job');

      expect(required).toContainEqual({ elementIndex: 0, field: 'impression' });
    });

    it('does not require impression when already filled', () => {
      const element: JcfElement = { ...emptyElement, imposition: '50x70(8)', impression: 'Q/Q' };
      const required = getRequiredFields(element, 0, 'job');

      expect(required.find(r => r.field === 'impression')).toBeUndefined();
    });
  });

  describe('element index tracking', () => {
    it('tracks correct element index', () => {
      const element: JcfElement = { ...emptyElement, imposition: '50x70(8)' };
      const required = getRequiredFields(element, 5, 'job');

      required.forEach(r => {
        expect(r.elementIndex).toBe(5);
      });
    });
  });
});

// ── getAllRequiredFields ──────────────────────────────────────────────────────

describe('getAllRequiredFields', () => {
  it('returns empty map for empty elements in template mode', () => {
    const elements: JcfElement[] = [emptyElement];
    const result = getAllRequiredFields(elements, 'template');
    expect(result.size).toBe(0);
  });

  it('returns map with keys for required fields', () => {
    const elements: JcfElement[] = [
      { ...emptyElement, imposition: '50x70(8)' },
    ];
    const result = getAllRequiredFields(elements, 'job');

    expect(result.has('0-sequence')).toBe(true);
    expect(result.has('0-papier')).toBe(true);
    expect(result.has('0-impression')).toBe(true);
  });

  it('handles multiple elements', () => {
    const elements: JcfElement[] = [
      { ...emptyElement, imposition: '50x70(8)' },
      { ...emptyElement, format: 'A4' },
    ];
    const result = getAllRequiredFields(elements, 'job');

    expect(result.has('0-papier')).toBe(true);
    expect(result.has('1-papier')).toBe(true);
  });
});

// ── hasRequiredIndicator ──────────────────────────────────────────────────────

describe('hasRequiredIndicator', () => {
  it('returns true if required and no error', () => {
    const requiredMap = new Map([['0-papier', { elementIndex: 0, field: 'papier' as const }]]);
    const errorMap = new Map();

    expect(hasRequiredIndicator(requiredMap, errorMap, 0, 'papier')).toBe(true);
  });

  it('returns false if not required', () => {
    const requiredMap = new Map();
    const errorMap = new Map();

    expect(hasRequiredIndicator(requiredMap, errorMap, 0, 'papier')).toBe(false);
  });

  it('returns false if has error (error takes precedence)', () => {
    const requiredMap = new Map([['0-papier', { elementIndex: 0, field: 'papier' as const }]]);
    const errorMap = new Map([['0-papier', { elementIndex: 0, field: 'papier', message: 'error' }]]);

    expect(hasRequiredIndicator(requiredMap, errorMap, 0, 'papier')).toBe(false);
  });
});
