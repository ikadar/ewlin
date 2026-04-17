import { ALL_TILE_STATES, getStateRgb, type TileState } from '../Tile/colorUtils';

export const MINIMAP_TILE_COLORS: Record<TileState, string> = Object.fromEntries(
  ALL_TILE_STATES.map((s) => [s, `rgb(${getStateRgb(s).tile})`]),
) as Record<TileState, string>;

export const MINIMAP_TILE_COLORS_DIMMED: Record<TileState, string> = Object.fromEntries(
  ALL_TILE_STATES.map((s) => [s, `rgba(${getStateRgb(s).tile},0.15)`]),
) as Record<TileState, string>;
