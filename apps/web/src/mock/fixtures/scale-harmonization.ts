/**
 * Scale Harmonization Test Fixture (v0.4.29)
 *
 * Tests for:
 * - Font-size standardization (13px root, rem-based Tailwind)
 * - 80% zoom level (pixelsPerHour = 64)
 * - Tile height scaling across zoom levels
 *
 * Usage: /?fixture=scale-harmonization
 */

import { createBasicFixture } from './basic';

/**
 * Creates a fixture for testing UI scale harmonization.
 * Reuses the basic fixture which has multiple jobs and tiles
 * to verify font sizes and zoom scaling work correctly.
 */
export function createScaleHarmonizationFixture() {
  return createBasicFixture();
}
