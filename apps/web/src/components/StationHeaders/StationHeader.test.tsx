/**
 * StationHeader Component Tests
 * Tests for station header including REQ-18: Group capacity display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationHeader, type GroupCapacityInfo } from './StationHeader';
import type { Station } from '@flux/types';

// Test fixtures
const createStation = (id: string = 'sta-1'): Station => ({
  id,
  name: 'Test Station',
  status: 'Available',
  categoryId: 'cat-1',
  groupId: 'grp-1',
  capacity: 1,
  operatingSchedule: {
    monday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    tuesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    wednesday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    thursday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    friday: { isOperating: true, slots: [{ start: '06:00', end: '22:00' }] },
    saturday: { isOperating: false, slots: [] },
    sunday: { isOperating: false, slots: [] },
  },
  exceptions: [],
});

describe('StationHeader', () => {
  it('renders station name', () => {
    render(<StationHeader station={createStation()} />);

    expect(screen.getByText('Test Station')).toBeInTheDocument();
  });

  it('renders with data-testid', () => {
    render(<StationHeader station={createStation('sta-test')} />);

    expect(screen.getByTestId('station-header-sta-test')).toBeInTheDocument();
  });

  // NOTE: Group Capacity Display (REQ-18) was removed from StationHeader in REQ-06
  // The groupCapacity prop is still accepted but not rendered in the current implementation.
  // These tests are kept but updated to verify the current behavior.
  describe('Group Capacity Display (REQ-18 - removed in REQ-06)', () => {
    it('does not show group capacity even when provided (removed feature)', () => {
      const groupCapacity: GroupCapacityInfo = {
        groupId: 'grp-1',
        groupName: 'Offset Press',
        maxConcurrent: 3,
        currentUsage: 2,
      };

      render(
        <StationHeader
          station={createStation('sta-1')}
          groupCapacity={groupCapacity}
        />
      );

      // Group capacity display was removed from header
      expect(screen.queryByTestId('group-capacity-sta-1')).not.toBeInTheDocument();
    });

    it('does not show group capacity when not provided', () => {
      render(<StationHeader station={createStation('sta-1')} />);

      expect(screen.queryByTestId('group-capacity-sta-1')).not.toBeInTheDocument();
    });
  });
});
