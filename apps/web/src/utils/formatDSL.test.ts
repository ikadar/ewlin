/**
 * Mirror of {@link services/php-api/tests/Unit/Util/FormatDSLParserTest.php}.
 * Cases MUST stay in lockstep with the PHP sibling.
 */

import { describe, it, expect } from 'vitest';
import { longSide } from './formatDSL';

describe('longSide', () => {
  it.each([
    // Custom numeric
    ['50x70', 70],
    ['70x50', 70],
    ['50 x 70', 70],
    ['50X70', 70],
    ['50×70', 70],
    ['50x70(8)', 70],
    ['63.5x88', 88],
    ['50x50', 50],
    // ISO
    ['A3', 420],
    ['a4', 297],
    ['A5', 210],
    ['A0', 1189],
    // Other series
    ['B3', 500],
    ['SRA3', 450],
    ['SRA4', 320],
    ['RA3', 430],
    // Composite
    ['A3/A6', 420],
    ['50x70/A4', 297],
    // Lone
    ['70', 70],
    // Edges
    [null, null],
    ['', null],
    ['   ', null],
    ['not a format', null],
  ])('longSide(%j) → %j', (input, expected) => {
    expect(longSide(input as string | null)).toBe(expected);
  });
});
