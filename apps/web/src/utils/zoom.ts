/**
 * Available zoom levels with their pixelsPerHour values.
 * v0.4.29: All values scaled to 80% for UI Scale Harmonization.
 * - 100% zoom = 64px/hour (was 80px/hour)
 * - All other levels proportionally scaled
 */
export const ZOOM_LEVELS = [
  { label: '25%', pixelsPerHour: 16 },   // was 20
  { label: '50%', pixelsPerHour: 32 },   // was 40
  { label: '75%', pixelsPerHour: 48 },   // was 60
  { label: '100%', pixelsPerHour: 64 },  // was 80
  { label: '150%', pixelsPerHour: 96 },  // was 120
  { label: '200%', pixelsPerHour: 128 }, // was 160
] as const;

/** Default zoom level (100% = 64px/hour, v0.4.29: scaled to 80%) */
export const DEFAULT_PIXELS_PER_HOUR = 64;
