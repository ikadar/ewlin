/**
 * Utilities for tile-based drop positioning.
 *
 * When dragging tiles, the drop position should be calculated from the tile's
 * top edge, not the cursor position. This prevents tiles from "jumping" when
 * the user grabs them in the middle or bottom.
 */

/**
 * Calculate the grab offset - how far from the tile's top edge the user grabbed.
 *
 * @param pointerY - The Y coordinate where the user started dragging (clientY)
 * @param elementTop - The top edge of the dragged element (from getBoundingClientRect)
 * @returns The vertical offset in pixels from the tile top
 */
export function calculateGrabOffset(pointerY: number, elementTop: number): number {
  const offset = pointerY - elementTop;
  // Ensure non-negative (shouldn't happen in normal use, but be safe)
  return Math.max(0, offset);
}

/**
 * Calculate the tile top position from cursor position and grab offset.
 *
 * This is the inverse of cursor-based positioning - we subtract the grab offset
 * to find where the tile's top edge should be.
 *
 * @param cursorY - Current cursor Y position (clientY)
 * @param containerTop - The top edge of the drop container (from getBoundingClientRect)
 * @param grabOffset - The offset calculated at drag start
 * @returns The relative Y position of the tile's top edge within the container
 */
export function calculateTileTopPosition(
  cursorY: number,
  containerTop: number,
  grabOffset: number
): number {
  const tileTop = cursorY - containerTop - grabOffset;
  // Ensure non-negative (tile can't go above container)
  return Math.max(0, tileTop);
}
