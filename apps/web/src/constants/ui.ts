export const SNAP_INTERVAL_MINUTES = 15;

export const COMPACT_HORIZONS = [
  { label: '4h', hours: 4 },
  { label: '8h', hours: 8 },
  { label: '24h', hours: 24 },
] as const;

export type CompactHorizon = (typeof COMPACT_HORIZONS)[number]['hours'];
