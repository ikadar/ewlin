/**
 * Configuration for the TimelineLens feature — a floating panel that
 * re-renders a station / operator column at a higher pixels-per-hour
 * ratio so the reader can scan short tiles without clicking or waiting
 * for the rich tooltip. Orthogonal to the 500 ms rich tooltip.
 *
 * Values validated in `playground-tile-zoom-loupe.html`.
 */

/** Fixed lens density so short tiles are comfortably readable regardless of the
 *  user's current zoom on the source grid. At 500 px/h a 2-min tile is ~17 px
 *  tall and a 5-min tile ~42 px — enough headroom for the `11 px` title + the
 *  `9 px` subtitle without magnifying so hard that context shrinks to a few
 *  minutes on each side. */
export const LENS_PIXELS_PER_HOUR = 500;

/** Lens envelope dimensions. */
export const LENS_WIDTH = 300;
export const LENS_HEIGHT = 400;
export const LENS_LEFT_GUTTER = 40;

/** Any tile rendered at ≤ this many pixels in the source grid is considered "small"
 *  (the lens's reason to exist). Taller tiles are already readable. */
export const LENS_SMALL_TILE_THRESHOLD_PX = 20;

/** Timings (ms). */
export const LENS_HOVER_DELAY_MS = 80;
export const LENS_FADE_IN_MS = 120;
export const LENS_FADE_OUT_MS = 140;
/** Generous dwell before auto-closing on a tall tile. Lower values felt like
 *  the lens "evaporated" mid-inspection, especially now that follow-cursor
 *  makes it natural to hover a tall tile for a moment while scanning around. */
export const LENS_AUTO_CLOSE_MS = 3000;
export const LENS_HIDE_GRACE_MS = 140;
/** Duration used both for the envelope (top/left) gliding when the lens docks
 *  against a new tile, and for the inner translateY when the focal time
 *  changes. 200 ms keeps the lens close to the cursor in follow mode — long
 *  enough to smooth out per-frame mousemove jitter, short enough that the
 *  lens never feels like it lags noticeably behind the cursor. */
export const LENS_SCROLL_DURATION_MS = 200;

export const LENS_SCROLL_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** Enable inner-wrapper translateY animation when re-centering inside the same column. */
export const LENS_SMOOTH_SCROLL = true;

/** Horizontal offset from the source column's right edge. */
export const LENS_OFFSET_FROM_COLUMN = 40;

/** Only small tiles open / refresh the lens. Tall tiles arm the auto-close. */
export const LENS_ONLY_TINY = true;

/** Must exceed schedule overlays but stay below modals. */
export const LENS_Z_INDEX = 60;
