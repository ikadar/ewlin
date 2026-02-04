/**
 * Mock Reference Data Tests
 * Verifies completeness and correctness of all reference data collections.
 */

import { describe, it, expect } from 'vitest';
import {
  PAPER_TYPES,
  PRODUCT_FORMATS,
  FEUILLE_FORMATS,
  IMPRESSION_PRESETS,
  SURFACAGE_PRESETS,
  POSTE_PRESETS,
  POSTE_CATEGORIES,
  SOUSTRAITANT_PRESETS,
  TEMPLATE_CATEGORIES,
} from './reference-data';

// ============================================================================
// Paper Types
// ============================================================================

describe('PAPER_TYPES', () => {
  it('has 5 paper types', () => {
    expect(PAPER_TYPES).toHaveLength(5);
  });

  it('each paper type has 14 grammages', () => {
    for (const paper of PAPER_TYPES) {
      expect(paper.grammages).toHaveLength(14);
    }
  });

  it('grammages are numeric (not strings)', () => {
    for (const paper of PAPER_TYPES) {
      for (const g of paper.grammages) {
        expect(typeof g).toBe('number');
        expect(g).toBeGreaterThan(0);
      }
    }
  });

  it('grammages are sorted ascending', () => {
    for (const paper of PAPER_TYPES) {
      for (let i = 1; i < paper.grammages.length; i++) {
        expect(paper.grammages[i]).toBeGreaterThan(paper.grammages[i - 1]);
      }
    }
  });

  it('has unique IDs', () => {
    const ids = PAPER_TYPES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains expected paper types', () => {
    const types = PAPER_TYPES.map((p) => p.type);
    expect(types).toContain('Couché mat');
    expect(types).toContain('Couché satin');
    expect(types).toContain('Couché brillant');
    expect(types).toContain('Offset');
    expect(types).toContain('Laser');
  });
});

// ============================================================================
// Product Formats
// ============================================================================

describe('PRODUCT_FORMATS', () => {
  it('has 36 product formats', () => {
    expect(PRODUCT_FORMATS).toHaveLength(36);
  });

  it('all have positive dimensions', () => {
    for (const format of PRODUCT_FORMATS) {
      expect(format.width).toBeGreaterThan(0);
      expect(format.height).toBeGreaterThan(0);
    }
  });

  it('has unique IDs', () => {
    const ids = PRODUCT_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains A-series formats', () => {
    const names = PRODUCT_FORMATS.map((f) => f.name);
    expect(names).toContain('A3');
    expect(names).toContain('A4');
    expect(names).toContain('A5');
  });

  it('contains B-series formats', () => {
    const names = PRODUCT_FORMATS.map((f) => f.name);
    expect(names).toContain('B4');
    expect(names).toContain('B5');
  });

  it('contains SRA-series formats', () => {
    const names = PRODUCT_FORMATS.map((f) => f.name);
    expect(names).toContain('SRA1');
    expect(names).toContain('SRA3');
  });

  it('A4 has correct dimensions (210×297)', () => {
    const a4 = PRODUCT_FORMATS.find((f) => f.name === 'A4');
    expect(a4).toBeDefined();
    expect(a4!.width).toBe(210);
    expect(a4!.height).toBe(297);
  });
});

// ============================================================================
// Feuille Formats (Imposition)
// ============================================================================

describe('FEUILLE_FORMATS', () => {
  it('has 10 sheet formats', () => {
    expect(FEUILLE_FORMATS).toHaveLength(10);
  });

  it('each has 8 poses (powers of 2)', () => {
    const expectedPoses = [1, 2, 4, 8, 16, 32, 64, 128];
    for (const feuille of FEUILLE_FORMATS) {
      expect(feuille.poses).toEqual(expectedPoses);
    }
  });

  it('has unique format strings', () => {
    const formats = FEUILLE_FORMATS.map((f) => f.format);
    expect(new Set(formats).size).toBe(formats.length);
  });

  it('contains common formats', () => {
    const formats = FEUILLE_FORMATS.map((f) => f.format);
    expect(formats).toContain('50x70');
    expect(formats).toContain('70x100');
    expect(formats).toContain('45x64');
  });
});

// ============================================================================
// Impression Presets
// ============================================================================

describe('IMPRESSION_PRESETS', () => {
  it('has 9 presets', () => {
    expect(IMPRESSION_PRESETS).toHaveLength(9);
  });

  it('all have id, value, and description', () => {
    for (const preset of IMPRESSION_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.value).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });

  it('has unique IDs', () => {
    const ids = IMPRESSION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains Q/Q (Quadri R/V)', () => {
    const qq = IMPRESSION_PRESETS.find((p) => p.value === 'Q/Q');
    expect(qq).toBeDefined();
    expect(qq!.description).toBe('Quadri R/V');
  });
});

// ============================================================================
// Surfacage Presets
// ============================================================================

describe('SURFACAGE_PRESETS', () => {
  it('has 10 presets', () => {
    expect(SURFACAGE_PRESETS).toHaveLength(10);
  });

  it('all have id, value, and description', () => {
    for (const preset of SURFACAGE_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.value).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });

  it('has unique IDs', () => {
    const ids = SURFACAGE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains mat/mat', () => {
    const matMat = SURFACAGE_PRESETS.find((p) => p.value === 'mat/mat');
    expect(matMat).toBeDefined();
    expect(matMat!.description).toBe('Pelli mat R/V');
  });
});

// ============================================================================
// Poste Presets
// ============================================================================

describe('POSTE_PRESETS', () => {
  it('has 16 presets', () => {
    expect(POSTE_PRESETS).toHaveLength(16);
  });

  it('covers all 8 categories', () => {
    const categories = new Set(POSTE_PRESETS.map((p) => p.category));
    expect(categories.size).toBe(8);
    for (const cat of POSTE_CATEGORIES) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('has unique names', () => {
    const names = POSTE_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('contains G37 (Presse offset)', () => {
    const g37 = POSTE_PRESETS.find((p) => p.name === 'G37');
    expect(g37).toBeDefined();
    expect(g37!.category).toBe('Presse offset');
  });
});

// ============================================================================
// Poste Categories
// ============================================================================

describe('POSTE_CATEGORIES', () => {
  it('has 8 categories', () => {
    expect(POSTE_CATEGORIES).toHaveLength(8);
  });

  it('has unique entries', () => {
    expect(new Set(POSTE_CATEGORIES).size).toBe(POSTE_CATEGORIES.length);
  });
});

// ============================================================================
// Soustraitant Presets
// ============================================================================

describe('SOUSTRAITANT_PRESETS', () => {
  it('has 5 presets', () => {
    expect(SOUSTRAITANT_PRESETS).toHaveLength(5);
  });

  it('all have a name', () => {
    for (const preset of SOUSTRAITANT_PRESETS) {
      expect(preset.name).toBeTruthy();
    }
  });

  it('has unique names', () => {
    const names = SOUSTRAITANT_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('contains MCA', () => {
    expect(SOUSTRAITANT_PRESETS.find((p) => p.name === 'MCA')).toBeDefined();
  });
});

// ============================================================================
// Template Categories
// ============================================================================

describe('TEMPLATE_CATEGORIES', () => {
  it('has 2 categories', () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(2);
  });

  it('all have id and name', () => {
    for (const cat of TEMPLATE_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
    }
  });

  it('has unique IDs', () => {
    const ids = TEMPLATE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains Brochure and Feuillet', () => {
    const names = TEMPLATE_CATEGORIES.map((c) => c.name);
    expect(names).toContain('Brochure');
    expect(names).toContain('Feuillet');
  });
});
