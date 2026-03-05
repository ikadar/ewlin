/**
 * Job API tests (v0.4.33)
 */

import { describe, it, expect } from 'vitest';
import {
  transformJcfElementToRequest,
  transformJcfToRequest,
  JobApiError,
} from './jobApi';
import type { JcfElement } from '../components/JcfElementsTable/types';

describe('transformJcfElementToRequest', () => {
  it('transforms element with no precedences', () => {
    const element: JcfElement = {
      name: 'INT',
      precedences: '',
      quantite: '1',
      format: 'A4',
      pagination: '8P',
      papier: 'Couche 135g',
      imposition: '',
      impression: '',
      surfacage: '',
      autres: '',
      qteFeuilles: '',
      commentaires: '',
      sequence: 'M1 30+60',
    };

    const result = transformJcfElementToRequest(element);

    expect(result.name).toBe('INT');
    expect(result.prerequisiteNames).toEqual([]);
    expect(result.format).toBe('A4');
    expect(result.papier).toBe('Couche 135g');
    expect(result.pagination).toBe(8);
    expect(result.sequence).toBe('M1 30+60');
  });

  it('transforms element with precedences', () => {
    const element: JcfElement = {
      name: 'COUV',
      precedences: 'INT, PAGE',
      quantite: '1',
      format: 'A3',
      pagination: '4P',
      papier: 'Couche 250g',
      imposition: '',
      impression: '',
      surfacage: '',
      autres: '',
      qteFeuilles: '',
      commentaires: '',
      sequence: '',
    };

    const result = transformJcfElementToRequest(element);

    expect(result.name).toBe('COUV');
    expect(result.prerequisiteNames).toEqual(['INT', 'PAGE']);
    expect(result.format).toBe('A3');
    expect(result.papier).toBe('Couche 250g');
    expect(result.pagination).toBe(4);
    expect(result.sequence).toBeUndefined();
  });

  it('handles empty format/pagination/papier', () => {
    const element: JcfElement = {
      name: 'ELT',
      precedences: '',
      quantite: '1',
      format: '',
      pagination: '',
      papier: '',
      imposition: '',
      impression: '',
      surfacage: '',
      autres: '',
      qteFeuilles: '',
      commentaires: '',
      sequence: '',
    };

    const result = transformJcfElementToRequest(element);

    expect(result.format).toBeUndefined();
  });

  it('handles whitespace in precedences', () => {
    const element: JcfElement = {
      name: 'COUV',
      precedences: '  INT ,  PAGE  ,  ',
      quantite: '1',
      format: '',
      pagination: '',
      papier: '',
      imposition: '',
      impression: '',
      surfacage: '',
      autres: '',
      qteFeuilles: '',
      commentaires: '',
      sequence: '',
    };

    const result = transformJcfElementToRequest(element);

    expect(result.prerequisiteNames).toEqual(['INT', 'PAGE']);
  });
});

describe('transformJcfToRequest', () => {
  it('transforms full JCF form data to API request', () => {
    const elements: JcfElement[] = [
      {
        name: 'INT',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '8P',
        papier: 'Couche 135g',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'M1 30+60',
      },
      {
        name: 'COUV',
        precedences: 'INT',
        quantite: '1',
        format: 'A4',
        pagination: '4P',
        papier: 'Couche 250g',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'M2 15+30',
      },
    ];

    const result = transformJcfToRequest(
      'JOB-2025-001',
      'ACME Corp',
      'Brochure A4',
      '2025-02-15',
      elements
    );

    expect(result.reference).toBe('JOB-2025-001');
    expect(result.client).toBe('ACME Corp');
    expect(result.description).toBe('Brochure A4');
    expect(result.workshopExitDate).toBe('2025-02-15');
    expect(result.status).toBe('planned');
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].name).toBe('INT');
    expect(result.elements[0].prerequisiteNames).toEqual([]);
    expect(result.elements[1].name).toBe('COUV');
    expect(result.elements[1].prerequisiteNames).toEqual(['INT']);
  });
});

// Note: createJob tests are skipped because Vitest doesn't load .env files by default.
// The function is tested via integration tests (e2e/playwright).
// The transformation functions above are the unit-testable parts.

describe('JobApiError', () => {
  it('includes status code and violations', () => {
    const violations = [
      { propertyPath: 'reference', message: 'Reference is required' },
    ];
    const error = new JobApiError('Validation failed', 422, violations);

    expect(error.message).toBe('Validation failed');
    expect(error.statusCode).toBe(422);
    expect(error.violations).toEqual(violations);
    expect(error.name).toBe('JobApiError');
  });
});
