import { describe, it, expect } from 'vitest';
import { generateJobId } from './generateJobId';

describe('generateJobId', () => {
  it('matches J-YYYY-NNNN format', () => {
    const id = generateJobId();
    expect(id).toMatch(/^J-\d{4}-\d{4}$/);
  });

  it('uses current year', () => {
    const id = generateJobId();
    const year = new Date().getFullYear().toString();
    expect(id).toContain(`J-${year}-`);
  });

  it('generates different IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateJobId()));
    // With 10000 possible values, 20 calls should almost certainly produce at least 2 unique
    expect(ids.size).toBeGreaterThan(1);
  });
});
