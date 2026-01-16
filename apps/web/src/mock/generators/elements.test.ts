/**
 * Element Generator Tests
 */

import { describe, it, expect } from 'vitest';
import { generateElement, getRandomJobPattern } from './elements';

describe('generateElement', () => {
  it('should generate an element with correct properties', () => {
    const element = generateElement({
      jobId: 'job-00001',
      suffix: 'COUV',
      label: 'Couverture',
      prerequisiteElementIds: [],
      taskIds: ['task-job-00001-0', 'task-job-00001-1'],
    });

    expect(element.id).toBe('elem-job-00001-couv');
    expect(element.jobId).toBe('job-00001');
    expect(element.suffix).toBe('COUV');
    expect(element.label).toBe('Couverture');
    expect(element.prerequisiteElementIds).toEqual([]);
    expect(element.taskIds).toEqual(['task-job-00001-0', 'task-job-00001-1']);
    expect(element.createdAt).toBeDefined();
    expect(element.updatedAt).toBeDefined();
  });

  it('should generate an element with prerequisites', () => {
    const element = generateElement({
      jobId: 'job-00001',
      suffix: 'FIN',
      label: 'Finition',
      prerequisiteElementIds: ['elem-job-00001-couv', 'elem-job-00001-int'],
      taskIds: ['task-job-00001-5'],
    });

    expect(element.suffix).toBe('FIN');
    expect(element.prerequisiteElementIds).toEqual([
      'elem-job-00001-couv',
      'elem-job-00001-int',
    ]);
  });

  it('should generate an element without label', () => {
    const element = generateElement({
      jobId: 'job-00001',
      suffix: 'ELT',
      taskIds: ['task-job-00001-0'],
    });

    expect(element.suffix).toBe('ELT');
    expect(element.label).toBeUndefined();
  });
});

describe('getRandomJobPattern', () => {
  it('should return a valid pattern structure', () => {
    const pattern = getRandomJobPattern();

    expect(pattern).toHaveProperty('pattern');
    expect(pattern).toHaveProperty('elements');
    expect(['single', 'multi-sheet', 'brochure']).toContain(pattern.pattern);
    expect(pattern.elements.length).toBeGreaterThan(0);
  });

  it('should generate single-element pattern with ELT suffix', () => {
    // Run multiple times to catch single pattern
    let foundSingle = false;
    for (let i = 0; i < 100; i++) {
      const pattern = getRandomJobPattern();
      if (pattern.pattern === 'single') {
        foundSingle = true;
        expect(pattern.elements).toHaveLength(1);
        expect(pattern.elements[0].suffix).toBe('ELT');
        expect(pattern.elements[0].prerequisiteSuffixes).toHaveLength(0);
        break;
      }
    }
    expect(foundSingle).toBe(true);
  });

  it('should generate multi-sheet pattern with F1, F2, FIN suffixes', () => {
    let foundMultiSheet = false;
    for (let i = 0; i < 100; i++) {
      const pattern = getRandomJobPattern();
      if (pattern.pattern === 'multi-sheet') {
        foundMultiSheet = true;
        expect(pattern.elements).toHaveLength(3);
        expect(pattern.elements[0].suffix).toBe('F1');
        expect(pattern.elements[1].suffix).toBe('F2');
        expect(pattern.elements[2].suffix).toBe('FIN');
        expect(pattern.elements[2].prerequisiteSuffixes).toContain('F1');
        expect(pattern.elements[2].prerequisiteSuffixes).toContain('F2');
        break;
      }
    }
    expect(foundMultiSheet).toBe(true);
  });

  it('should generate brochure pattern with COUV, INT1, FIN suffixes', () => {
    let foundBrochure = false;
    for (let i = 0; i < 100; i++) {
      const pattern = getRandomJobPattern();
      if (pattern.pattern === 'brochure') {
        foundBrochure = true;
        expect(pattern.elements.length).toBeGreaterThanOrEqual(3);
        expect(pattern.elements[0].suffix).toBe('COUV');
        expect(pattern.elements[1].suffix).toBe('INT1');
        const finElement = pattern.elements[pattern.elements.length - 1];
        expect(finElement.suffix).toBe('FIN');
        expect(finElement.prerequisiteSuffixes).toContain('COUV');
        expect(finElement.prerequisiteSuffixes).toContain('INT1');
        break;
      }
    }
    expect(foundBrochure).toBe(true);
  });

  it('should respect distribution ratio (approximately 60/20/20)', () => {
    const counts = { single: 0, 'multi-sheet': 0, brochure: 0 };
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const pattern = getRandomJobPattern();
      counts[pattern.pattern]++;
    }

    // Allow for ±10% variance
    expect(counts.single).toBeGreaterThan(iterations * 0.5);
    expect(counts.single).toBeLessThan(iterations * 0.7);
    expect(counts['multi-sheet']).toBeGreaterThan(iterations * 0.1);
    expect(counts['multi-sheet']).toBeLessThan(iterations * 0.3);
    expect(counts.brochure).toBeGreaterThan(iterations * 0.1);
    expect(counts.brochure).toBeLessThan(iterations * 0.3);
  });
});
