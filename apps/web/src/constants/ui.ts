export const SNAP_INTERVAL_MINUTES = 15;

export const COMPACT_HORIZONS = [
  { label: '4h', hours: 4 },
  { label: '8h', hours: 8 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '72h', hours: 72 },
] as const;

export type CompactHorizon = (typeof COMPACT_HORIZONS)[number]['hours'];
