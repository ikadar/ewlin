import { describe, it, expect } from 'vitest';
import { parsePapierDSL } from './papierDSL';

describe('parsePapierDSL', () => {
  it('parses type and grammage when colon present', () => {
    expect(parsePapierDSL('Couché mat:135')).toEqual({ type: 'Couché mat', grammage: '135g' });
  });

  it('parses type only when no colon', () => {
    expect(parsePapierDSL('Offset')).toEqual({ type: 'Offset', grammage: '' });
  });

  it('trims whitespace around type', () => {
    expect(parsePapierDSL('  Offset  ')).toEqual({ type: 'Offset', grammage: '' });
  });

  it('trims whitespace around type and grammage', () => {
    expect(parsePapierDSL(' Couché brillant : 90 ')).toEqual({ type: 'Couché brillant', grammage: '90g' });
  });

  it('handles empty string', () => {
    expect(parsePapierDSL('')).toEqual({ type: '', grammage: '' });
  });

  it('handles colon at start (empty type)', () => {
    expect(parsePapierDSL(':115')).toEqual({ type: '', grammage: '115g' });
  });
});
