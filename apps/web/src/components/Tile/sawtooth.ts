/**
 * Shared sawtooth geometry helpers for tiles (operator + station).
 * Teeth indicate an interrupted task — the tile continues elsewhere in time.
 *
 * Tooth width is driven by a target pixel size (TOOTH_WIDTH), not a fixed
 * count — so narrow and wide tiles show teeth of the same visual size,
 * just in different quantities.
 */

export const SAW_AMPLITUDE = 7;
export const TOOTH_WIDTH = 14;
const MIN_TEETH = 3;

/** Pick a teeth count that keeps each tooth ~TOOTH_WIDTH px regardless of tile width. */
export function computeTeethCount(tileWidth: number): number {
  if (!Number.isFinite(tileWidth) || tileWidth <= 0) return MIN_TEETH;
  return Math.max(MIN_TEETH, Math.round(tileWidth / TOOTH_WIDTH));
}

/**
 * Build an SVG <path> d-attribute for a visible zigzag stroke line.
 * Coordinates are in pixel space matching the container's viewBox.
 */
export function buildSawtoothSvgPath(
  width: number,
  y: number,
  direction: 'top' | 'bottom',
  teeth: number = computeTeethCount(width),
): string {
  const amp = SAW_AMPLITUDE;
  const stepW = width / teeth;
  const parts: string[] = [];

  if (direction === 'top') {
    parts.push(`M 0 ${y + amp}`);
    for (let i = 0; i < teeth; i++) {
      parts.push(`L ${(i * stepW + stepW / 2).toFixed(1)} ${y}`);
      parts.push(`L ${((i + 1) * stepW).toFixed(1)} ${y + amp}`);
    }
  } else {
    parts.push(`M 0 ${y - amp}`);
    for (let i = 0; i < teeth; i++) {
      parts.push(`L ${(i * stepW + stepW / 2).toFixed(1)} ${y}`);
      parts.push(`L ${((i + 1) * stepW).toFixed(1)} ${y - amp}`);
    }
  }

  return parts.join(' ');
}

/**
 * Build a CSS clip-path polygon() string.
 * X coordinates use percentages (responsive). Y uses pixels (fixed tooth height).
 * `teeth` controls tooth density — callers compute it from tile pixel width
 * (via `computeTeethCount`) so teeth keep a consistent visual size.
 */
export function buildCssClipPath(
  h: number,
  sawTop: boolean,
  sawBottom: boolean,
  teeth: number = MIN_TEETH,
): string | undefined {
  if (!sawTop && !sawBottom) return undefined;

  const amp = SAW_AMPLITUDE;
  const stepPct = 100 / teeth;
  const points: string[] = [];

  if (sawTop) {
    for (let i = 0; i < teeth; i++) {
      points.push(`${(i * stepPct).toFixed(2)}% ${amp}px`);
      points.push(`${(i * stepPct + stepPct / 2).toFixed(2)}% 0px`);
      points.push(`${((i + 1) * stepPct).toFixed(2)}% ${amp}px`);
    }
  } else {
    points.push('0% 0px', '100% 0px');
  }

  if (sawBottom) {
    points.push(`100% ${h - amp}px`);
    for (let i = teeth - 1; i >= 0; i--) {
      points.push(`${(i * stepPct + stepPct / 2).toFixed(2)}% ${h}px`);
      points.push(`${(i * stepPct).toFixed(2)}% ${h - amp}px`);
    }
  } else {
    points.push(`100% ${h}px`, `0% ${h}px`);
  }

  return `polygon(${points.join(', ')})`;
}
