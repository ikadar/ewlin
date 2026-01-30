/**
 * Unit tests for JCF Elements Table validation utilities
 *
 * @see validation.ts
 */

import { describe, it, expect } from 'vitest';
import {
  isValidPagination,
  isValidPapier,
  isValidImposition,
  isValidImpression,
  isValidSurfacage,
  isValidFormat,
  isValidSequenceLenient,
  isValidSequenceStrict,
  validateElementLive,
  validateAllElements,
  getCellError,
  validateForSubmit,
  validateAllForSubmit,
} from './validation';
import type { JcfElement } from './types';

// ── Pagination Validation ─────────────────────────────────────────────────────

describe('isValidPagination', () => {
  it('returns true for empty value', () => {
    expect(isValidPagination('')).toBe(true);
  });

  it('returns true for feuillet (2)', () => {
    expect(isValidPagination('2')).toBe(true);
  });

  it('returns true for cahier multiples of 4', () => {
    expect(isValidPagination('4')).toBe(true);
    expect(isValidPagination('8')).toBe(true);
    expect(isValidPagination('12')).toBe(true);
    expect(isValidPagination('16')).toBe(true);
    expect(isValidPagination('32')).toBe(true);
  });

  it('returns false for invalid pagination values', () => {
    expect(isValidPagination('1')).toBe(false);
    expect(isValidPagination('3')).toBe(false);
    expect(isValidPagination('5')).toBe(false);
    expect(isValidPagination('6')).toBe(false);
    expect(isValidPagination('7')).toBe(false);
    expect(isValidPagination('10')).toBe(false);
  });

  it('returns false for non-numeric input', () => {
    expect(isValidPagination('abc')).toBe(false);
    // Note: '4a' parses to 4 via parseInt, so it's valid (lenient parsing)
  });
});

// ── Papier Validation ─────────────────────────────────────────────────────────

describe('isValidPapier', () => {
  it('returns true for empty value', () => {
    expect(isValidPapier('')).toBe(true);
  });

  it('returns true for valid papier DSL with colon', () => {
    expect(isValidPapier('Couché:135')).toBe(true);
    expect(isValidPapier('Offset:80')).toBe(true);
    expect(isValidPapier('Bristol:250')).toBe(true);
  });

  it('returns false for papier without colon', () => {
    expect(isValidPapier('Couché135')).toBe(false);
    expect(isValidPapier('Offset')).toBe(false);
  });
});

// ── Imposition Validation ─────────────────────────────────────────────────────

describe('isValidImposition', () => {
  it('returns true for empty value', () => {
    expect(isValidImposition('')).toBe(true);
  });

  it('returns true for valid imposition with poses', () => {
    expect(isValidImposition('50x70(8)')).toBe(true);
    expect(isValidImposition('65x90(16)')).toBe(true);
    expect(isValidImposition('70x100(32)')).toBe(true);
  });

  it('returns true for valid imposition with poses and p suffix', () => {
    expect(isValidImposition('50x70(8p)')).toBe(true);
    expect(isValidImposition('65x90(16p)')).toBe(true);
  });

  it('returns false for imposition without poses', () => {
    expect(isValidImposition('50x70')).toBe(false);
    expect(isValidImposition('65x90()')).toBe(false);
    expect(isValidImposition('65x90(abc)')).toBe(false);
  });
});

// ── Impression Validation ─────────────────────────────────────────────────────

describe('isValidImpression', () => {
  it('returns true for empty value', () => {
    expect(isValidImpression('')).toBe(true);
  });

  it('returns true for valid impression with slash', () => {
    expect(isValidImpression('Q/Q')).toBe(true);
    expect(isValidImpression('CMJN/CMJN')).toBe(true);
    expect(isValidImpression('Q/')).toBe(true);
    expect(isValidImpression('/Q')).toBe(true);
  });

  it('returns false for impression without slash', () => {
    expect(isValidImpression('Q')).toBe(false);
    expect(isValidImpression('CMJN')).toBe(false);
  });
});

// ── Surfacage Validation ──────────────────────────────────────────────────────

describe('isValidSurfacage', () => {
  it('returns true for empty value', () => {
    expect(isValidSurfacage('')).toBe(true);
  });

  it('returns true for valid surfacage with slash', () => {
    expect(isValidSurfacage('mat/mat')).toBe(true);
    expect(isValidSurfacage('brillant/brillant')).toBe(true);
    expect(isValidSurfacage('brillant/')).toBe(true);
    expect(isValidSurfacage('vernis/')).toBe(true);
  });

  it('returns false for surfacage without slash', () => {
    expect(isValidSurfacage('mat')).toBe(false);
    expect(isValidSurfacage('brillant')).toBe(false);
  });
});

// ── Format Validation ─────────────────────────────────────────────────────────

describe('isValidFormat', () => {
  it('returns true for empty value', () => {
    expect(isValidFormat('')).toBe(true);
  });

  it('returns true for ISO formats A0-A10', () => {
    expect(isValidFormat('A0')).toBe(true);
    expect(isValidFormat('A4')).toBe(true);
    expect(isValidFormat('A3')).toBe(true);
    expect(isValidFormat('A10')).toBe(true);
  });

  it('returns true for ISO formats with f/fi suffix', () => {
    expect(isValidFormat('A4f')).toBe(true);
    expect(isValidFormat('A4fi')).toBe(true);
    expect(isValidFormat('A3f')).toBe(true);
    expect(isValidFormat('A3fi')).toBe(true);
  });

  it('returns true for custom LxH formats', () => {
    expect(isValidFormat('210x297')).toBe(true);
    expect(isValidFormat('100x200')).toBe(true);
    expect(isValidFormat('420x594')).toBe(true);
  });

  it('returns true for custom formats with f/fi suffix', () => {
    expect(isValidFormat('210x297f')).toBe(true);
    expect(isValidFormat('210x297fi')).toBe(true);
  });

  it('returns true for composite formats', () => {
    expect(isValidFormat('A3/A6')).toBe(true);
    expect(isValidFormat('A4/A5')).toBe(true);
    expect(isValidFormat('210x297/100x150')).toBe(true);
  });

  it('returns false for invalid formats', () => {
    expect(isValidFormat('A11')).toBe(false);
    expect(isValidFormat('B4')).toBe(false);
    expect(isValidFormat('210')).toBe(false);
    expect(isValidFormat('invalid')).toBe(false);
  });
});

// ── Sequence Validation (Lenient) ─────────────────────────────────────────────

describe('isValidSequenceLenient', () => {
  it('returns true for empty value', () => {
    expect(isValidSequenceLenient('')).toBe(true);
  });

  it('returns true for valid sequence lines', () => {
    expect(isValidSequenceLenient('G37(20)')).toBe(true);
    expect(isValidSequenceLenient('Komori(20+40)')).toBe(true);
    expect(isValidSequenceLenient('ST:Reliure(3j):desc')).toBe(true);
  });

  it('returns true for incomplete lines (no closing paren)', () => {
    // These are considered "in progress" and not flagged
    expect(isValidSequenceLenient('G37(')).toBe(true);
    expect(isValidSequenceLenient('Komori(20')).toBe(true);
    expect(isValidSequenceLenient('ST:')).toBe(true);
  });

  it('returns false for complete but invalid lines', () => {
    expect(isValidSequenceLenient('G37()')).toBe(false);
    expect(isValidSequenceLenient('(20)')).toBe(false);
  });
});

// ── Sequence Validation (Strict) ──────────────────────────────────────────────

describe('isValidSequenceStrict', () => {
  it('returns true for empty value', () => {
    expect(isValidSequenceStrict('')).toBe(true);
  });

  it('returns true for valid sequence lines', () => {
    expect(isValidSequenceStrict('G37(20)')).toBe(true);
    expect(isValidSequenceStrict('Komori(20+40)')).toBe(true);
  });

  it('returns false for incomplete lines in strict mode', () => {
    expect(isValidSequenceStrict('G37(')).toBe(false);
    expect(isValidSequenceStrict('Komori(20')).toBe(false);
  });

  it('returns false for invalid lines', () => {
    expect(isValidSequenceStrict('G37()')).toBe(false);
    expect(isValidSequenceStrict('(20)')).toBe(false);
  });
});

// ── validateElementLive ───────────────────────────────────────────────────────

describe('validateElementLive', () => {
  const baseElement: JcfElement = {
    name: 'E1',
    precedences: '',
    quantite: '',
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

  it('returns empty array for valid element', () => {
    const element: JcfElement = {
      ...baseElement,
      pagination: '4',
      papier: 'Couché:135',
      imposition: '50x70(8)',
      impression: 'Q/Q',
      surfacage: 'mat/mat',
      format: 'A4',
      sequence: 'G37(20)',
    };
    expect(validateElementLive(element, 0)).toHaveLength(0);
  });

  it('returns error for invalid pagination', () => {
    const element: JcfElement = { ...baseElement, pagination: '3' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('pagination');
    expect(errors[0].elementIndex).toBe(0);
  });

  it('returns error for invalid papier', () => {
    const element: JcfElement = { ...baseElement, papier: 'Couché135' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('papier');
  });

  it('returns error for invalid imposition', () => {
    const element: JcfElement = { ...baseElement, imposition: '50x70' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('imposition');
  });

  it('returns error for invalid impression', () => {
    const element: JcfElement = { ...baseElement, impression: 'Q' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('impression');
  });

  it('returns error for invalid surfacage', () => {
    const element: JcfElement = { ...baseElement, surfacage: 'mat' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('surfacage');
  });

  it('returns error for invalid format', () => {
    const element: JcfElement = { ...baseElement, format: 'invalid' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('format');
  });

  it('returns multiple errors for multiple invalid fields', () => {
    const element: JcfElement = {
      ...baseElement,
      pagination: '3',
      papier: 'Couché135',
      impression: 'Q',
    };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(3);
  });

  it('uses lenient sequence validation by default', () => {
    const element: JcfElement = { ...baseElement, sequence: 'G37(' };
    const errors = validateElementLive(element, 0);
    expect(errors).toHaveLength(0); // Incomplete, not flagged
  });

  it('uses strict sequence validation when specified', () => {
    const element: JcfElement = { ...baseElement, sequence: 'G37(' };
    const errors = validateElementLive(element, 0, true);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('sequence');
  });
});

// ── validateAllElements ───────────────────────────────────────────────────────

describe('validateAllElements', () => {
  const baseElement: JcfElement = {
    name: 'E1',
    precedences: '',
    quantite: '',
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

  it('returns empty map for valid elements', () => {
    const elements: JcfElement[] = [baseElement];
    const errorMap = validateAllElements(elements);
    expect(errorMap.size).toBe(0);
  });

  it('returns errors keyed by element-field', () => {
    const elements: JcfElement[] = [
      { ...baseElement, pagination: '3' },
      { ...baseElement, name: 'E2', papier: 'Couché135' },
    ];
    const errorMap = validateAllElements(elements);
    expect(errorMap.size).toBe(2);
    expect(errorMap.has('0-pagination')).toBe(true);
    expect(errorMap.has('1-papier')).toBe(true);
  });
});

// ── getCellError ──────────────────────────────────────────────────────────────

describe('getCellError', () => {
  it('returns undefined when no error exists', () => {
    const errorMap = new Map();
    expect(getCellError(errorMap, 0, 'pagination')).toBeUndefined();
  });

  it('returns error when it exists', () => {
    const error = {
      elementIndex: 0,
      field: 'pagination' as const,
      message: 'Invalid',
    };
    const errorMap = new Map([['0-pagination', error]]);
    expect(getCellError(errorMap, 0, 'pagination')).toBe(error);
  });
});

// ── validateForSubmit ────────────────────────────────────────────────────────

describe('validateForSubmit', () => {
  const baseElement: JcfElement = {
    name: 'E1',
    precedences: '',
    quantite: '1', // Default value - empty element needs '1' as default
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

  it('returns empty array for completely empty element', () => {
    const elements: JcfElement[] = [baseElement];
    const errors = validateForSubmit(elements, 'job');
    expect(errors).toHaveLength(0);
  });

  it('returns strict DSL errors (incomplete lines flagged)', () => {
    const element: JcfElement = {
      ...baseElement,
      sequence: 'G37(', // Incomplete - only strict mode catches this
    };
    const errors = validateForSubmit([element], 'job');
    const sequenceErrors = errors.filter((e) => e.field === 'sequence');
    expect(sequenceErrors.length).toBeGreaterThan(0);
    expect(sequenceErrors[0].type).toBe('live');
  });

  it('returns required field errors for element with content', () => {
    const element: JcfElement = {
      ...baseElement,
      papier: 'Couché:135', // Has content, so sequence is required
    };
    const errors = validateForSubmit([element], 'job');
    const sequenceErrors = errors.filter(
      (e) => e.field === 'sequence' && e.type === 'submit',
    );
    expect(sequenceErrors).toHaveLength(1);
    expect(sequenceErrors[0].message).toContain('Séquence requise');
  });

  it('returns required BLOC SUPPORT fields when triggered', () => {
    const element: JcfElement = {
      ...baseElement,
      imposition: '50x70(8)', // Triggers BLOC SUPPORT
      sequence: 'G37(20)', // Provide sequence to avoid that error
    };
    const errors = validateForSubmit([element], 'job');
    const requiredFields = errors
      .filter((e) => e.type === 'submit')
      .map((e) => e.field);
    expect(requiredFields).toContain('papier');
    expect(requiredFields).toContain('pagination');
    expect(requiredFields).toContain('format');
    expect(requiredFields).toContain('qteFeuilles');
  });

  it('returns required BLOC IMPRESSION fields when triggered', () => {
    const element: JcfElement = {
      ...baseElement,
      imposition: '50x70(8)', // Triggers BLOC IMPRESSION
      sequence: 'G37(20)',
    };
    const errors = validateForSubmit([element], 'job');
    const requiredFields = errors
      .filter((e) => e.type === 'submit')
      .map((e) => e.field);
    expect(requiredFields).toContain('impression');
  });

  it('returns no required field errors in template mode', () => {
    const element: JcfElement = {
      ...baseElement,
      papier: 'Couché:135', // Has content, but template mode skips required check
    };
    const errors = validateForSubmit([element], 'template');
    const submitErrors = errors.filter((e) => e.type === 'submit');
    expect(submitErrors).toHaveLength(0);
  });

  it('still returns DSL format errors in template mode', () => {
    const element: JcfElement = {
      ...baseElement,
      pagination: '3', // Invalid pagination
    };
    const errors = validateForSubmit([element], 'template');
    const paginationErrors = errors.filter((e) => e.field === 'pagination');
    expect(paginationErrors).toHaveLength(1);
    expect(paginationErrors[0].type).toBe('live');
  });

  it('returns empty array for valid complete element', () => {
    const element: JcfElement = {
      ...baseElement,
      sequence: 'G37(20)',
      papier: 'Couché:135',
      pagination: '8',
      format: 'A4',
      qteFeuilles: '1000',
      imposition: '50x70(8)',
      impression: 'Q/Q',
    };
    const errors = validateForSubmit([element], 'job');
    expect(errors).toHaveLength(0);
  });

  it('validates multiple elements independently', () => {
    const elements: JcfElement[] = [
      { ...baseElement, pagination: '3' }, // Invalid DSL
      { ...baseElement, name: 'E2', papier: 'Couché:135' }, // Missing sequence
    ];
    const errors = validateForSubmit(elements, 'job');
    expect(errors.some((e) => e.elementIndex === 0 && e.field === 'pagination')).toBe(true);
    expect(errors.some((e) => e.elementIndex === 1 && e.field === 'sequence')).toBe(true);
  });
});

// ── validateAllForSubmit ─────────────────────────────────────────────────────

describe('validateAllForSubmit', () => {
  const baseElement: JcfElement = {
    name: 'E1',
    precedences: '',
    quantite: '1', // Default value - empty element needs '1' as default
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

  it('returns empty map for valid elements', () => {
    const elements: JcfElement[] = [baseElement];
    const errorMap = validateAllForSubmit(elements, 'job');
    expect(errorMap.size).toBe(0);
  });

  it('returns errors keyed by element-field', () => {
    const elements: JcfElement[] = [
      { ...baseElement, pagination: '3' }, // Invalid DSL
      { ...baseElement, name: 'E2', papier: 'Couché:135' }, // Missing sequence
    ];
    const errorMap = validateAllForSubmit(elements, 'job');
    expect(errorMap.has('0-pagination')).toBe(true);
    expect(errorMap.has('1-sequence')).toBe(true);
  });

  it('returns submit type errors for required fields', () => {
    const element: JcfElement = {
      ...baseElement,
      papier: 'Couché:135',
    };
    const errorMap = validateAllForSubmit([element], 'job');
    const sequenceError = errorMap.get('0-sequence');
    expect(sequenceError).toBeDefined();
    expect(sequenceError?.type).toBe('submit');
  });

  it('returns live type errors for DSL format errors', () => {
    const element: JcfElement = {
      ...baseElement,
      pagination: '3',
    };
    const errorMap = validateAllForSubmit([element], 'job');
    const paginationError = errorMap.get('0-pagination');
    expect(paginationError).toBeDefined();
    expect(paginationError?.type).toBe('live');
  });
});
