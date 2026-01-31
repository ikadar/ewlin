/**
 * Test Fixtures for E2E Testing
 *
 * Deterministic mock data for different test scenarios.
 * Each fixture is designed for specific use-case testing.
 *
 * Usage: /?fixture=<fixture-name>
 */

import type { ScheduleSnapshot } from '@flux/types';
import { createBasicFixture } from './fixtures/basic';
import { createPushDownFixture } from './fixtures/push-down';
import { createPrecedenceFixture } from './fixtures/precedence';
import { createApprovalGatesFixture } from './fixtures/approval-gates';
import { createSwapFixture } from './fixtures/swap';
import { createSidebarDragFixture } from './fixtures/sidebar-drag';
import { createAltBypassFixture } from './fixtures/alt-bypass';
import { createDragSnappingFixture } from './fixtures/drag-snapping';
import { createUiBugFixesFixture } from './fixtures/ui-bug-fixes';
import { createLayoutRedesignFixture } from './fixtures/layout-redesign';
import { createDatestripRedesignFixture } from './fixtures/datestrip-redesign';
import { createPrecedenceVisualizationFixture } from './fixtures/precedence-visualization';
import { createVirtualScrollFixture } from './fixtures/virtual-scroll';
import { createDatestripMarkersFixture } from './fixtures/datestrip-markers';
import { createZoomSnappingFixture } from './fixtures/zoom-snapping';
import { createDryingTimeFixture } from './fixtures/drying-time';
import { createValidationMessagesFixture } from './fixtures/validation-messages';
import { createPrecedenceWorkingHoursFixture } from './fixtures/precedence-working-hours';
import { createPickPlaceFixture } from './fixtures/pick-place';
import { createContextMenuFixture } from './fixtures/context-menu';
import { createFixedTileHeightFixture } from './fixtures/fixed-tile-height';
import { createUnavailabilityOverlayFixture } from './fixtures/unavailability-overlay';
import { createElementPrecedenceFixture } from './fixtures/element-precedence';
import { createScaleHarmonizationFixture } from './fixtures/scale-harmonization';
import { createBlockingVisualFixture } from './fixtures/blocking-visual';
import { createFormeDateTrackingFixture } from './fixtures/forme-date-tracking';

// Re-export createBasicFixture for direct usage
export { createBasicFixture };

// ============================================================================
// Fixture Registry
// ============================================================================

export type FixtureName = 'test' | 'push-down' | 'precedence' | 'approval-gates' | 'swap' | 'sidebar-drag' | 'alt-bypass' | 'drag-snapping' | 'ui-bug-fixes' | 'layout-redesign' | 'datestrip-redesign' | 'precedence-visualization' | 'virtual-scroll' | 'datestrip-markers' | 'zoom-snapping' | 'drying-time' | 'validation-messages' | 'precedence-working-hours' | 'pick-place' | 'context-menu' | 'fixed-tile-height' | 'unavailability-overlay' | 'element-precedence' | 'scale-harmonization' | 'blocking-visual' | 'forme-date-tracking';

export const fixtureRegistry: Record<FixtureName, () => ScheduleSnapshot> = {
  'test': createBasicFixture,
  'push-down': createPushDownFixture,
  'precedence': createPrecedenceFixture,
  'approval-gates': createApprovalGatesFixture,
  'swap': createSwapFixture,
  'sidebar-drag': createSidebarDragFixture,
  'alt-bypass': createAltBypassFixture,
  'drag-snapping': createDragSnappingFixture,
  'ui-bug-fixes': createUiBugFixesFixture,
  'layout-redesign': createLayoutRedesignFixture,
  'datestrip-redesign': createDatestripRedesignFixture,
  'precedence-visualization': createPrecedenceVisualizationFixture,
  'virtual-scroll': createVirtualScrollFixture,
  'datestrip-markers': createDatestripMarkersFixture,
  'zoom-snapping': createZoomSnappingFixture,
  'drying-time': createDryingTimeFixture,
  'validation-messages': createValidationMessagesFixture,
  'precedence-working-hours': createPrecedenceWorkingHoursFixture,
  'pick-place': createPickPlaceFixture,
  'context-menu': createContextMenuFixture,
  'fixed-tile-height': createFixedTileHeightFixture,
  'unavailability-overlay': createUnavailabilityOverlayFixture,
  'element-precedence': createElementPrecedenceFixture,
  'scale-harmonization': createScaleHarmonizationFixture,
  'blocking-visual': createBlockingVisualFixture,
  'forme-date-tracking': createFormeDateTrackingFixture,
};

/**
 * Get fixture by name from URL parameter
 */
export function getFixtureFromUrl(): ScheduleSnapshot | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const fixtureName = params.get('fixture') as FixtureName | null;

  if (!fixtureName || !fixtureRegistry[fixtureName]) {
    return null;
  }

  return fixtureRegistry[fixtureName]();
}

/**
 * Check if any test fixture is requested
 */
export function shouldUseFixture(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const fixtureName = params.get('fixture');
  return !!fixtureName && fixtureName in fixtureRegistry;
}
