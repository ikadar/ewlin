import type { ScheduleSnapshot } from '@flux/types';
import { createBasicFixture } from './basic';

// ============================================================================
// Fixture: layout-redesign
// For v0.3.43 (Layout Redesign - REQ-07/08)
// Standard data to test layout changes and zoom levels
// ============================================================================

export function createLayoutRedesignFixture(): ScheduleSnapshot {
  // Use basic fixture data - layout changes don't require specific data
  return createBasicFixture();
}
