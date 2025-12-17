import { describe, it, expect } from 'vitest';
import { calculateGrabOffset, calculateTileTopPosition } from './dragOffset';

describe('dragOffset utilities', () => {
  describe('calculateGrabOffset', () => {
    it('calculates correct offset when grabbing at top edge', () => {
      // User grabs at Y=100, element top is at Y=100
      const offset = calculateGrabOffset(100, 100);
      expect(offset).toBe(0);
    });

    it('calculates correct offset when grabbing in the middle', () => {
      // Element is 100px tall, top at Y=100, user grabs at Y=150 (middle)
      const offset = calculateGrabOffset(150, 100);
      expect(offset).toBe(50);
    });

    it('calculates correct offset when grabbing at bottom edge', () => {
      // Element is 100px tall, top at Y=100, user grabs at Y=200 (bottom)
      const offset = calculateGrabOffset(200, 100);
      expect(offset).toBe(100);
    });

    it('returns 0 for negative offset (edge case)', () => {
      // Shouldn't happen in normal use, but handle gracefully
      const offset = calculateGrabOffset(50, 100);
      expect(offset).toBe(0);
    });
  });

  describe('calculateTileTopPosition', () => {
    it('calculates tile top at cursor when grab offset is 0', () => {
      // Cursor at Y=300, container top at Y=100, grabbed at tile top
      const tileTop = calculateTileTopPosition(300, 100, 0);
      expect(tileTop).toBe(200); // 300 - 100 - 0
    });

    it('calculates tile top correctly when grabbed in middle', () => {
      // Cursor at Y=300, container top at Y=100, grabbed 50px from tile top
      const tileTop = calculateTileTopPosition(300, 100, 50);
      expect(tileTop).toBe(150); // 300 - 100 - 50
    });

    it('calculates tile top correctly when grabbed at bottom', () => {
      // Cursor at Y=300, container top at Y=100, grabbed 100px from tile top
      const tileTop = calculateTileTopPosition(300, 100, 100);
      expect(tileTop).toBe(100); // 300 - 100 - 100
    });

    it('clamps to 0 when tile top would be negative', () => {
      // Cursor near top of container, large grab offset
      const tileTop = calculateTileTopPosition(150, 100, 100);
      expect(tileTop).toBe(0); // max(0, 150 - 100 - 100 = -50) = 0
    });

    it('works with real-world-like coordinates', () => {
      // Container at Y=200, cursor at Y=450, grabbed 30px from tile top
      const tileTop = calculateTileTopPosition(450, 200, 30);
      expect(tileTop).toBe(220); // 450 - 200 - 30
    });
  });

  describe('integration: grab and drop workflow', () => {
    it('preserves relative position when dragging a tile', () => {
      // Scenario: User grabs tile 50px from its top, drags, and drops
      const tileOriginalTop = 100;
      const grabPointY = 150; // 50px from tile top

      // Step 1: Calculate grab offset at drag start
      const grabOffset = calculateGrabOffset(grabPointY, tileOriginalTop);
      expect(grabOffset).toBe(50);

      // Step 2: User drags to new position, cursor at Y=400
      const containerTop = 50;
      const cursorY = 400;

      // Step 3: Calculate where tile should land
      const newTileTop = calculateTileTopPosition(cursorY, containerTop, grabOffset);
      expect(newTileTop).toBe(300); // 400 - 50 - 50

      // The tile's top edge (300) is 50px above cursor (400-50=350... wait)
      // Actually: cursor at 400, grab offset 50, so tile top = 400 - 50 = 350 relative to viewport
      // But we subtract container top (50), so: 400 - 50 - 50 = 300 (relative to container)
      // This means cursor is at 400 viewport, container top at 50, so cursor is at 350 in container
      // Tile top should be 350 - 50 = 300 in container. ✓
    });
  });
});
