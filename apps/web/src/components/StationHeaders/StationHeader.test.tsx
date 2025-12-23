/**
 * StationHeader Component Tests
 * Tests for station header including REQ-18: Group capacity display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  describe('Compact button', () => {
    it('shows compact button when onCompact provided', () => {
      render(
        <StationHeader
          station={createStation('sta-1')}
          hasTiles={true}
          onCompact={vi.fn()}
        />
      );

      expect(screen.getByTestId('compact-button-sta-1')).toBeInTheDocument();
    });

    it('disables compact button when no tiles', () => {
      render(
        <StationHeader
          station={createStation('sta-1')}
          hasTiles={false}
          onCompact={vi.fn()}
        />
      );

      const button = screen.getByTestId('compact-button-sta-1');
      expect(button).toBeDisabled();
    });

    it('calls onCompact when clicked with tiles', () => {
      const onCompact = vi.fn();
      render(
        <StationHeader
          station={createStation('sta-1')}
          hasTiles={true}
          onCompact={onCompact}
        />
      );

      fireEvent.click(screen.getByTestId('compact-button-sta-1'));
      expect(onCompact).toHaveBeenCalledWith('sta-1');
    });
  });

  describe('Group Capacity Display (REQ-18)', () => {
    it('shows group capacity info when provided', () => {
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

      expect(screen.getByTestId('group-capacity-sta-1')).toBeInTheDocument();
      expect(screen.getByText('Offset Press')).toBeInTheDocument();
      expect(screen.getByText('(2/3)')).toBeInTheDocument();
    });

    it('does not show group capacity when maxConcurrent is null', () => {
      const groupCapacity: GroupCapacityInfo = {
        groupId: 'grp-1',
        groupName: 'Provider Group',
        maxConcurrent: null,
        currentUsage: 5,
      };

      render(
        <StationHeader
          station={createStation('sta-1')}
          groupCapacity={groupCapacity}
        />
      );

      expect(screen.queryByTestId('group-capacity-sta-1')).not.toBeInTheDocument();
    });

    it('does not show group capacity when not provided', () => {
      render(<StationHeader station={createStation('sta-1')} />);

      expect(screen.queryByTestId('group-capacity-sta-1')).not.toBeInTheDocument();
    });

    it('shows warning icon when capacity exceeded', () => {
      const groupCapacity: GroupCapacityInfo = {
        groupId: 'grp-1',
        groupName: 'Offset Press',
        maxConcurrent: 2,
        currentUsage: 3, // exceeded
      };

      render(
        <StationHeader
          station={createStation('sta-1')}
          groupCapacity={groupCapacity}
        />
      );

      expect(screen.getByTestId('capacity-warning-icon')).toBeInTheDocument();
    });

    it('does not show warning icon when capacity not exceeded', () => {
      const groupCapacity: GroupCapacityInfo = {
        groupId: 'grp-1',
        groupName: 'Offset Press',
        maxConcurrent: 3,
        currentUsage: 2, // not exceeded
      };

      render(
        <StationHeader
          station={createStation('sta-1')}
          groupCapacity={groupCapacity}
        />
      );

      expect(screen.queryByTestId('capacity-warning-icon')).not.toBeInTheDocument();
    });

    it('uses red text when capacity exceeded', () => {
      const groupCapacity: GroupCapacityInfo = {
        groupId: 'grp-1',
        groupName: 'Offset Press',
        maxConcurrent: 2,
        currentUsage: 3,
      };

      render(
        <StationHeader
          station={createStation('sta-1')}
          groupCapacity={groupCapacity}
        />
      );

      const capacityDiv = screen.getByTestId('group-capacity-sta-1');
      expect(capacityDiv).toHaveClass('text-red-400');
    });

    it('uses normal text when capacity not exceeded', () => {
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

      const capacityDiv = screen.getByTestId('group-capacity-sta-1');
      expect(capacityDiv).toHaveClass('text-zinc-500');
    });

    it('hides group capacity when collapsed', () => {
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
          isCollapsed={true}
        />
      );

      expect(screen.queryByTestId('group-capacity-sta-1')).not.toBeInTheDocument();
    });

    it('shows correct tooltip when capacity exceeded', () => {
      const groupCapacity: GroupCapacityInfo = {
        groupId: 'grp-1',
        groupName: 'Offset Press',
        maxConcurrent: 2,
        currentUsage: 3,
      };

      render(
        <StationHeader
          station={createStation('sta-1')}
          groupCapacity={groupCapacity}
        />
      );

      const capacityDiv = screen.getByTestId('group-capacity-sta-1');
      expect(capacityDiv).toHaveAttribute('title', 'Offset Press capacity exceeded: 3/2');
    });

    it('shows correct tooltip when capacity not exceeded', () => {
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

      const capacityDiv = screen.getByTestId('group-capacity-sta-1');
      expect(capacityDiv).toHaveAttribute('title', 'Offset Press: 2/3 concurrent tasks');
    });
  });
});
