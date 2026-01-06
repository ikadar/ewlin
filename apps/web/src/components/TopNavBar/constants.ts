/** Available zoom levels with their pixelsPerHour values */
// REQ-08: Added 25% zoom level (20px/hour)
export const ZOOM_LEVELS = [
  { label: '25%', pixelsPerHour: 20 },
  { label: '50%', pixelsPerHour: 40 },
  { label: '75%', pixelsPerHour: 60 },
  { label: '100%', pixelsPerHour: 80 },
  { label: '150%', pixelsPerHour: 120 },
  { label: '200%', pixelsPerHour: 160 },
] as const;

/** Default zoom level (100% = 80px/hour) */
export const DEFAULT_PIXELS_PER_HOUR = 80;
