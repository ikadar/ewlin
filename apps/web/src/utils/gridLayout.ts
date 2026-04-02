import type { Station, StationCategory } from '@flux/types';
import { getDefaultCategoryWidth } from './tileLabelResolver';

/**
 * Get layout dimensions in pixels, derived from CSS rem values and root font-size.
 */
export function getLayoutDimensions(): {
  stationWidth: number;  // w-60 = 15rem
  gap: number;           // gap-3 = 0.75rem
  paddingLeft: number;   // px-3 = 0.75rem
  timelineWidth: number; // w-12 = 3rem
} {
  const rootFontSize = typeof window !== 'undefined'
    ? parseFloat(getComputedStyle(document.documentElement).fontSize)
    : 13; // SSR fallback

  return {
    stationWidth: 15 * rootFontSize,    // w-60 = 15rem
    gap: 0.75 * rootFontSize,           // gap-3 = 0.75rem
    paddingLeft: 0.75 * rootFontSize,   // px-3 = 0.75rem
    timelineWidth: 3 * rootFontSize,    // w-12 = 3rem
  };
}

/**
 * Calculate a station's X offset and width, accounting for variable column widths.
 * Uses getLayoutDimensions().stationWidth as the default (w-60 = 15rem, font-size-aware).
 */
export function getStationXOffset(
  stationIndex: number,
  stations: Station[],
  catMap: Map<string, StationCategory>,
): { x: number; stationWidth: number } {
  const { gap, paddingLeft, stationWidth: defaultWidth } = getLayoutDimensions();
  let x = paddingLeft;
  for (let i = 0; i < stationIndex; i++) {
    const cat = catMap.get(stations[i].categoryId);
    const w = cat?.columnWidth ?? (cat ? getDefaultCategoryWidth(cat.name) : null) ?? defaultWidth;
    x += w + gap;
  }
  const targetCat = catMap.get(stations[stationIndex].categoryId);
  const stationWidth = targetCat?.columnWidth ?? (targetCat ? getDefaultCategoryWidth(targetCat.name) : null) ?? defaultWidth;
  return { x, stationWidth };
}

/**
 * Calculate the total content width of all station columns including gaps and padding.
 */
export function getTotalContentWidth(
  stations: Station[],
  catMap: Map<string, StationCategory>,
): number {
  if (stations.length === 0) return 0;
  const { x, stationWidth } = getStationXOffset(stations.length - 1, stations, catMap);
  const { paddingLeft } = getLayoutDimensions();
  return x + stationWidth + paddingLeft; // padding on both sides
}
