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

/** Lens envelope dimensions. Width is fixed; height is responsive — it grows
 *  with the viewport on large monitors but never shrinks below LENS_MIN_HEIGHT
 *  (so short viewports still get a useful lens). */
export const LENS_WIDTH = 300;
export const LENS_MIN_HEIGHT = 700;
export const LENS_VIEWPORT_HEIGHT_RATIO = 0.30;
export const LENS_LEFT_GUTTER = 40;

export function computeLensHeight(viewportHeight: number): number {
  return Math.max(viewportHeight * LENS_VIEWPORT_HEIGHT_RATIO, LENS_MIN_HEIGHT);
}

/** Reference threshold: at exactly LENS_HOVER_DELAY_MS of dwell, tiles ≤ this
 *  many pixels trigger the lens. Taller tiles can still trigger — they just
 *  need proportionally more dwell, capped at LENS_MAX_DWELL_MS (see
 *  `computeDwellMs`). */
export const LENS_SMALL_TILE_THRESHOLD_PX = 20;

/** Timings (ms). */
export const LENS_HOVER_DELAY_MS = 80;
/** Upper bound on the dwell required to trigger the lens. With a 20 px
 *  baseline at 80 ms, a 128 ms cap means tiles up to 32 px can trigger the
 *  lens (given enough dwell); taller tiles never do — they behave like dead
 *  zones for auto-close purposes. */
export const LENS_MAX_DWELL_MS = 128;

/** Required dwell (ms) before the lens opens on a tile of the given rendered
 *  height. Linear scaling: 20 px → 80 ms, 40 px → 160 ms, 100 px → 400 ms, … */
export function computeDwellMs(tileHeightPx: number): number {
  if (tileHeightPx <= 0) return LENS_HOVER_DELAY_MS;
  return Math.ceil(
    (tileHeightPx / LENS_SMALL_TILE_THRESHOLD_PX) * LENS_HOVER_DELAY_MS,
  );
}

/** Whether the given tile height is reachable within LENS_MAX_DWELL_MS. */
export function isTileTriggerable(tileHeightPx: number): boolean {
  return computeDwellMs(tileHeightPx) <= LENS_MAX_DWELL_MS;
}
export const LENS_FADE_IN_MS = 500;
export const LENS_FADE_OUT_MS = 500;
/** Dwell before auto-closing on a tile that is too tall to trigger the lens. */
export const LENS_AUTO_CLOSE_MS = 1500;

/** Max delay since last cursor `mousemove` for an open-trigger to count as
 *  user-intentional. Past this window the cursor is considered stationary,
 *  so a fresh `mouseover` must be the result of the DOM mutating beneath
 *  the cursor (snapshot refetch, `now` tick re-flow, virtual scroll, …),
 *  not the user actually moving onto a tile — we ignore it. During real
 *  movement `mousemove` fires ~every 16 ms, so 100 ms leaves ample margin
 *  for slow drags while still blocking layout-driven phantom triggers. */
export const LENS_INTENT_WINDOW_MS = 100;

/** Dwell before auto-closing when the cursor is parked over a dead zone
 *  (hatched unavailability overlay, hour grid, or any non-tile space in the
 *  column). Shorter than the tall-tile close because empty space is a
 *  stronger "the user is done" signal. */
export const LENS_DEAD_ZONE_CLOSE_MS = 300;
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
