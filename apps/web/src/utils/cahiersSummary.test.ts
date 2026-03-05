import { describe, it, expect } from 'vitest';
import type { Element } from '@flux/types';
import { computeCahiersSummary } from './cahiersSummary';

const makeElement = (id: string, name: string, pagination?: number): Element => ({
  id,
  jobId: 'job-1',
  name,
  prerequisiteElementIds: [],
  taskIds: [],
  spec: pagination !== undefined ? { pagination } : undefined,
  paperStatus: 'none',
  batStatus: 'none',
  plateStatus: 'none',
  formeStatus: 'none',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
});

describe('computeCahiersSummary', () => {
  it('groups equal paginations and appends couv when cover present', () => {
    const elements = [
      makeElement('e1', 'int1', 16),
      makeElement('e2', 'int2', 16),
      makeElement('e3', 'int3', 8),
      makeElement('e4', 'int4', 4),
      makeElement('e5', 'couv', undefined),
    ];
    expect(computeCahiersSummary(elements)).toBe('2x16p + 8p + 4p + couv');
  });

  it('handles single interior with no cover', () => {
    const elements = [makeElement('e1', 'int', 32)];
    expect(computeCahiersSummary(elements)).toBe('32p');
  });

  it('handles three equal cahiers with no cover', () => {
    const elements = [makeElement('e1', 'int1', 8), makeElement('e2', 'int2', 8), makeElement('e3', 'int3', 8)];
    expect(computeCahiersSummary(elements)).toBe('3x8p');
  });

  it('detects cover case-insensitively', () => {
    const elements = [makeElement('e1', 'int', 16), makeElement('e2', 'COUV')];
    expect(computeCahiersSummary(elements)).toBe('16p + couv');
  });

  it('returns only couv when all elements are covers', () => {
    const elements = [makeElement('e1', 'couv'), makeElement('e2', 'couv2')];
    expect(computeCahiersSummary(elements)).toBe('couv');
  });

  it('ignores zero and missing paginations', () => {
    const elements = [
      makeElement('e1', 'int1', 0),
      makeElement('e2', 'int2'),
      makeElement('e3', 'int3', 16),
    ];
    expect(computeCahiersSummary(elements)).toBe('16p');
  });

  it('returns empty string when no elements', () => {
    expect(computeCahiersSummary([])).toBe('');
  });
});
