import { describe, it, expect } from 'vitest';
import {
  toPrettyImposition,
  toDslImposition,
  isValidImposition,
  parseImposition,
  parseImpositionInput,
  extractPosesFromImposition,
} from './impositionDsl';

describe('parseImposition', () => {
  it('parses valid DSL', () => {
    expect(parseImposition('50x70(8)')).toEqual({ width: 50, height: 70, poses: 8 });
  });

  it('parses large values', () => {
    expect(parseImposition('65x90(16)')).toEqual({ width: 65, height: 90, poses: 16 });
  });

  it('returns null for invalid format', () => {
    expect(parseImposition('invalid')).toBeNull();
    expect(parseImposition('')).toBeNull();
    expect(parseImposition('50x70')).toBeNull();
    expect(parseImposition('50x70()')).toBeNull();
  });
});

describe('isValidImposition', () => {
  it('validates correct DSL', () => {
    expect(isValidImposition('50x70(8)')).toBe(true);
    expect(isValidImposition('65x90(16)')).toBe(true);
    expect(isValidImposition('1x1(1)')).toBe(true);
    expect(isValidImposition('100x200(128)')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isValidImposition('')).toBe(false);
    expect(isValidImposition('50x70')).toBe(false);
    expect(isValidImposition('50x70()')).toBe(false);
    expect(isValidImposition('0x70(8)')).toBe(false);
    expect(isValidImposition('50x0(8)')).toBe(false);
    expect(isValidImposition('50x70(0)')).toBe(false);
    expect(isValidImposition('50x70(8p)')).toBe(false);
    expect(isValidImposition('abc')).toBe(false);
  });

  it('handles whitespace', () => {
    expect(isValidImposition('  50x70(8)  ')).toBe(true);
  });
});

describe('toPrettyImposition', () => {
  it('converts DSL to pretty', () => {
    expect(toPrettyImposition('50x70(8)')).toBe('50x70cm 8poses/f');
    expect(toPrettyImposition('65x90(16)')).toBe('65x90cm 16poses/f');
  });

  it('returns empty for empty', () => {
    expect(toPrettyImposition('')).toBe('');
  });

  it('returns as-is for invalid', () => {
    expect(toPrettyImposition('invalid')).toBe('invalid');
    expect(toPrettyImposition('50x70')).toBe('50x70');
  });
});

describe('toDslImposition', () => {
  it('converts pretty to DSL', () => {
    expect(toDslImposition('50x70cm 8poses/f')).toBe('50x70(8)');
    expect(toDslImposition('65x90cm 16poses/f')).toBe('65x90(16)');
  });

  it('returns already-DSL as-is', () => {
    expect(toDslImposition('50x70(8)')).toBe('50x70(8)');
  });

  it('returns empty for empty', () => {
    expect(toDslImposition('')).toBe('');
  });

  it('returns as-is for unrecognized format', () => {
    expect(toDslImposition('unknown')).toBe('unknown');
  });
});

describe('parseImpositionInput', () => {
  it('detects format-typing step', () => {
    expect(parseImpositionInput('50')).toEqual({
      format: '50', poses: '', isTypingPoses: false,
    });
    expect(parseImpositionInput('50x70')).toEqual({
      format: '50x70', poses: '', isTypingPoses: false,
    });
  });

  it('detects poses-typing step after opening paren', () => {
    expect(parseImpositionInput('50x70(')).toEqual({
      format: '50x70', poses: '', isTypingPoses: true,
    });
    expect(parseImpositionInput('50x70(8')).toEqual({
      format: '50x70', poses: '8', isTypingPoses: true,
    });
  });

  it('strips closing paren from poses', () => {
    expect(parseImpositionInput('50x70(8)')).toEqual({
      format: '50x70', poses: '8', isTypingPoses: true,
    });
  });

  it('handles empty input', () => {
    expect(parseImpositionInput('')).toEqual({
      format: '', poses: '', isTypingPoses: false,
    });
  });
});

describe('extractPosesFromImposition', () => {
  it('extracts from DSL format', () => {
    expect(extractPosesFromImposition('50x70(8)')).toBe(8);
    expect(extractPosesFromImposition('65x90(16)')).toBe(16);
  });

  it('extracts from DSL with p suffix', () => {
    expect(extractPosesFromImposition('50x70(8p)')).toBe(8);
  });

  it('extracts from pretty format', () => {
    expect(extractPosesFromImposition('50x70cm 8poses/f')).toBe(8);
  });

  it('extracts from plain "N poses"', () => {
    expect(extractPosesFromImposition('8 poses')).toBe(8);
    expect(extractPosesFromImposition('16 pose')).toBe(16);
  });

  it('returns null for invalid', () => {
    expect(extractPosesFromImposition('invalid')).toBeNull();
    expect(extractPosesFromImposition('')).toBeNull();
  });
});
