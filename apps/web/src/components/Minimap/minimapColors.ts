import type { TileState } from '../Tile/colorUtils';

export const MINIMAP_TILE_COLORS: Record<TileState, string> = {
  shipped:   'rgb(16,185,129)',
  late:      'rgb(239,68,68)',
  conflict:  'rgb(245,158,11)',
  blocked:   'rgb(113,113,122)',
  completed: 'rgb(34,197,94)',
  default:   'rgb(59,130,246)',
};

export const MINIMAP_TILE_COLORS_DIMMED: Record<TileState, string> = {
  shipped:   'rgba(16,185,129,0.15)',
  late:      'rgba(239,68,68,0.15)',
  conflict:  'rgba(245,158,11,0.15)',
  blocked:   'rgba(113,113,122,0.15)',
  completed: 'rgba(34,197,94,0.15)',
  default:   'rgba(59,130,246,0.15)',
};
